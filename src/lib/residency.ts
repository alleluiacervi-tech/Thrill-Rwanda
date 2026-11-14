/**
 * Safari pricing by residency.
 *
 * Rwandan operators quote three rates: East African citizens, residents of
 * East Africa who are not citizens, and everyone else. Park fees drive most
 * of the gap, so the difference is often large.
 *
 * A tour only has to set the citizen rate. An unset tier falls back to it,
 * which is safer than falling back to the most expensive one.
 */

export const RESIDENCIES = ["CITIZEN", "RESIDENT", "NON_RESIDENT"] as const;
export type Residency = (typeof RESIDENCIES)[number];

export const RESIDENCY_LABELS: Record<Residency, string> = {
  CITIZEN: "East African citizen",
  RESIDENT: "East African resident",
  NON_RESIDENT: "Non-resident",
};

export const RESIDENCY_HINTS: Record<Residency, string> = {
  CITIZEN: "Citizen of Rwanda, Kenya, Uganda, Tanzania, Burundi or South Sudan.",
  RESIDENT: "Living in East Africa on a work or residence permit.",
  NON_RESIDENT: "Visiting from outside East Africa.",
};

export type TourRates = {
  priceMinor: number;
  priceResidentMinor?: number | null;
  priceNonResidentMinor?: number | null;
};

export function isResidency(value: unknown): value is Residency {
  return typeof value === "string" && (RESIDENCIES as readonly string[]).includes(value);
}

/** The per-person rate for one residency. */
export function rateFor(rates: TourRates, residency: Residency): number {
  if (residency === "RESIDENT") return rates.priceResidentMinor ?? rates.priceMinor;
  if (residency === "NON_RESIDENT") return rates.priceNonResidentMinor ?? rates.priceMinor;
  return rates.priceMinor;
}

/** All three, for showing a rate card. */
export function allRates(rates: TourRates): { residency: Residency; perPersonMinor: number }[] {
  return RESIDENCIES.map((residency) => ({ residency, perPersonMinor: rateFor(rates, residency) }));
}

/** The cheapest rate, for a "from" price on a listing card. */
export function lowestRate(rates: TourRates): number {
  return Math.min(...allRates(rates).map((r) => r.perPersonMinor));
}

/** True when the operator has actually set different prices. */
export function hasTieredPricing(rates: TourRates): boolean {
  const values = allRates(rates).map((r) => r.perPersonMinor);
  return new Set(values).size > 1;
}
