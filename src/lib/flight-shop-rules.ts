import { z } from "zod";
import type { DuffelPassengerRequest } from "@/lib/duffel/types";

/**
 * Online flight shopping: what a traveller may search for, as plain rules.
 * No network and no database, so everything here is tested directly.
 */

export const CABINS = ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"] as const;
export type Cabin = (typeof CABINS)[number];
export const CABIN_LABEL: Record<Cabin, string> = {
  ECONOMY: "Economy",
  PREMIUM_ECONOMY: "Premium economy",
  BUSINESS: "Business",
  FIRST: "First",
};

/** The most travellers one online booking may hold; bigger parties go to the desk. */
export const MAX_ONLINE_TRAVELLERS = 9;
/** How far ahead airlines sell. */
const MAX_DAYS_AHEAD = 355;

const code = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Choose an airport from the list.");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");
const count = (min: number) => z.coerce.number().int().min(min).max(MAX_ONLINE_TRAVELLERS);

export const shopSearchSchema = z
  .object({
    from: code,
    to: code,
    depart: day,
    return: day.optional(),
    adults: count(1).default(1),
    children: count(0).default(0),
    infants: count(0).default(0),
    cabin: z.enum(CABINS).default("ECONOMY"),
  })
  .superRefine((s, ctx) => {
    if (s.from === s.to) ctx.addIssue({ code: "custom", path: ["to"], message: "Choose a destination different from where you fly from." });
    if (s.adults + s.children + s.infants > MAX_ONLINE_TRAVELLERS) {
      ctx.addIssue({ code: "custom", path: ["adults"], message: `Online booking takes up to ${MAX_ONLINE_TRAVELLERS} travellers. For more, send the desk a request.` });
    }
    if (s.infants > s.adults) ctx.addIssue({ code: "custom", path: ["infants"], message: "Each infant flies on an adult's lap, so add an adult for every infant." });
    if (s.return && s.return < s.depart) ctx.addIssue({ code: "custom", path: ["return"], message: "The return must be on or after the departure." });
  });

export type ShopSearch = z.infer<typeof shopSearchSchema>;

export type ParsedSearch = { ok: true; search: ShopSearch } | { ok: false; error: string } | { ok: false; error: null };

/** Reads a search from the page's query. No query at all is not an error: the page shows the empty form. */
export function parseShopSearch(query: Record<string, string | string[] | undefined>, today: string): ParsedSearch {
  const one = (key: string) => {
    const value = query[key];
    const text = Array.isArray(value) ? value[0] : value;
    return text?.trim() ? text.trim() : undefined;
  };
  if (!one("from") && !one("to") && !one("depart")) return { ok: false, error: null };
  const parsed = shopSearchSchema.safeParse({
    from: one("from"),
    to: one("to"),
    depart: one("depart"),
    return: one("return"),
    adults: one("adults"),
    children: one("children"),
    infants: one("infants"),
    cabin: one("cabin"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the search." };
  const s = parsed.data;
  if (s.depart <= today) return { ok: false, error: "Online booking starts from tomorrow. For a flight today, call the desk." };
  const latest = new Date(`${today}T00:00:00Z`);
  latest.setUTCDate(latest.getUTCDate() + MAX_DAYS_AHEAD);
  if (s.depart > latest.toISOString().slice(0, 10) || (s.return && s.return > latest.toISOString().slice(0, 10))) {
    return { ok: false, error: "Airlines sell up to about 11 months ahead. Choose an earlier date." };
  }
  return { ok: true, search: s };
}

/** The same search, as the query string the page reads, so a result can link back to it. */
export function searchQuery(s: ShopSearch): string {
  const params = new URLSearchParams({ from: s.from, to: s.to, depart: s.depart });
  if (s.return) params.set("return", s.return);
  if (s.adults !== 1) params.set("adults", String(s.adults));
  if (s.children) params.set("children", String(s.children));
  if (s.infants) params.set("infants", String(s.infants));
  if (s.cabin !== "ECONOMY") params.set("cabin", s.cabin);
  return params.toString();
}

/** Duffel's offer request for the search. One connection at most keeps journeys sensible from Kigali. */
export function offerRequestBody(s: ShopSearch) {
  const slices = [{ origin: s.from, destination: s.to, departure_date: s.depart }];
  if (s.return) slices.push({ origin: s.to, destination: s.from, departure_date: s.return });
  const passengers: DuffelPassengerRequest[] = [
    ...Array.from({ length: s.adults }, () => ({ type: "adult" })),
    // The same passenger types the desk's search sends, so booking maps travellers the same way.
    ...Array.from({ length: s.children }, () => ({ type: "child" })),
    ...Array.from({ length: s.infants }, () => ({ type: "infant_without_seat" })),
  ];
  return { slices, passengers, cabin_class: s.cabin.toLowerCase(), max_connections: 1 };
}

export function travellersText(s: Pick<ShopSearch, "adults" | "children" | "infants">) {
  const part = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : "");
  return [part(s.adults, "adult", "adults"), part(s.children, "child", "children"), part(s.infants, "infant", "infants")].filter(Boolean).join(", ");
}

/* ------------------------------------------------------------ rate limiting */

/**
 * A small sliding window per visitor: each live search costs the business
 * against Duffel's search-to-booking ratio, so one visitor cannot run hundreds.
 * Kept in memory: the site runs as a single app container.
 */
export class SearchLimiter {
  private hits = new Map<string, number[]>();
  constructor(private limit: number, private windowMs: number) {}

  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 5_000) {
      for (const [k, times] of this.hits) if (!times.some((t) => now - t < this.windowMs)) this.hits.delete(k);
    }
    return true;
  }
}

