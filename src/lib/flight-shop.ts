import "server-only";
import { DuffelError, duffel, logDuffelFailure } from "@/lib/duffel/client";
import { duffelAvailability, type DuffelConfig, type DuffelMode } from "@/lib/duffel/config";
import { summariseOffer, toMinor, type FareResult } from "@/lib/duffel/mapping";
import type { DuffelOffer, DuffelOfferRequest } from "@/lib/duffel/types";
import { db } from "@/lib/db";
import {
  offerRequestBody, pricingProblem, RATE_MAX_AGE_HOURS, SearchLimiter, searchQuery, type FlightPricing, type ShopSearch,
} from "@/lib/flight-shop-rules";

/**
 * Online flight shopping with Duffel: live search and re-pricing for
 * travellers on the public site. Booking itself goes through the same
 * enquiry, quote, payment and ticketing records the desk uses.
 */

export type ShopAvailability =
  | {
      open: true;
      mode: DuffelMode;
      config: DuffelConfig;
      /** Null while no current exchange rate is set: fares then show in dollars and cannot be bought. */
      pricing: FlightPricing | null;
      /** Staff looking before the public can: what still stops a traveller from buying. */
      missing: string[];
      /** The desk member who owns online bookings. */
      ownerId: string | null;
    }
  | { open: false };

/**
 * Who may shop, and on what terms. Travellers need a live Duffel token, the
 * Admin switch on, a current exchange rate and a desk owner. Staff can always
 * look (sandbox included) and are told what is still missing.
 */
export async function shopAvailability(viewer: { role?: string | null; staffRole?: string | null } | null, now = new Date()): Promise<ShopAvailability> {
  const duffel = duffelAvailability();
  if (!duffel.ok) return { open: false };
  const staff = viewer?.role === "ADMIN" || !!viewer?.staffRole;
  const settings = await db.siteSettings.findUnique({
    where: { id: 1 },
    select: { flightOnline: true, flightUsdRwf: true, flightRateSetAt: true, flightFxBufferPercent: true, flightFeeRwf: true, flightOwnerId: true },
  });
  const problem = pricingProblem({ usdRwf: settings?.flightUsdRwf ?? null, rateSetAt: settings?.flightRateSetAt ?? null }, now);
  const pricing: FlightPricing | null =
    !problem && settings?.flightUsdRwf && settings.flightRateSetAt
      ? { usdRwf: settings.flightUsdRwf, rateSetAt: settings.flightRateSetAt, bufferPercent: settings.flightFxBufferPercent, feeRwf: settings.flightFeeRwf }
      : null;
  const missing = [
    duffel.config.mode === "sandbox" ? "Duffel is on a test token, so these fares are not real." : "",
    settings?.flightOnline ? "" : "Online booking is switched off in Admin → Flight fares.",
    problem === "no-rate" ? "No dollar to franc rate is set in Admin → Flight fares." : "",
    problem === "stale-rate" ? `The dollar to franc rate is older than ${RATE_MAX_AGE_HOURS} hours. Set today's in Admin → Flight fares.` : "",
    settings?.flightOwnerId ? "" : "No desk owner is chosen for online bookings in Admin → Flight fares.",
  ].filter(Boolean);
  if (missing.length && !staff) return { open: false };
  return { open: true, mode: duffel.config.mode, config: duffel.config, pricing, missing, ownerId: settings?.flightOwnerId ?? null };
}

export type ShopResults = {
  results: FareResult[];
  /** How many fares Duffel returned before trimming. */
  total: number;
  searchedAt: string;
};

export class ShopError extends Error {}

const RESULTS_SHOWN = 30;
const CACHE_MS = 8 * 60_000;
const cache = new Map<string, { at: number; value: ShopResults }>();
/** 12 fresh searches per visitor in 10 minutes; repeats of a recent search are served from memory. */
const limiter = new SearchLimiter(12, 10 * 60_000);

export async function shopFlights(config: DuffelConfig, search: ShopSearch, visitor: string): Promise<ShopResults> {
  const key = `${config.mode}:${searchQuery(search)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  if (!limiter.allow(visitor)) throw new ShopError("You have searched a lot in the last few minutes. Wait a little, then search again.");

  try {
    const request = await duffel<DuffelOfferRequest>("/air/offer_requests", {
      method: "POST",
      body: offerRequestBody(search),
      query: { return_offers: true, supplier_timeout: 25_000 },
      timeoutMs: 40_000,
      config,
    });
    const offers = [...(request.offers ?? [])]
      // Only fares in a currency we can charge, and never sandbox fares on a live token or the reverse.
      .filter((o) => o.live_mode === undefined || o.live_mode === (config.mode === "live"))
      .sort((a, b) => toMinor(a.total_amount, a.total_currency) - toMinor(b.total_amount, b.total_currency));
    const value: ShopResults = {
      results: offers.slice(0, RESULTS_SHOWN).map(summariseOffer),
      total: offers.length,
      searchedAt: new Date().toISOString(),
    };
    cache.set(key, { at: Date.now(), value });
    if (cache.size > 300) {
      for (const [k, entry] of cache) if (Date.now() - entry.at >= CACHE_MS) cache.delete(k);
    }
    return value;
  } catch (error) {
    if (error instanceof DuffelError) {
      logDuffelFailure("public search", error);
      throw new ShopError(
        error.info.code === "rate_limit_exceeded"
          ? "Fare search is busy. Wait a minute and search again."
          : "We could not reach the airlines just now. Search again in a moment, or send the desk a request.",
      );
    }
    throw error;
  }
}

export type PricedFare = FareResult & {
  /** What the airline needs from each traveller. */
  documentsRequired: boolean;
  passengers: { id: string; type: string | null; age: number | null }[];
  /** Whether Duffel can hold this fare while the traveller pays. */
  holdable: boolean;
  priceGuaranteedUntil: string | null;
  mode: DuffelMode;
};

/** The airline's current offer, or null when it has gone or expired. */
export async function fetchLiveOffer(config: DuffelConfig, offerId: string): Promise<DuffelOffer | null> {
  if (!/^off_[A-Za-z0-9]{10,40}$/.test(offerId)) return null;
  try {
    const offer = await duffel<DuffelOffer>(`/air/offers/${encodeURIComponent(offerId)}`, { query: { return_available_services: false }, config });
    if (new Date(offer.expires_at) <= new Date()) return null;
    if (offer.live_mode !== undefined && offer.live_mode !== (config.mode === "live")) return null;
    return offer;
  } catch (error) {
    if (error instanceof DuffelError) {
      if (error.info.status === 404 || error.info.code === "offer_no_longer_available" || error.info.code === "not_found") return null;
      logDuffelFailure("public price check", error);
      throw new ShopError("We could not confirm this fare with the airline just now. Try again in a moment.");
    }
    throw error;
  }
}

export function pricedFare(offer: DuffelOffer, mode: DuffelMode): PricedFare {
  return {
    ...summariseOffer(offer),
    documentsRequired: !!offer.passenger_identity_documents_required,
    passengers: offer.passengers.map((p) => ({ id: p.id, type: p.type ?? null, age: p.age ?? null })),
    holdable: offer.payment_requirements?.requires_instant_payment === false,
    priceGuaranteedUntil: offer.payment_requirements?.price_guarantee_expires_at ?? null,
    mode,
  };
}

/** The airline's current price for one fare: search prices are not guaranteed. Null when it has gone. */
export async function priceFare(config: DuffelConfig, offerId: string): Promise<PricedFare | null> {
  const offer = await fetchLiveOffer(config, offerId);
  return offer ? pricedFare(offer, config.mode) : null;
}
