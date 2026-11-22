import {
  activeAirportRates,
  airportDrivingRoute,
  airportMapConfig,
  reserveMapRequests,
  suggestTransferPlaces,
  transferMapRequestSchema,
} from "@/lib/airport-transfer-maps";
import { priceAirportTransfer } from "@/lib/airport-transfer-pricing";
import { getPublications } from "@/lib/publication";
import { publicPreviewAllowed } from "@/lib/soft-launch";

const reply = (data: object, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store" },
});

export async function POST(request: Request) {
  const config = airportMapConfig();
  if (!config) return reply({ error: "Route estimates are unavailable." }, 404);
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return reply({ error: "Open the transfers page to look up a route." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return reply({ error: "Use a JSON request." }, 415);
  }
  const text = await request.text().catch(() => "");
  const body = text.length <= 4_096 ? parseJson(text) : null;
  const parsed = transferMapRequestSchema.safeParse(body);
  if (!parsed.success) return reply({ error: "Check the location and trip details." }, 400);
  try {
    if (!(await publicPreviewAllowed()) || (await getPublications()).TRANSPORT !== "ENQUIRY") {
      return reply({ error: "Route estimates are unavailable." }, 404);
    }
    const rates = await activeAirportRates();
    if (!rates) return reply({ error: "Route estimates are unavailable." }, 404);
    const input = parsed.data;
    const requests = input.kind === "estimate" && input.sessionToken ? 2 : 1;
    if (!(await reserveMapRequests(request.headers, config.apiKey, requests))) {
      return reply({ error: "Map lookups are busy. You can still request a quote below." }, 429);
    }
    if (input.kind === "places") {
      return reply({ places: await suggestTransferPlaces(config.apiKey, input.input, input.sessionToken) });
    }
    const route = await airportDrivingRoute(config, input);
    const fareRwf = route && priceAirportTransfer(rates, { ...input, distanceMeters: route.distanceMeters });
    if (!route || fareRwf === null) {
      return reply({ error: "The desk can price this trip directly. Send your details below." }, 422);
    }
    return reply({ ...route, fareRwf });
  } catch (error) {
    console.warn("[transfer map] estimate unavailable", error instanceof Error ? error.name : "Error");
    return reply({ error: "Map lookup is temporarily unavailable. You can still request a quote." }, 503);
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
