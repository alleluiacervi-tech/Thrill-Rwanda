/**
 * Skyscanner Flights Indicative Prices (Travel API v3).
 *
 * Cached lowest prices, one adult, economy, direct and connecting together.
 * Skyscanner keeps each price for up to 4 days, so every fare is stored with
 * the time Skyscanner found it, not the time we asked. Server side only: the
 * key never reaches the browser (the API refuses browser calls anyway).
 *
 * Docs: https://developers.skyscanner.net/docs/flights-indicative-prices/overview
 * Their usage guidelines require "Powered by Skyscanner" with their logo,
 * linking to skyscanner.net, wherever these prices are shown.
 */
import "server-only";

export type SkyscannerConfig = { key: string; market: string; locale: string; currency: string; baseUrl: string };

export function skyscannerConfig(env: Record<string, string | undefined> = process.env): SkyscannerConfig | null {
  const key = env.SKYSCANNER_API_KEY?.trim();
  if (!key) return null;
  return {
    key,
    market: env.SKYSCANNER_MARKET?.trim() || "UK",
    locale: env.SKYSCANNER_LOCALE?.trim() || "en-GB",
    currency: env.SKYSCANNER_CURRENCY?.trim() || "USD",
    baseUrl: env.SKYSCANNER_API_URL?.trim() || "https://partners.api.skyscanner.net",
  };
}

/** Prices older than this are past Skyscanner's own cache window: not shown. */
export const MAX_QUOTE_AGE_DAYS = 4;

const UNIT: Record<string, number> = {
  PRICE_UNIT_WHOLE: 1,
  PRICE_UNIT_CENTI: 100,
  PRICE_UNIT_MILLI: 1_000,
  PRICE_UNIT_MICRO: 1_000_000,
};

type Ymd = { year: number; month: number; day: number };
type Quote = {
  minPrice?: { amount?: string; unit?: string };
  isDirect?: boolean;
  outboundLeg?: {
    originPlaceId?: string;
    destinationPlaceId?: string;
    departureDateTime?: Ymd;
    quoteCreationTimestamp?: string;
    marketingCarrierId?: string;
  };
};
export type IndicativeResponse = {
  content?: {
    results?: {
      quotes?: Record<string, Quote>;
      places?: Record<string, { iata?: string; name?: string }>;
      carriers?: Record<string, { name?: string }>;
    };
  };
};

export type IndicativeFare = {
  departureDate: string;
  /** Whole currency units, e.g. 216.5 */
  amount: number;
  airline: string;
  /** 0 direct, -1 connecting (Skyscanner does not say how many stops). */
  stops: number;
  foundAt: Date;
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The cheapest usable quote in a response: departing after today, found within
 * Skyscanner's 4-day cache window, to the airport we asked for.
 */
export function cheapestQuote(body: IndicativeResponse, destination: string, now: Date): IndicativeFare | null {
  const results = body.content?.results;
  const today = now.toISOString().slice(0, 10);
  let best: IndicativeFare | null = null;
  for (const quote of Object.values(results?.quotes ?? {})) {
    const leg = quote.outboundLeg;
    const date = leg?.departureDateTime;
    const relation = UNIT[quote.minPrice?.unit ?? ""];
    const raw = Number(quote.minPrice?.amount);
    if (!leg || !date || !relation || !Number.isFinite(raw) || raw <= 0) continue;

    const iata = leg.destinationPlaceId ? results?.places?.[leg.destinationPlaceId]?.iata : undefined;
    if (iata && iata !== destination) continue;

    const departureDate = `${date.year}-${pad(date.month)}-${pad(date.day)}`;
    if (departureDate <= today) continue;

    const foundAt = new Date(leg.quoteCreationTimestamp ?? "");
    if (Number.isNaN(foundAt.getTime()) || foundAt > now) continue;
    if (now.getTime() - foundAt.getTime() > MAX_QUOTE_AGE_DAYS * 86_400_000) continue;

    const amount = raw / relation;
    if (best && amount >= best.amount) continue;
    best = {
      departureDate,
      amount,
      airline: (leg.marketingCarrierId && results?.carriers?.[leg.marketingCarrierId]?.name) || "",
      stops: quote.isDirect ? 0 : -1,
      foundAt,
    };
  }
  return best;
}

/** One month of cached prices, one way from `origin` to `destination`, cheapest usable quote. */
export async function indicativeCheapest(
  config: SkyscannerConfig,
  origin: string,
  destination: string,
  month: { year: number; month: number },
  now = new Date(),
): Promise<IndicativeFare | null> {
  const response = await fetch(`${config.baseUrl}/apiservices/v3/flights/indicative/search`, {
    method: "POST",
    headers: { "x-api-key": config.key, "content-type": "application/json" },
    body: JSON.stringify({
      query: {
        market: config.market,
        locale: config.locale,
        currency: config.currency,
        dateTimeGroupingType: "DATE_TIME_GROUPING_TYPE_BY_DATE",
        queryLegs: [
          {
            originPlace: { queryPlace: { iata: origin } },
            destinationPlace: { queryPlace: { iata: destination } },
            dateRange: { startDate: month, endDate: month },
          },
        ],
      },
    }),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Skyscanner answered ${response.status}`);
  return cheapestQuote((await response.json()) as IndicativeResponse, destination, now);
}
