import { z } from "zod";
import { enquiryDateSchema } from "@/lib/flight-enquiry-schema";
import { isNight } from "@/lib/transfer-zones-shared";

export const AIRPORT_TRANSFER_KEY = "KGL_SEDAN";
export const AIRPORT_TRANSFER_LABEL = "Kigali International Airport (KGL)";
export const AIRPORT_TRANSFER_DIRECTIONS = ["FROM_AIRPORT", "TO_AIRPORT"] as const;
export const AIRPORT_TRANSFER_BANDS = [
  { maxMeters: 8_000, label: "Up to 8 km" },
  { maxMeters: 15_000, label: "Over 8 to 15 km" },
  { maxMeters: 25_000, label: "Over 15 to 25 km" },
] as const;
export const AIRPORT_SEDAN_SEATS = 4;
export const transferTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid pickup time");
export type AirportTransferDirection = (typeof AIRPORT_TRANSFER_DIRECTIONS)[number];

const supplierCost = z.number().int().min(1).max(1_000_000);
const costsByBand = z.tuple([supplierCost, supplierCost, supplierCost]);
const operatingCost = z.number().int().min(0).max(100_000);
export const airportTransferRateSchema = z
  .object({
    supplierRwf: z.object({ FROM_AIRPORT: costsByBand, TO_AIRPORT: costsByBand }),
    dispatchRwf: operatingCost,
    nightRwf: operatingCost,
    paymentBps: z.number().int().min(0).max(1500),
    contributionBps: z.number().int().min(0).max(5000),
    validThrough: enquiryDateSchema,
    evidence: z.string().trim().min(10).max(500),
  })
  .refine(
    ({ supplierRwf }) => Object.values(supplierRwf).every(([a, b, c]) => a <= b && b <= c),
    { message: "Supplier costs should stay level or increase with distance.", path: ["supplierRwf"] },
  );
export type AirportTransferRates = z.infer<typeof airportTransferRateSchema>;

export function roundTransferFare(directRwf: number, paymentBps: number, contributionBps: number) {
  const availableBps = 10_000 - paymentBps - contributionBps;
  return Math.ceil((directRwf * 10_000) / (availableBps * 1_000)) * 1_000;
}

export function priceAirportTransfer(
  rates: AirportTransferRates,
  trip: { distanceMeters: number; direction: AirportTransferDirection; time: string },
) {
  const { distanceMeters, direction, time } = trip;
  if (!Number.isSafeInteger(distanceMeters) || distanceMeters < 1) return null;
  const band = AIRPORT_TRANSFER_BANDS.findIndex(({ maxMeters }) => distanceMeters <= maxMeters);
  if (band < 0) return null;
  const directRwf = rates.supplierRwf[direction][band] + rates.dispatchRwf + (isNight(time) ? rates.nightRwf : 0);
  return roundTransferFare(directRwf, rates.paymentBps, rates.contributionBps);
}

export const formatTransferRwf = (rwf: number) => `${new Intl.NumberFormat("en-GB").format(rwf)} RWF`;
