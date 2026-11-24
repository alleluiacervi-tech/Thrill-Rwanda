/**
 * The daily fare check behind the public fares board.
 *
 * Once a day it asks Duffel for one-way economy fares for one adult from
 * Kigali to the destinations below, and stores the cheapest offer found for
 * each. Each destination gets one date per day, rotating 2 to 9 weeks ahead,
 * so a dozen searches a day build a picture of every route over a week.
 *
 * It only runs with a LIVE Duffel token and FARE_WATCH_ENABLED=true: sandbox
 * offers are invented by Duffel and must never be shown to the public.
 */
import { db } from "@/lib/db";
import { duffelAvailability } from "@/lib/duffel/config";
import { duffel } from "@/lib/duffel/client";
import { toMinor } from "@/lib/duffel/mapping";
import type { DuffelOffer, DuffelOfferRequest } from "@/lib/duffel/types";
import { KIGALI } from "@/lib/flight-destinations";

export const WATCHED = ["NBO", "EBB", "DAR", "ZNZ", "ADD", "JNB", "LOS", "DXB", "DOH", "IST", "LHR", "BRU"] as const;
const OFFSETS_DAYS = [14, 21, 30, 45, 63];
const KEEP_DAYS = 120;
const CONCURRENCY = 3;

export type FareWatchState = { ok: true } | { ok: false; reason: string };

export function fareWatchState(env: Record<string, string | undefined> = process.env): FareWatchState {
  if (env.FARE_WATCH_ENABLED !== "true") return { ok: false, reason: "FARE_WATCH_ENABLED is not true" };
  const duffel = duffelAvailability(env);
  if (!duffel.ok) return { ok: false, reason: duffel.message };
  if (duffel.config.mode !== "live") return { ok: false, reason: "Duffel is in sandbox mode; sandbox fares are never published" };
  return { ok: true };
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

/** Runs today's checks. Returns how many fares were stored. */
export async function runFareWatch(now = new Date()): Promise<number> {
  const state = fareWatchState();
  if (!state.ok) return 0;

  const queue = plannedSearches(now);
  let saved = 0;
  async function worker() {
    for (let next = queue.shift(); next; next = queue.shift()) {
      try {
        const request = await duffel<DuffelOfferRequest>("/air/offer_requests", {
          method: "POST",
          query: { return_offers: true, supplier_timeout: 20_000 },
          body: {
            slices: [{ origin: KIGALI.code, destination: next.destination, departure_date: next.departureDate }],
            passengers: [{ type: "adult" }],
            cabin_class: "economy",
            max_connections: 1,
          },
          timeoutMs: 40_000,
        });
        const offer = cheapestOffer(request.offers ?? []);
        if (!offer) continue;
        await db.fareSnapshot.create({
          data: {
            origin: KIGALI.code,
            destination: next.destination,
            departureDate: new Date(`${next.departureDate}T00:00:00Z`),
            currency: offer.total_currency,
            totalMinor: toMinor(offer.total_amount, offer.total_currency),
            airline: offer.owner?.name ?? "",
            stops: Math.max(0, (offer.slices?.[0]?.segments?.length ?? 1) - 1),
            checkedAt: now,
          },
        });
        saved++;
      } catch {
        // One route failing (no offers, a supplier timeout) must not stop the others.
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await db.fareSnapshot.deleteMany({ where: { checkedAt: { lt: new Date(now.getTime() - KEEP_DAYS * 86_400_000) } } });
  return saved;
}
