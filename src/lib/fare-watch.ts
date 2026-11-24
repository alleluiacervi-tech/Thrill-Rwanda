/**
 * The daily fare check behind the public fares board.
 *
 * Once a day it asks the source chosen in Admin → Fares for one-way economy
 * fares for one adult from Kigali to the destinations below, and stores the
 * cheapest found for each.
 *
 * - Duffel: a live search for one date per destination, rotating 2 to 9 weeks
 *   ahead, so a dozen searches a day build a picture of every route over a week.
 *   Only with a LIVE token: sandbox offers are invented and never shown.
 * - Skyscanner: cached prices for the month of that same date; the cheapest
 *   quote Skyscanner found in the last 4 days, stored with the time it found it.
 */
import { db } from "@/lib/db";
import { duffel } from "@/lib/duffel/client";
import { toMinor } from "@/lib/duffel/mapping";
import type { DuffelOffer, DuffelOfferRequest } from "@/lib/duffel/types";
import { isFareSource, sourceReadiness, type FareSource } from "@/lib/fare-sources";
import { KIGALI } from "@/lib/flight-destinations";
import { indicativeCheapest, skyscannerConfig } from "@/lib/skyscanner";

export const WATCHED = ["NBO", "EBB", "DAR", "ZNZ", "ADD", "JNB", "LOS", "DXB", "DOH", "IST", "LHR", "BRU"] as const;
const OFFSETS_DAYS = [14, 21, 30, 45, 63];
const KEEP_DAYS = 120;
const CONCURRENCY = 3;

/** The source the admin chose. Off if unset or unreadable. */
export async function getFareSource(): Promise<FareSource> {
  try {
    const row = await db.siteSettings.findUnique({ where: { id: 1 }, select: { fareSource: true } });
    return isFareSource(row?.fareSource) ? row.fareSource : "off";
  } catch {
    return "off";
  }
}

/** The date each destination is checked for today: spread over the offsets, moving on each day. */
export function plannedSearches(today: Date) {
  const day = Math.floor(today.getTime() / 86_400_000);
  return WATCHED.map((destination, i) => {
    const offset = OFFSETS_DAYS[(day + i) % OFFSETS_DAYS.length];
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset));
    return { destination, departureDate: date.toISOString().slice(0, 10) };
  });
}

/** The cheapest real offer: never a sandbox one, nor Duffel's test airline (ZZ). One currency throughout. */
export function cheapestOffer(offers: DuffelOffer[]): DuffelOffer | null {
  let best: DuffelOffer | null = null;
  for (const offer of offers) {
    if (offer.live_mode === false || offer.owner?.iata_code === "ZZ") continue;
    if (offer.total_currency !== (best?.total_currency ?? offer.total_currency)) continue;
    if (!best || Number(offer.total_amount) < Number(best.total_amount)) best = offer;
  }
  return best;
}

type Found = { departureDate: string; currency: string; totalMinor: number; airline: string; stops: number; checkedAt: Date };
type Search = (destination: string, departureDate: string) => Promise<Found | null>;

function duffelSearch(now: Date): Search {
  return async (destination, departureDate) => {
    const request = await duffel<DuffelOfferRequest>("/air/offer_requests", {
      method: "POST",
      query: { return_offers: true, supplier_timeout: 20_000 },
      body: {
        slices: [{ origin: KIGALI.code, destination, departure_date: departureDate }],
        passengers: [{ type: "adult" }],
        cabin_class: "economy",
        max_connections: 1,
      },
      timeoutMs: 40_000,
    });
    const offer = cheapestOffer(request.offers ?? []);
    if (!offer) return null;
    return {
      departureDate,
      currency: offer.total_currency,
      totalMinor: toMinor(offer.total_amount, offer.total_currency),
      airline: offer.owner?.name ?? "",
      stops: Math.max(0, (offer.slices?.[0]?.segments?.length ?? 1) - 1),
      checkedAt: now,
    };
  };
}

function skyscannerSearch(now: Date): Search {
  const config = skyscannerConfig();
  if (!config) throw new Error("Skyscanner is not configured");
  return async (destination, departureDate) => {
    const [year, month] = departureDate.split("-").map(Number);
    const fare = await indicativeCheapest(config, KIGALI.code, destination, { year, month }, now);
    if (!fare) return null;
    return {
      departureDate: fare.departureDate,
      currency: config.currency,
      totalMinor: toMinor(fare.amount.toFixed(2), config.currency),
      airline: fare.airline,
      stops: fare.stops,
      checkedAt: fare.foundAt,
    };
  };
}

export type FareWatchResult = { source: FareSource; saved: number; searched: number; failed: number; skipped?: string };

/** Runs today's checks against the chosen source. Never throws for one route failing. */
export async function runFareWatch(now = new Date(), chosen?: FareSource): Promise<FareWatchResult> {
  const source = chosen ?? (await getFareSource());
  const ready = sourceReadiness(source);
  if (source === "off") return { source, saved: 0, searched: 0, failed: 0, skipped: "Fares are switched off in Admin → Fares." };
  if (!ready.ok) return { source, saved: 0, searched: 0, failed: 0, skipped: ready.reason };

  const search = source === "duffel" ? duffelSearch(now) : skyscannerSearch(now);
  const queue = plannedSearches(now);
  const result: FareWatchResult = { source, saved: 0, searched: queue.length, failed: 0 };

  async function worker() {
    for (let next = queue.shift(); next; next = queue.shift()) {
      try {
        const found = await search(next.destination, next.departureDate);
        if (!found) continue;
        const departureDate = new Date(`${found.departureDate}T00:00:00Z`);
        // Skyscanner can return the same cached quote on several days; store it once.
        const seen = await db.fareSnapshot.findFirst({
          where: { source, destination: next.destination, departureDate, totalMinor: found.totalMinor, checkedAt: found.checkedAt },
          select: { id: true },
        });
        if (seen) continue;
        await db.fareSnapshot.create({
          data: {
            origin: KIGALI.code,
            destination: next.destination,
            departureDate,
            currency: found.currency,
            totalMinor: found.totalMinor,
            airline: found.airline,
            stops: found.stops,
            source,
            checkedAt: found.checkedAt,
          },
        });
        result.saved++;
      } catch {
        // One route failing (no offers, a timeout) must not stop the others.
        result.failed++;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await db.fareSnapshot.deleteMany({ where: { checkedAt: { lt: new Date(now.getTime() - KEEP_DAYS * 86_400_000) } } });
  return result;
}
