import { unstable_cache } from "next/cache";
import { getFareSource } from "@/lib/fare-watch";
import { priceCalendar, travelpayoutsConfig, type CalendarDay } from "@/lib/travelpayouts";

// Cheapest one-way price per day for the search form's calendar
// (src/components/booking/flight-search-controls.tsx). Guide prices from
// Aviasales searches; nothing when fares are switched off in Admin → Flight fares.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS = 3;
const CODE = /^[A-Z]{3}$/;

// Shared across visitors and kept 6 hours: one Travelpayouts call per route and month.
const monthPrices = unstable_cache(
  async (from: string, to: string, month: string): Promise<Record<string, CalendarDay>> => {
    const config = travelpayoutsConfig();
    if (!config) return {};
    try {
      return await priceCalendar(config, from, to, month);
    } catch {
      return {};
    }
  },
  ["fare-calendar"],
  { revalidate: 21_600 },
);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const from = (params.get("from") ?? "KGL").toUpperCase();
  const to = (params.get("to") ?? "").toUpperCase();
  const config = travelpayoutsConfig();
  if (!CODE.test(from) || !CODE.test(to) || from === to || !config || (await getFareSource()) === "off") {
    return Response.json({ currency: null, days: {} }, { headers: { "cache-control": "no-store" } });
  }
  const now = new Date();
  const months = Array.from({ length: MONTHS }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1)).toISOString().slice(0, 7));
  const parts = await Promise.all(months.map((month) => monthPrices(from, to, month)));
  const today = now.toISOString().slice(0, 10);
  const days = Object.fromEntries(parts.flatMap((part) => Object.entries(part)).filter(([date]) => date > today));
  return Response.json({ currency: config.currency, days }, { headers: { "cache-control": "public, max-age=1800" } });
}