/* ------------------------------------------------------------------ pricing */

export type FlightPricing = {
  /** Rwandan francs per US dollar. */
  usdRwf: number;
  rateSetAt: Date;
  bufferPercent: number;
  feeRwf: number;
};

/** A rate older than this closes online booking until the desk sets today's. */
export const RATE_MAX_AGE_HOURS = 72;

export type PricingProblem = "no-rate" | "stale-rate";

export function pricingProblem(p: { usdRwf: number | null; rateSetAt: Date | null }, now = new Date()): PricingProblem | null {
  if (!p.usdRwf || !p.rateSetAt) return "no-rate";
  if (now.getTime() - p.rateSetAt.getTime() > RATE_MAX_AGE_HOURS * 3_600_000) return "stale-rate";
  return null;
}

export type RwfPrice = { fareRwf: number; feeRwf: number; totalRwf: number };

/**
 * What the traveller pays, in francs, for a Duffel fare in US cents: the
 * converted fare with the buffer, rounded up to 100 francs, plus the fee per
 * traveller. Null for any other currency, which online booking cannot charge.
 */
export function rwfPrice(fare: { totalMinor: number; currency: string }, travellers: number, pricing: FlightPricing): RwfPrice | null {
  if (fare.currency !== "USD" || !Number.isSafeInteger(fare.totalMinor) || fare.totalMinor <= 0) return null;
  // Whole-number arithmetic: cents × rate × (100 + buffer), over 100 for cents and 100 for the percent.
  const raw = Math.ceil((fare.totalMinor * pricing.usdRwf * (100 + pricing.bufferPercent)) / 10_000);
  const fareRwf = Math.ceil(raw / 100) * 100;
  const feeRwf = pricing.feeRwf * travellers;
  return { fareRwf, feeRwf, totalRwf: fareRwf + feeRwf };
}


/* ----------------------------------------------------------------- checkout */

const personName = z
  .string()
  .trim()
  .min(1, "Enter each name exactly as in the passport")
  .max(60)
  .regex(/^[A-Za-z][A-Za-z' -]*$/, "Use letters as printed in the passport, without accents or digits");

export const ONLINE_TITLES = ["MR", "MS", "MRS", "MISS"] as const;

export const checkoutTravellerSchema = z.object({
  /** Duffel's id for this seat in the offer. */
  offerPassengerId: z.string().regex(/^pas_[A-Za-z0-9]{10,40}$/),
  title: z.enum(ONLINE_TITLES, { error: "Choose a title for each traveller" }),
  givenNames: personName,
  surname: personName,
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter each traveller's date of birth"),
  nationality: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Choose the passport's country").or(z.literal("")).default(""),
  documentNumber: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5,20}$/, "Enter the passport number").or(z.literal("")).default(""),
  documentExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
});

export const checkoutSchema = z.object({
  submissionKey: z.string().uuid(),
  offerId: z.string().regex(/^off_[A-Za-z0-9]{10,40}$/),
  contactName: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter an email address for the e-ticket").max(254),
  phone: z
    .string()
    .trim()
    .transform((raw) => raw.replace(/[\s().-]/g, "").replace(/^00/, "+"))
    .pipe(z.string().regex(/^\+\d{8,15}$/, "Enter the phone number with its country code, for example +250788123456")),
  travellers: z.array(checkoutTravellerSchema).min(1).max(MAX_ONLINE_TRAVELLERS),
  /** The price the traveller saw, so a change since then is caught before anything is created. */
  expectedTotalRwf: z.coerce.number().int().positive(),
  accept: z.literal(true, { error: "Accept the fare rules and booking terms to continue" }),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Duffel's passenger type for the desk's traveller kind. */
export function kindOf(type: string | null): "ADULT" | "CHILD" | "INFANT" {
  return type === "infant_without_seat" ? "INFANT" : type === "child" ? "CHILD" : "ADULT";
}
