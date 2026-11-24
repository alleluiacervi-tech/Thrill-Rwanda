import { db } from "@/lib/db";
import { allDestinations, type Destination } from "@/lib/flight-destinations";
import type { FareSource } from "@/lib/fare-sources";
import { getFareSource } from "@/lib/fare-watch";
import { bestDeals, cheapestFares, formatFare, HISTORY_DAYS, trendingDestinations, type FareRow } from "@/lib/fare-board-rules";

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
};

export type FareBoard = {
  cheap: BoardFare[];
  deals: BoardFare[];
  trending: { place: Destination; rank: number; fare?: BoardFare }[];
  /** When the newest fare on the board was found, "2026-11-24". */
  checkedOn: string | null;
  /** Where the prices came from, for the footnote and any credit the source requires. */
  source: FareSource;
};

const EMPTY: FareBoard = { cheap: [], deals: [], trending: [], checkedOn: null, source: "off" };
const byCode = new Map(allDestinations.map((place) => [place.code, place]));

function toBoard(row: FareRow, note?: string): BoardFare | null {
  const place = byCode.get(row.destination);
  if (!place) return null;
  return {
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
    // Only the source chosen in Admin → Fares; switched off, no price shows at all.
    const source = await getFareSource();
    const [rows, enquiries] = await Promise.all([
      source === "off"
        ? Promise.resolve([])
        : db.fareSnapshot.findMany({
        where: { source, checkedAt: { gte: since } },
        select: { destination: true, departureDate: true, currency: true, totalMinor: true, airline: true, stops: true, checkedAt: true },
      }),
      db.enquiry.findMany({ where: { service: "FLIGHT", createdAt: { gte: since } }, select: { details: true } }),
    ]);

    const cheapRows = cheapestFares(rows, now);
    const cheap = cheapRows.map((row) => toBoard(row)).filter((row): row is BoardFare => row !== null);
    const deals = bestDeals(rows, now)
      .map((deal) => toBoard(deal, `${Math.round(deal.below * 100)}% below this route's ${HISTORY_DAYS}-day average`))
      .filter((row): row is BoardFare => row !== null);
    const fareFor = new Map(cheap.map((fare) => [fare.place.code, fare]));
    const trending = trendingDestinations(enquiries.map((e) => e.details))
      .map((trend) => byCode.get(trend.code))
      .filter((place): place is Destination => place !== undefined)
      .map((place, i) => ({ place, rank: i + 1, fare: fareFor.get(place.code) }));
    const newest = cheapRows.reduce<Date | null>((max, row) => (!max || row.checkedAt > max ? row.checkedAt : max), null);

    return { cheap: cheap.slice(0, 8), deals: deals.slice(0, 8), trending, checkedOn: newest?.toISOString().slice(0, 10) ?? null, source };
  } catch {
    return EMPTY;
  }
}
