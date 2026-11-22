import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  AIRPORT_SEDAN_SEATS,
  AIRPORT_TRANSFER_DIRECTIONS,
  AIRPORT_TRANSFER_KEY,
  airportTransferRateSchema,
  transferTimeSchema,
  type AirportTransferDirection,
} from "@/lib/airport-transfer-pricing";
import { todayInRwanda } from "@/lib/flight-enquiry-schema";

const placeIdSchema = z.string().regex(/^[\w-]{5,300}$/);
const sessionToken = z.uuid();
export const transferMapRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("places"), input: z.string().trim().min(3).max(160), sessionToken }),
  z.object({
    kind: z.literal("estimate"),
    placeId: placeIdSchema,
    sessionToken: sessionToken.optional(),
    direction: z.enum(AIRPORT_TRANSFER_DIRECTIONS),
    time: transferTimeSchema,
    passengers: z.number().int().min(1).max(AIRPORT_SEDAN_SEATS),
  }),
]);

export function airportMapConfig() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const airport = placeIdSchema.safeParse(process.env.GOOGLE_MAPS_KGL_PLACE_ID?.trim());
  if (process.env.TRANSFER_ROUTE_ESTIMATES_ENABLED !== "true" || !apiKey || !airport.success) return null;
  return { apiKey, airportPlaceId: airport.data };
}

export async function activeAirportRates() {
  const row = await db.airportTransferPricing.findUnique({ where: { key: AIRPORT_TRANSFER_KEY } });
  if (!row?.isActive) return null;
  const rates = airportTransferRateSchema.safeParse(row.rates);
  return rates.success && rates.data.validThrough >= todayInRwanda() ? rates.data : null;
}

const suggestionSchema = z.object({
  placePrediction: z.object({ placeId: placeIdSchema, text: z.object({ text: z.string().min(1).max(300) }) }),
});

async function googleJson(url: string, apiKey: string, fields: string, body?: object) {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fields,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok) throw new Error(`Google Maps returned HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function suggestTransferPlaces(apiKey: string, input: string, token: string) {
  const result = await googleJson(
    "https://places.googleapis.com/v1/places:autocomplete",
    apiKey,
    "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
    {
      input,
      sessionToken: token,
      includedRegionCodes: ["rw"],
      languageCode: "en",
      locationBias: { circle: { center: { latitude: -1.96, longitude: 30.10 }, radius: 25_000 } },
    },
  );
  const { suggestions } = z.object({ suggestions: z.array(z.unknown()).default([]) }).parse(result);
  return suggestions.flatMap((value) => {
    const row = suggestionSchema.safeParse(value);
    if (!row.success) return [];
    const { placeId, text } = row.data.placePrediction;
    return [{ placeId, label: text.text }];
  }).slice(0, 5);
}

export async function airportDrivingRoute(
  config: NonNullable<ReturnType<typeof airportMapConfig>>,
  input: { placeId: string; sessionToken?: string; direction: AirportTransferDirection },
) {
  if (input.placeId === config.airportPlaceId) return null;
  if (input.sessionToken) {
    // A Places session closes on Place Details. Request the Essentials location field.
    await googleJson(
      `https://places.googleapis.com/v1/places/${input.placeId}?sessionToken=${input.sessionToken}`,
      config.apiKey,
      "location",
    );
  }
  const airport = { placeId: config.airportPlaceId };
  const location = { placeId: input.placeId };
  const arriving = input.direction === "FROM_AIRPORT";
  const result = await googleJson(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    config.apiKey,
    "routes.distanceMeters,routes.duration",
    {
      origin: arriving ? airport : location,
      destination: arriving ? location : airport,
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      computeAlternativeRoutes: false,
    },
  );
  const { routes } = z.object({
    routes: z.array(z.object({
      distanceMeters: z.number().int().nonnegative().optional(),
      duration: z.string().regex(/^\d+(\.\d+)?s$/),
    })).default([]),
  }).parse(result);
  const route = routes[0];
  if (!route?.distanceMeters) return null;
  return { distanceMeters: route.distanceMeters, durationMinutes: Math.ceil(Number.parseFloat(route.duration) / 60) };
}

class MapBudgetExceeded extends Error {}

/** Database limits remain effective across app instances, including concurrent requests. */
export async function reserveMapRequests(headers: Headers, secret: string, requests: number, now = Date.now()) {
  const forwarded = process.env.VERCEL === "1"
    ? headers.get("x-vercel-forwarded-for")
    : headers.get("x-forwarded-for");
  const address = forwarded?.split(",").at(-1)?.trim() ?? "";
  const ip = isIP(address) ? address : "unknown";
  const quarterHour = Math.floor(now / 900_000);
  const day = Math.floor(now / 86_400_000);
  const client = createHmac("sha256", secret).update(`${day}:${ip}`).digest("hex");
  const buckets = [
    { key: `client:${quarterHour}:${client}`, limit: 40, ends: (quarterHour + 1) * 900_000 },
    { key: `all:${day}`, limit: 700, ends: (day + 1) * 86_400_000 },
  ];
  try {
    await db.$transaction(async (tx) => {
      for (const { key, limit, ends } of buckets) {
        const rows = await tx.$queryRaw<{ count: number }[]>`
          INSERT INTO transfer_map_usage ("key", "count", expires_at)
          VALUES (${key}, ${requests}, ${new Date(ends)})
          ON CONFLICT ("key") DO UPDATE SET "count" = transfer_map_usage."count" + EXCLUDED."count"
          WHERE transfer_map_usage."count" + EXCLUDED."count" <= ${limit}
          RETURNING "count"
        `;
        if (!rows.length) throw new MapBudgetExceeded();
        if (key.startsWith("all:") && rows[0].count === requests) {
          await tx.transferMapUsage.deleteMany({ where: { expiresAt: { lt: new Date(day * 86_400_000 - 86_400_000) } } });
        }
      }
    });
    return true;
  } catch (error) {
    if (error instanceof MapBudgetExceeded) return false;
    throw error;
  }
}
