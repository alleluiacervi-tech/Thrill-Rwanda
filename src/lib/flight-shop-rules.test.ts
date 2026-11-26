import { describe, expect, it } from "vitest";
import {
  checkoutSchema, kindOf, offerRequestBody, parseShopSearch, pricingProblem, rwfPrice, SearchLimiter, searchQuery, travellersText,
} from "./flight-shop-rules";

const today = "2026-11-26";

describe("online flight search", () => {
  it("shows the empty form when nothing was asked", () => {
    expect(parseShopSearch({}, today)).toEqual({ ok: false, error: null });
  });

  it("reads a return search with defaults", () => {
    const parsed = parseShopSearch({ from: "kgl", to: "NBO", depart: "2026-12-07", return: "2026-12-14" }, today);
    expect(parsed).toEqual({
      ok: true,
      search: { from: "KGL", to: "NBO", depart: "2026-12-07", return: "2026-12-14", adults: 1, children: 0, infants: 0, cabin: "ECONOMY" },
    });
  });

  it("refuses what the airlines would", () => {
    const err = (q: Record<string, string>) => {
      const parsed = parseShopSearch(q, today);
      return parsed.ok ? null : parsed.error;
    };
    expect(err({ from: "KGL", to: "KGL", depart: "2026-12-07" })).toMatch(/different/);
    expect(err({ from: "KGL", to: "NBO", depart: "2026-11-26" })).toMatch(/tomorrow/);
    expect(err({ from: "KGL", to: "NBO", depart: "2027-12-01" })).toMatch(/11 months/);
    expect(err({ from: "KGL", to: "NBO", depart: "2026-12-07", return: "2026-12-01" })).toMatch(/after the departure/);
    expect(err({ from: "KGL", to: "NBO", depart: "2026-12-07", adults: "1", infants: "2" })).toMatch(/adult for every infant/);
    expect(err({ from: "KGL", to: "NBO", depart: "2026-12-07", adults: "8", children: "2" })).toMatch(/up to 9/);
  });

  it("round-trips through the query string", () => {
    const parsed = parseShopSearch({ from: "KGL", to: "DXB", depart: "2026-12-07", adults: "2", children: "1", cabin: "BUSINESS" }, today);
    if (!parsed.ok) throw new Error("expected a search");
    expect(searchQuery(parsed.search)).toBe("from=KGL&to=DXB&depart=2026-12-07&adults=2&children=1&cabin=BUSINESS");
    expect(travellersText(parsed.search)).toBe("2 adults, 1 child");
  });

  it("asks Duffel for both directions and every traveller", () => {
    const body = offerRequestBody({ from: "KGL", to: "NBO", depart: "2026-12-07", return: "2026-12-14", adults: 1, children: 1, infants: 1, cabin: "ECONOMY" });
    expect(body.slices).toEqual([
      { origin: "KGL", destination: "NBO", departure_date: "2026-12-07" },
      { origin: "NBO", destination: "KGL", departure_date: "2026-12-14" },
    ]);
    expect(body.passengers).toEqual([{ type: "adult" }, { type: "child" }, { type: "infant_without_seat" }]);
    expect(body.cabin_class).toBe("economy");
  });

  it("limits fresh searches per visitor", () => {
    const limiter = new SearchLimiter(2, 60_000);
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 1)).toBe(true);
    expect(limiter.allow("a", 2)).toBe(false);
    expect(limiter.allow("b", 2)).toBe(true);
    expect(limiter.allow("a", 60_001)).toBe(true);
  });
});

describe("online flight pricing", () => {
  const pricing = { usdRwf: 1450, rateSetAt: new Date("2026-11-26T06:00:00Z"), bufferPercent: 3, feeRwf: 10_000 };

  it("converts dollars to francs with the buffer, rounds up to 100 and adds the fee per traveller", () => {
    // 238.00 USD × 1450 = 345,100; × 1.03 = 355,453; up to 355,500; + 2 × 10,000.
    expect(rwfPrice({ totalMinor: 23_800, currency: "USD" }, 2, pricing)).toEqual({ fareRwf: 355_500, feeRwf: 20_000, totalRwf: 375_500 });
  });

  it("never rounds down a cent", () => {
    const price = rwfPrice({ totalMinor: 1, currency: "USD" }, 1, { ...pricing, bufferPercent: 0, feeRwf: 0 });
    expect(price?.fareRwf).toBe(100);
  });

  it("refuses a currency it cannot convert", () => {
    expect(rwfPrice({ totalMinor: 23_800, currency: "EUR" }, 1, pricing)).toBeNull();
  });

  it("closes when the rate is missing or old", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    expect(pricingProblem({ usdRwf: null, rateSetAt: null }, now)).toBe("no-rate");
    expect(pricingProblem({ usdRwf: 1450, rateSetAt: new Date("2026-11-22T12:00:00Z") }, now)).toBe("stale-rate");
    expect(pricingProblem({ usdRwf: 1450, rateSetAt: new Date("2026-11-25T12:00:00Z") }, now)).toBeNull();
  });
});

describe("online checkout input", () => {
  const valid = {
    submissionKey: "6f1d0f63-5d8a-4c8e-9b62-3a6f0a1b2c3d",
    offerId: "off_0000AgTj0q2ZxAbC123",
    contactName: "Amina Uwase",
    email: "Amina@Example.com",
    phone: "+250 788 123 456",
    travellers: [{ offerPassengerId: "pas_0000AgTj0q2ZxAbC123", title: "MS", givenNames: "Amina", surname: "Uwase", dateOfBirth: "1990-04-02" }],
    expectedTotalRwf: 375_500,
    accept: true,
  };

  it("normalises the contact details", () => {
    const parsed = checkoutSchema.parse(valid);
    expect(parsed.email).toBe("amina@example.com");
    expect(parsed.phone).toBe("+250788123456");
    expect(parsed.travellers[0].nationality).toBe("");
  });

  it("needs a country code, passport-style names and the terms", () => {
    expect(checkoutSchema.safeParse({ ...valid, phone: "0788123456" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, travellers: [{ ...valid.travellers[0], surname: "Uwasé" }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, accept: false }).success).toBe(false);
  });

  it("maps Duffel's passenger types to the desk's", () => {
    expect(kindOf("adult")).toBe("ADULT");
    expect(kindOf("child")).toBe("CHILD");
    expect(kindOf("infant_without_seat")).toBe("INFANT");
  });
});
