import { describe, expect, it } from "vitest";
import {
  allRates,
  hasTieredPricing,
  isResidency,
  lowestRate,
  rateFor,
} from "@/lib/residency";

/**
 * Residency decides what a safari costs, so the fallbacks matter: an
 * operator who fills in only one price must never have a visitor quoted
 * nothing, or a citizen quoted the visitor rate.
 */

const TIERED = {
  priceMinor: 10_500_000, // Ksh 105,000 citizen
  priceResidentMinor: 13_000_000,
  priceNonResidentMinor: 18_000_000,
};

const FLAT = { priceMinor: 10_500_000, priceResidentMinor: null, priceNonResidentMinor: null };

describe("rateFor", () => {
  it("charges each tier its own rate", () => {
    expect(rateFor(TIERED, "CITIZEN")).toBe(10_500_000);
    expect(rateFor(TIERED, "RESIDENT")).toBe(13_000_000);
    expect(rateFor(TIERED, "NON_RESIDENT")).toBe(18_000_000);
  });

  it("falls back to the citizen rate when a tier is unset", () => {
    expect(rateFor(FLAT, "RESIDENT")).toBe(10_500_000);
    expect(rateFor(FLAT, "NON_RESIDENT")).toBe(10_500_000);
  });

  it("falls back downward, never to the dearest rate", () => {
    const partial = { priceMinor: 10_500_000, priceNonResidentMinor: 18_000_000 };
    // A resident with no rate of their own pays the citizen rate, not the visitor one.
    expect(rateFor(partial, "RESIDENT")).toBe(10_500_000);
  });
});

describe("lowestRate", () => {
  it("is what a listing card shows as 'from'", () => {
    expect(lowestRate(TIERED)).toBe(10_500_000);
  });

  it("still works when only one price is set", () => {
    expect(lowestRate(FLAT)).toBe(10_500_000);
  });

  it("finds the cheapest even if the tiers are entered out of order", () => {
    expect(lowestRate({ priceMinor: 20_000_000, priceResidentMinor: 9_000_000 })).toBe(9_000_000);
  });
});

describe("hasTieredPricing", () => {
  it("is true only when the prices actually differ", () => {
    expect(hasTieredPricing(TIERED)).toBe(true);
    expect(hasTieredPricing(FLAT)).toBe(false);
    expect(
      hasTieredPricing({
        priceMinor: 10_500_000,
        priceResidentMinor: 10_500_000,
        priceNonResidentMinor: 10_500_000,
      }),
    ).toBe(false);
  });
});

describe("isResidency", () => {
  it("accepts the three tiers and nothing else", () => {
    expect(isResidency("CITIZEN")).toBe(true);
    expect(isResidency("NON_RESIDENT")).toBe(true);
    for (const bad of ["citizen", "TOURIST", "", null, undefined, 1]) {
      expect(isResidency(bad)).toBe(false);
    }
  });
});

describe("allRates", () => {
  it("returns every tier, for a rate card on the tour page", () => {
    expect(allRates(TIERED)).toEqual([
      { residency: "CITIZEN", perPersonMinor: 10_500_000 },
      { residency: "RESIDENT", perPersonMinor: 13_000_000 },
      { residency: "NON_RESIDENT", perPersonMinor: 18_000_000 },
    ]);
  });
});
