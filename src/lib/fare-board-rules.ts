/**
 * What the public fares board may claim, computed from our own data only
 * (docs/FARES_SEO_PAYMENTS_PLAN.md). Pure functions, so every rule is tested.
 *
 *  - Cheap flights: the lowest fare found per destination in the last 3 days.
 *  - Best deals: a latest fare at least 10% below that route's average over
 *    the previous 30 days, measured on 5 or more earlier checks.
 *  - Trending: the destinations most asked for in flight enquiries over the
 *    last 30 days, once there are enough enquiries to mean something.
 */
import { airportCodeOf } from "@/lib/flight-enquiry-schema";
import { minorFactor } from "@/lib/duffel/mapping";

export type FareRow = {
  destination: string;
  departureDate: Date;
  currency: string;
  totalMinor: number;
  airline: string;
  stops: number;
  checkedAt: Date;
};

export const FRESH_DAYS = 3;
export const HISTORY_DAYS = 30;
export const MIN_HISTORY = 5;
export const DEAL_THRESHOLD = 0.1;
export const MIN_CHEAP_ROUTES = 3;
export const MIN_TREND_ENQUIRIES = 10;

const DAY = 86_400_000;

/** One fare per destination: the cheapest found in the fresh window, cheapest first. */
export function cheapestFares(rows: FareRow[], now: Date): FareRow[] {
  const list = freshFares(rows, now).sort((a, b) => toUnits(a) - toUnits(b));
  return list.length >= MIN_CHEAP_ROUTES ? list : [];
}

export type Deal = FareRow & { average: number; below: number };

/** Fresh fares well under their own route's recent average, biggest drop first. */
export function bestDeals(rows: FareRow[], now: Date): Deal[] {
  const deals: Deal[] = [];
  const freshFrom = now.getTime() - FRESH_DAYS * DAY;
  const historyFrom = now.getTime() - HISTORY_DAYS * DAY;
  for (const fare of freshFares(rows, now)) {
    const earlier = rows.filter(
      (row) =>
        row.destination === fare.destination &&
        row.currency === fare.currency &&
        row.checkedAt.getTime() >= historyFrom &&
        row.checkedAt.getTime() < freshFrom,
    );
    if (earlier.length < MIN_HISTORY) continue;
    const average = earlier.reduce((sum, row) => sum + row.totalMinor, 0) / earlier.length;
    const below = 1 - fare.totalMinor / average;
    if (below >= DEAL_THRESHOLD) deals.push({ ...fare, average, below });
  }
  return deals.sort((a, b) => b.below - a.below);
}

export type Trend = { code: string; requests: number };

/** Destination codes by how often flight enquiries asked for them. Empty until there is enough to count. */
export function trendingDestinations(details: unknown[], exclude = "KGL", limit = 6): Trend[] {
  if (details.length < MIN_TREND_ENQUIRIES) return [];
  const counts = new Map<string, number>();
  for (const raw of details) {
    const destination = (raw as { destination?: unknown } | null)?.destination;
    if (typeof destination !== "string") continue;
    const code = airportCodeOf(destination);
    if (!code || code === exclude) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, requests]) => requests >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([code, requests]) => ({ code, requests }));
}

/** "US$215": whole units, the currency spelt out where "$" would be ambiguous. */
export function formatFare(totalMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    Math.ceil(totalMinor / minorFactor(currency)),
  );
}

/** The cheapest fare per destination checked in the fresh window, for a date not yet passed. */
function freshFares(rows: FareRow[], now: Date) {
  const since = now.getTime() - FRESH_DAYS * DAY;
  const best = new Map<string, FareRow>();
  for (const row of rows) {
    if (row.checkedAt.getTime() < since || row.departureDate.getTime() < startOfDay(now)) continue;
    const held = best.get(row.destination);
    if (!held || compareFare(row, held) < 0) best.set(row.destination, row);
  }
  return [...best.values()];
}

const toUnits = (row: FareRow) => row.totalMinor / minorFactor(row.currency);
const compareFare = (a: FareRow, b: FareRow) => toUnits(a) - toUnits(b) || b.checkedAt.getTime() - a.checkedAt.getTime();
const startOfDay = (now: Date) => Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
