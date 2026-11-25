import { aviasalesLink, aviasalesLinks } from "@/lib/aviasales";
import { db } from "@/lib/db";
import { allDestinations, KIGALI, type Destination } from "@/lib/flight-destinations";
import type { FareSource } from "@/lib/fare-sources";
import { getFareSource, POPULAR_KEY } from "@/lib/fare-watch";
import { bestDeals, cheapestFares, formatFare, HISTORY_DAYS, manualFares, trendingDestinations, type FareRow } from "@/lib/fare-board-rules";

/** One row on the board, ready to render: no Dates, so it crosses to the client as is. */
export type BoardFare = {
  place: Destination;
  /** "2026-12-22" */
  date: string;
  price: string;
  airline: string;
  stops: number;
  /** "18% below this route's 30-day average", for deals only. */
  note?: string;
  /** Aviasales' search for this route and day, with our partner marker. Aviasales prices only, never the desk's. */
  bookUrl?: string;
};

export type FareBoard = {
  cheap: BoardFare[];
  deals: BoardFare[];
  trending: { place: Destination; rank: number; fare?: BoardFare }[];
  /** Where travellers search to fly from Kigali (Aviasales, unranked), for Trending until our own requests can rank it. */
  popular: { place: Destination; fare?: BoardFare }[];
  /** When the newest fare on the board was found, "2026-11-24". */
  checkedOn: string | null;
  /** Where the prices came from, for the footnote and any credit the source requires. */
  source: FareSource;
};

const EMPTY: FareBoard = { cheap: [], deals: [], trending: [], popular: [], checkedOn: null, source: "off" };
const POPULAR_MAX_AGE_DAYS = 7;
const byCode = new Map(allDestinations.map((place) => [place.code, place]));

function toBoard(row: FareRow, note?: string, bookUrl?: string | null): BoardFare | null {
  const place = byCode.get(row.destination);
  if (!place) return null;
  return {
    ...(bookUrl ? { bookUrl } : {}),
    place,
    date: row.departureDate.toISOString().slice(0, 10),
    price: formatFare(row.totalMinor, row.currency),
    airline: row.airline,
    stops: row.stops,
    note,
  };
}

/** The board's data. Never throws: a database problem shows the plain destination list instead. */
export async function getFareBoard(now = new Date()): Promise<FareBoard> {
  try {
    const since = new Date(now.getTime() - HISTORY_DAYS * 86_400_000);
    // Switched off, no price shows at all. Otherwise the desk's own fares, plus
    // the fetched ones from the source chosen in Admin → Flight fares.
    const source = await getFareSource();
    const select = { destination: true, departureDate: true, currency: true, totalMinor: true, airline: true, stops: true, checkedAt: true, validUntil: true, dealNote: true } as const;
    const fetching = source !== "off" && source !== "manual";
    const [deskRows, rows, enquiries, insight] = await Promise.all([
      source === "off" ? Promise.resolve([]) : db.fareSnapshot.findMany({ where: { source: "manual", validUntil: { gte: now } }, select }),
      fetching ? db.fareSnapshot.findMany({ where: { source, checkedAt: { gte: since } }, select }) : Promise.resolve([]),
      db.enquiry.findMany({ where: { service: "FLIGHT", createdAt: { gte: since } }, select: { details: true } }),
      source === "off" ? Promise.resolve(null) : db.fareInsight.findUnique({ where: { key: POPULAR_KEY } }),
    ]);

    // The desk's fares stand on their own word and win on their route; fetched
    // ones go through the freshness and deal rules.
    const desk = manualFares(deskRows, now);
    const deskCodes = new Set(desk.cheap.map((row) => row.destination));
    const cheapRows = [...desk.cheap, ...cheapestFares(rows, now).filter((row) => !deskCodes.has(row.destination))];
    // Aviasales found these prices, so a traveller who would rather book there
    // can, through our partner link. The desk's own fares are sold by the desk.
    const links = source === "travelpayouts" ? aviasalesLinks() : null;
    const bookUrl = (row: FareRow, placement: string) =>
      links && !deskCodes.has(row.destination)
        ? aviasalesLink(links, { origin: KIGALI.code, destination: row.destination, date: row.departureDate.toISOString().slice(0, 10), placement })
        : null;
    const cheap = cheapRows.map((row) => toBoard(row, undefined, bookUrl(row, "fares_cheap"))).filter((row): row is BoardFare => row !== null);
    const deals = [
      ...desk.deals.map((row) => toBoard(row, row.dealNote ?? undefined)),
      ...bestDeals(rows, now)
        .filter((deal) => !deskCodes.has(deal.destination))
        .map((deal) => toBoard(deal, `${Math.round(deal.below * 100)}% below this route's ${HISTORY_DAYS}-day average`, bookUrl(deal, "fares_deals"))),
    ].filter((row): row is BoardFare => row !== null);
    const fareFor = new Map(cheap.map((fare) => [fare.place.code, fare]));
    const trending = trendingDestinations(enquiries.map((e) => e.details))
      .map((trend) => byCode.get(trend.code))
      .filter((place): place is Destination => place !== undefined)
      .map((place, i) => ({ place, rank: i + 1, fare: fareFor.get(place.code) }));
    const popularData = insight?.data as { codes?: unknown; fetchedAt?: unknown } | undefined;
    const popularFresh =
      typeof popularData?.fetchedAt === "string" && now.getTime() - Date.parse(popularData.fetchedAt) < POPULAR_MAX_AGE_DAYS * 86_400_000;
    // Places on our board only, the ones with a fare first.
    const popular = (popularFresh && Array.isArray(popularData?.codes) ? (popularData.codes as unknown[]) : [])
      .map((code) => (typeof code === "string" ? byCode.get(code) : undefined))
      .filter((place): place is Destination => place !== undefined && place.code !== "KGL")
      .map((place) => ({ place, fare: fareFor.get(place.code) }))
      .sort((a, b) => Number(!!b.fare) - Number(!!a.fare))
      .slice(0, 8);
    const newest = cheapRows.reduce<Date | null>((max, row) => (!max || row.checkedAt > max ? row.checkedAt : max), null);

    return { cheap: cheap.slice(0, 8), deals: deals.slice(0, 8), trending, popular, checkedOn: newest?.toISOString().slice(0, 10) ?? null, source };
  } catch {
    return EMPTY;
  }
}
