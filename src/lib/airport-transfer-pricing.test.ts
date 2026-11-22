import { describe, expect, it } from "vitest";
import { airportTransferRateSchema, priceAirportTransfer, roundTransferFare } from "@/lib/airport-transfer-pricing";

const rates = airportTransferRateSchema.parse({
  supplierRwf: { FROM_AIRPORT: [8468, 12745, 19904], TO_AIRPORT: [7500, 11000, 18500] },
  dispatchRwf: 1000,
  nightRwf: 2000,
  paymentBps: 200,
  contributionBps: 2200,
  validThrough: "2026-12-31",
  evidence: "Fictional test rate card",
});

describe("airport transfer pricing", () => {
  it("calculates the three provisional cost examples and preserves exact round amounts", () => {
    expect([9468, 13745, 20904].map((cost) => roundTransferFare(cost, 200, 2200))).toEqual([13_000, 19_000, 28_000]);
    expect(roundTransferFare(15_200, 200, 2200)).toBe(20_000);
  });

  it("prices by driving distance and direction, including only the agreed night cost", () => {
    const from = { direction: "FROM_AIRPORT", time: "20:59" } as const;
    expect(priceAirportTransfer(rates, { ...from, distanceMeters: 8000 })).toBe(13_000);
    expect(priceAirportTransfer(rates, { ...from, distanceMeters: 8001 })).toBe(19_000);
    expect(priceAirportTransfer(rates, { ...from, distanceMeters: 12000, time: "21:00" })).toBe(21_000);
    expect(priceAirportTransfer(rates, { direction: "TO_AIRPORT", distanceMeters: 12000, time: "05:00" })).toBe(16_000);
  });

  it("sends unsupported routes to the desk and rejects decreasing or invalid rate cards", () => {
    const from = { direction: "FROM_AIRPORT", time: "12:00" } as const;
    expect(priceAirportTransfer(rates, { ...from, distanceMeters: 0 })).toBeNull();
    expect(priceAirportTransfer(rates, { ...from, distanceMeters: 25001 })).toBeNull();
    expect(airportTransferRateSchema.safeParse({ ...rates, validThrough: "2026-02-30" }).success).toBe(false);
    expect(airportTransferRateSchema.safeParse({ ...rates, supplierRwf: { ...rates.supplierRwf, FROM_AIRPORT: [20, 10, 5] } }).success).toBe(false);
  });
});
