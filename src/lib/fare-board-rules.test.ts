import { describe, expect, it, vi } from "vitest";

// The daily check talks to Duffel and the database; these tests cover only its pure parts.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
import { bestDeals, cheapestFares, formatFare, trendingDestinations, type FareRow } from "./fare-board-rules";
import { cheapestOffer, fareWatchState, plannedSearches, WATCHED } from "./fare-watch";
import type { DuffelOffer } from "./duffel/types";

const now = new Date("2026-11-24T08:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const fare = (destination: string, usd: number, checked: number, extra: Partial<FareRow> = {}): FareRow => ({
  destination,
  departureDate: new Date("2026-12-22T00:00:00Z"),
  currency: "USD",
  totalMinor: usd * 100,
  airline: "RwandAir",
  stops: 0,
  checkedAt: daysAgo(checked),
  ...extra,
});

describe("cheapest fares", () => {
  it("keeps the lowest fresh fare per destination, cheapest first", () => {
    const rows = [fare("NBO", 300, 0), fare("NBO", 215, 1), fare("DXB", 520, 0), fare("EBB", 180, 2), fare("LHR", 90, 10)];
    expect(cheapestFares(rows, now).map((r) => [r.destination, r.totalMinor / 100])).toEqual([
      ["EBB", 180],
      ["NBO", 215],
      ["DXB", 520],
    ]);
  });

  it("shows nothing until three destinations have a fare", () => {
    expect(cheapestFares([fare("NBO", 215, 0), fare("DXB", 520, 0)], now)).toEqual([]);
  });

  it("drops fares whose departure date has passed", () => {
    const past = { departureDate: new Date("2026-11-20T00:00:00Z") };
    expect(cheapestFares([fare("NBO", 1, 0, past), fare("DXB", 2, 0), fare("EBB", 3, 0), fare("ADD", 4, 0)], now).map((r) => r.destination)).toEqual(["DXB", "EBB", "ADD"]);
  });
});

describe("best deals", () => {
  const history = (destination: string, usd: number) => [5, 8, 11, 14, 20].map((d) => fare(destination, usd, d));

  it("flags a fare at least 10% under the route's own 30-day average", () => {
    const rows = [...history("NBO", 300), fare("NBO", 240, 0), ...history("DXB", 500), fare("DXB", 480, 0)];
    const deals = bestDeals(rows, now);
    expect(deals.map((d) => d.destination)).toEqual(["NBO"]);
    expect(Math.round(deals[0].below * 100)).toBe(20);
  });

  it("needs five earlier checks before calling anything a deal", () => {
    const rows = [fare("NBO", 300, 5), fare("NBO", 300, 8), fare("NBO", 100, 0)];
    expect(bestDeals(rows, now)).toEqual([]);
  });

  it("ignores history older than 30 days", () => {
    const rows = [...[31, 35, 40, 45, 50].map((d) => fare("NBO", 900, d)), fare("NBO", 300, 0)];
    expect(bestDeals(rows, now)).toEqual([]);
  });
});

describe("trending destinations", () => {
  const ask = (destination: string) => ({ destination });

  it("is empty until there are ten flight enquiries", () => {
    expect(trendingDestinations(Array(9).fill(ask("Nairobi (NBO)")))).toEqual([]);
  });

  it("counts destination codes, skips Kigali, unknown text and one-offs", () => {
    const details = [
      ...Array(4).fill(ask("Dubai (DXB)")),
      ...Array(3).fill(ask("Nairobi (NBO)")),
      ask("Kigali (KGL)"),
      ask("somewhere"),
      ask("Lagos (LOS)"),
      null,
    ];
    expect(trendingDestinations(details)).toEqual([
      { code: "DXB", requests: 4 },
      { code: "NBO", requests: 3 },
    ]);
  });
});

describe("formatting and the daily check", () => {
  it("rounds fares up to whole units, never down", () => {
    expect(formatFare(21_501, "USD")).toBe("US$216");
    expect(formatFare(250_000, "RWF").replace(/\s/g, " ")).toBe("RWF 250,000");
  });

  it("only runs with the switch on and a live Duffel token", () => {
    expect(fareWatchState({}).ok).toBe(false);
    expect(fareWatchState({ FARE_WATCH_ENABLED: "true", DUFFEL_ACCESS_TOKEN: "duffel_test_x" })).toMatchObject({ ok: false });
    expect(fareWatchState({ FARE_WATCH_ENABLED: "true", DUFFEL_ACCESS_TOKEN: "duffel_live_x" }).ok).toBe(false);
    expect(fareWatchState({ FARE_WATCH_ENABLED: "true", DUFFEL_ACCESS_TOKEN: "duffel_live_x", DUFFEL_ALLOW_LIVE: "true" }).ok).toBe(true);
  });

  it("checks every watched destination once a day, 2 to 9 weeks out, on a moving date", () => {
    const today = plannedSearches(now);
    const tomorrow = plannedSearches(new Date(now.getTime() + 86_400_000));
    expect(today.map((s) => s.destination)).toEqual([...WATCHED]);
    for (const s of today) {
      const days = (Date.parse(s.departureDate) - Date.parse("2026-11-24")) / 86_400_000;
      expect(days).toBeGreaterThanOrEqual(14);
      expect(days).toBeLessThanOrEqual(63);
    }
    expect(tomorrow[0].departureDate).not.toBe(today[0].departureDate);
  });

  it("picks the cheapest real offer and never a sandbox one", () => {
    const offer = (amount: string, extra: Partial<DuffelOffer> = {}) =>
      ({ id: amount, total_amount: amount, total_currency: "USD", owner: { name: "X", iata_code: "WB" }, slices: [], passengers: [], expires_at: "", ...extra }) as DuffelOffer;
    expect(cheapestOffer([offer("300.00"), offer("215.50"), offer("100.00", { live_mode: false }), offer("90.00", { owner: { name: "Duffel Airways", iata_code: "ZZ" } })])?.total_amount).toBe("215.50");
    expect(cheapestOffer([])).toBeNull();
  });
});
