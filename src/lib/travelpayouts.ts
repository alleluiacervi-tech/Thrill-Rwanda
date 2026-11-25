/**
 * Travelpayouts (Aviasales Data API v3, prices_for_dates).
 *
 * Cached lowest prices that Aviasales users found in recent searches. One way,
 * economy, cheapest first. Server side only: the token is sent in the
 * X-Access-Token header and never reaches the browser.
 *
 * The cache comes from real searches, so a quiet route can have no price;
 * that route simply stays without one on the board.
 */
import "server-only";

export type TravelpayoutsConfig = { token: string; currency: string; baseUrl: string };

export function travelpayoutsConfig(env: Record<string, string | undefined> = process.env): TravelpayoutsConfig | null {
  const token = env.TRAVELPAYOUTS_TOKEN?.trim();
  if (!token) return null;
  return {
    token,
    currency: (env.TRAVELPAYOUTS_CURRENCY?.trim() || "USD").toUpperCase(),
    baseUrl: env.TRAVELPAYOUTS_API_URL?.trim() || "https://api.travelpayouts.com",
  };
}

/** The airlines on Kigali's routes, so the board says "RwandAir" rather than "WB". */
const AIRLINES: Record<string, string> = {
  WB: "RwandAir",
  KQ: "Kenya Airways",
  ET: "Ethiopian Airlines",
  QR: "Qatar Airways",
  TK: "Turkish Airlines",
  EK: "Emirates",
  FZ: "flydubai",
  SN: "Brussels Airlines",
  KL: "KLM",
  AF: "Air France",
  UR: "Uganda Airlines",
  TC: "Air Tanzania",
  MS: "EgyptAir",
  SA: "South African Airways",
  "4Z": "Airlink",
  PW: "Precision Air",
  JM: "Jambojet",
  BA: "British Airways",
  LH: "Lufthansa",
  LX: "Swiss",
  WY: "Oman Air",
  EY: "Etihad Airways",
  P4: "Air Peace",
  KP: "ASKY Airlines",
};

export type PricesForDates = {
  success?: boolean;
  currency?: string;
  data?: { price?: number; airline?: string; departure_at?: string; transfers?: number; destination?: string; destination_airport?: string }[];
};

export type CachedFare = { departureDate: string; amount: number; airline: string; stops: number };

/** The cheapest usable price in a response: to the place we asked for, departing after today. */
export function cheapestCached(body: PricesForDates, destination: string, now: Date): CachedFare | null {
  if (body.success === false) return null;
  const today = now.toISOString().slice(0, 10);
  let best: CachedFare | null = null;
  for (const item of body.data ?? []) {
    const amount = Number(item.price);
    const departureDate = item.departure_at?.slice(0, 10) ?? "";
    if (!Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) continue;
    if (departureDate <= today) continue;
    const to = item.destination_airport || item.destination;
    if (to && to !== destination) continue;
    if (best && amount >= best.amount) continue;
    const code = item.airline ?? "";
    best = { departureDate, amount, airline: AIRLINES[code] ?? code, stops: Math.max(0, Number(item.transfers) || 0) };
  }
  return best;
}

/** The cheapest cached one-way fare for a month (YYYY-MM). */
export async function cachedCheapest(
  config: TravelpayoutsConfig,
  origin: string,
  destination: string,
  month: string,
  now = new Date(),
): Promise<CachedFare | null> {
  const url = new URL("/aviasales/v3/prices_for_dates", config.baseUrl);
  url.search = new URLSearchParams({
    origin,
    destination,
    departure_at: month,
    one_way: "true",
    direct: "false",
    sorting: "price",
    currency: config.currency.toLowerCase(),
    limit: "30",
    page: "1",
  }).toString();
  const response = await fetch(url, {
    headers: { "X-Access-Token": config.token, accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Travelpayouts answered ${response.status}`);
  const body = (await response.json()) as PricesForDates;
  // The currency we asked for, or the response must say which one it used.
  if (body.currency && body.currency.toUpperCase() !== config.currency) return null;
  return cheapestCached(body, destination, now);
}

/* ------------------------------------------------- price calendar */

export type CalendarDay = { price: number; airline: string; stops: number };

type GroupedPrices = { success?: boolean; currency?: string; data?: Record<string, { price?: number; airline?: string; transfers?: number; departure_at?: string }> };

/** One cheapest price per departure day, after today. Anything malformed is skipped. */
export function calendarDays(body: GroupedPrices, now: Date): Record<string, CalendarDay> {
  if (body.success === false) return {};
  const today = now.toISOString().slice(0, 10);
  const days: Record<string, CalendarDay> = {};
  for (const [key, item] of Object.entries(body.data ?? {})) {
    const date = (item.departure_at ?? key).slice(0, 10);
    const price = Number(item.price);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= today || !Number.isFinite(price) || price <= 0) continue;
    if (days[date] && days[date].price <= price) continue;
    const code = item.airline ?? "";
    days[date] = { price, airline: AIRLINES[code] ?? code, stops: Math.max(0, Number(item.transfers) || 0) };
  }
  return days;
}

/** Cached cheapest one-way price per day for one month (YYYY-MM). */
export async function priceCalendar(config: TravelpayoutsConfig, origin: string, destination: string, month: string, now = new Date()) {
  const url = new URL("/aviasales/v3/grouped_prices", config.baseUrl);
  url.search = new URLSearchParams({
    origin,
    destination,
    departure_at: month,
    group_by: "departure_at",
    direct: "false",
    currency: config.currency.toLowerCase(),
  }).toString();
  const response = await fetch(url, {
    headers: { "X-Access-Token": config.token, accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Travelpayouts answered ${response.status}`);
  const body = (await response.json()) as GroupedPrices;
  if (body.currency && body.currency.toUpperCase() !== config.currency) return {};
  return calendarDays(body, now);
}

/* ------------------------------------------------- popular destinations */

/** Aviasales city codes that stand for an airport on our board. */
const CITY_TO_AIRPORT: Record<string, string> = { PAR: "CDG", LON: "LHR", DXB: "DXB", MIL: "MXP", ROM: "FCO" };

/**
 * Where travellers searching from `origin` want to go, as airport codes.
 * Aviasales returns them unordered and with round-trip prices, so only the
 * places are kept: the board never shows those prices or a rank.
 */
export async function popularDestinations(config: TravelpayoutsConfig, origin: string): Promise<string[]> {
  const url = new URL("/v1/city-directions", config.baseUrl);
  url.search = new URLSearchParams({ origin, currency: config.currency.toLowerCase() }).toString();
  const response = await fetch(url, {
    headers: { "X-Access-Token": config.token, accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Travelpayouts answered ${response.status}`);
  const body = (await response.json()) as { success?: boolean; data?: Record<string, unknown> };
  if (body.success === false) return [];
  return [...new Set(Object.keys(body.data ?? {}).filter((code) => /^[A-Z]{3}$/.test(code)).map((code) => CITY_TO_AIRPORT[code] ?? code))];
}
