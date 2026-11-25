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
