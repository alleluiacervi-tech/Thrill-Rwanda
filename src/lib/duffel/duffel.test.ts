import { describe, expect, it } from "vitest";
import { duffelAvailability } from "@/lib/duffel/config";
import {
  DuffelInputError,
  durationText,
  internationalPhone,
  labelFor,
  offerToOption,
  orderPassengers,
  searchFromEnquiry,
  summariseOffer,
  ticketsFromOrder,
  toMinor,
  type Traveller,
} from "@/lib/duffel/mapping";
import { optionSchema } from "@/lib/ticketing-rules";
import type { DuffelOffer, DuffelOrder } from "@/lib/duffel/types";

const place = (iata: string) => ({ iata_code: iata, name: iata });
const carrier = { name: "Duffel Airways", iata_code: "ZZ", logo_symbol_url: "https://example.com/zz.svg" };

const offer: DuffelOffer = {
  id: "off_123",
  total_amount: "245.50",
  total_currency: "GBP",
  expires_at: "2030-01-01T10:30:00Z",
  owner: carrier,
  passengers: [
    { id: "pas_a1", type: "adult" },
    { id: "pas_a2", type: "adult" },
    { id: "pas_i1", type: "infant_without_seat" },
  ],
  conditions: {
    change_before_departure: { allowed: true, penalty_amount: "100.00", penalty_currency: "GBP" },
    refund_before_departure: { allowed: false, penalty_amount: null, penalty_currency: null },
  },
  slices: [
    {
      id: "sli_1",
      origin: place("LHR"),
      destination: place("DXB"),
      duration: "PT07H05M",
      fare_brand_name: "Flex",
      segments: [
        {
          id: "seg_1",
          origin: place("LHR"),
          destination: place("DXB"),
          departing_at: "2030-04-24T09:15:00",
          arriving_at: "2030-04-24T19:20:00",
          origin_terminal: "5",
          marketing_carrier: carrier,
          operating_carrier: carrier,
          marketing_carrier_flight_number: "ZZ0123",
          passengers: [{ passenger_id: "pas_a1", cabin_class: "economy", fare_basis_code: "OXZ0RO", baggages: [{ type: "checked", quantity: 1 }, { type: "carry_on", quantity: 1 }] }],
        },
      ],
    },
  ],
};

const adult = (over: Partial<Traveller> = {}): Traveller => ({
  id: "t1", kind: "ADULT", title: "MR", givenNames: "John", surname: "Smith", dateOfBirth: "1985-05-05",
  nationality: "RW", documentNumber: "PC123456", documentExpiry: "2032-01-01", ...over,
});

describe("config", () => {
  it("is off without a token", () => {
    expect(duffelAvailability({})).toMatchObject({ ok: false, reason: "missing" });
  });
  it("accepts a test token as sandbox", () => {
    const r = duffelAvailability({ DUFFEL_ACCESS_TOKEN: "duffel_test_abc" });
    expect(r.ok && r.config.mode).toBe("sandbox");
  });
  it("refuses a live token unless live use is switched on deliberately", () => {
    expect(duffelAvailability({ DUFFEL_ACCESS_TOKEN: "duffel_live_abc" })).toMatchObject({ ok: false, reason: "live-blocked" });
    const on = duffelAvailability({ DUFFEL_ACCESS_TOKEN: "duffel_live_abc", DUFFEL_ALLOW_LIVE: "true" });
    expect(on.ok && on.config.mode).toBe("live");
  });
});

describe("money", () => {
  it("converts to minor units without float drift", () => {
    expect(toMinor("245.50", "GBP")).toBe(24550);
    expect(toMinor("0.10", "USD")).toBe(10);
    expect(toMinor("19", "USD")).toBe(1900);
    expect(toMinor("19.9", "USD")).toBe(1990);
  });
  it("has no minor unit for RWF", () => {
    expect(toMinor("150000", "RWF")).toBe(150000);
  });
  it("never undercharges on a stray extra digit", () => {
    expect(toMinor("1.005", "USD")).toBe(101);
  });
  it("rejects nonsense", () => {
    expect(() => toMinor("12,50", "USD")).toThrow(DuffelInputError);
  });
});

describe("durations", () => {
  it("reads ISO durations", () => {
    expect(durationText("PT07H05M")).toBe("7h 5m");
    expect(durationText("PT45M")).toBe("45m");
    expect(durationText("P1DT2H")).toBe("26h");
    expect(durationText(null)).toBe("");
  });
});

describe("searchFromEnquiry", () => {
  const base = { origin: "Kigali (KGL)", destination: "Nairobi (NBO)", departureDate: "2030-04-24", tripType: "ONE_WAY", adults: 2, children: 1, infants: 1, cabin: "BUSINESS" };
  it("builds a one-way search with the whole party", () => {
    const s = searchFromEnquiry(base, "2030-01-01");
    expect(s.slices).toEqual([{ origin: "KGL", destination: "NBO", departure_date: "2030-04-24" }]);
    expect(s.passengers.map((p) => p.type)).toEqual(["adult", "adult", "child", "infant_without_seat"]);
    expect(s.cabin_class).toBe("business");
    expect(s.max_connections).toBe(1);
  });
  it("adds the way back for a return and honours nonstop", () => {
    const s = searchFromEnquiry({ ...base, tripType: "RETURN", returnDate: "2030-05-01", nonstopOnly: true }, "2030-01-01");
    expect(s.slices[1]).toEqual({ origin: "NBO", destination: "KGL", departure_date: "2030-05-01" });
    expect(s.max_connections).toBe(0);
  });
  it("follows each leg of a multi-city trip", () => {
    const s = searchFromEnquiry({ ...base, tripType: "MULTI_CITY", additionalLegs: [{ origin: "Nairobi (NBO)", destination: "Addis Ababa (ADD)", departureDate: "2030-04-30" }] }, "2030-01-01");
    expect(s.slices.map((x) => `${x.origin}-${x.destination}`)).toEqual(["KGL-NBO", "NBO-ADD"]);
  });
  it("explains a missing airport code in plain words", () => {
    expect(() => searchFromEnquiry({ ...base, origin: "Somewhere" }, "2030-01-01")).toThrow(/airport code/);
  });
  it("refuses dates that have passed", () => {
    expect(() => searchFromEnquiry(base, "2031-01-01")).toThrow(/already passed/);
  });
});

describe("offerToOption", () => {
  it("produces something the existing fare-option form accepts", () => {
    const option = offerToOption(offer, "Duffel Airways Flex");
    expect(option).toMatchObject({ totalMinor: 24550, currency: "GBP", externalId: "off_123", source: "DUFFEL", fareBasis: "OXZ0RO" });
    const parsed = optionSchema.safeParse(option);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });
  it("keeps the flight number without the airline code and times as airport-local", () => {
    const [seg] = offerToOption(offer, "x").segments;
    expect(seg).toMatchObject({ airline: "ZZ", flightNumber: "0123", origin: "LHR", destination: "DXB", departLocal: "2030-04-24T09:15", terminal: "5", cabin: "ECONOMY" });
  });
  it("states baggage and fare rules in words", () => {
    const o = offerToOption(offer, "x");
    expect(o.baggage).toBe("1 checked bag and 1 carry-on per traveller");
    expect(o.changeRule).toContain("fee 100.00 GBP");
    expect(o.refundRule).toContain("Not allowed");
  });
  it("shows a search result summary", () => {
    const r = summariseOffer(offer);
    expect(r).toMatchObject({ id: "off_123", totalMinor: 24550, fareBrand: "Flex" });
    expect(r.slices[0]).toMatchObject({ from: "LHR", to: "DXB", stops: 0, duration: "7h 5m" });
    expect(r.slices[0]!.segments[0]!.flight).toBe("ZZ0123");
  });
  it("numbers a repeated label", () => {
    expect(labelFor(offer, [])).toBe("Duffel Airways Flex");
    expect(labelFor(offer, ["duffel airways flex"])).toBe("Duffel Airways Flex 2");
    expect(labelFor(offer, ["Duffel Airways Flex", "Duffel Airways Flex 2"])).toBe("Duffel Airways Flex 3");
  });
});

describe("orderPassengers", () => {
  const contact = { email: "client@example.com", phone: "+250 788 123 456" };
  const party = [adult(), adult({ id: "t2", givenNames: "Jane", surname: "Smith", title: "MRS" }), adult({ id: "t3", kind: "INFANT", title: "MSTR", givenNames: "Tim", surname: "Smith", dateOfBirth: "2029-06-01" })];

  it("maps travellers onto the fare's own passenger ids and ties the infant to an adult", () => {
    const out = orderPassengers(offer, party, contact);
    expect(out.map((p) => p.id)).toEqual(["pas_a1", "pas_a2", "pas_i1"]);
    expect(out[0]).toMatchObject({ title: "mr", gender: "m", phone_number: "+250788123456", infant_passenger_id: "pas_i1" });
    expect(out[1]).toMatchObject({ title: "mrs", gender: "f" });
    expect(out[2]).toMatchObject({ gender: "m", type: "infant_without_seat" });
  });
  it("refuses when the party no longer matches the fare", () => {
    expect(() => orderPassengers(offer, party.slice(0, 2), contact)).toThrow(/no longer match/);
  });
  it("needs a title to settle gender", () => {
    expect(() => orderPassengers(offer, [adult({ title: "" }), ...party.slice(1)], contact)).toThrow(/Set a title/);
  });
  it("needs an email and an international phone number", () => {
    expect(() => orderPassengers(offer, party, { email: "", phone: "+250788123456" })).toThrow(/email/);
    expect(() => orderPassengers(offer, party, { email: "a@b.com", phone: "0788123456" })).toThrow(/country code/);
  });
  it("sends passport details only when the airline requires them", () => {
    expect(orderPassengers(offer, party, contact)[0]!.identity_documents).toBeUndefined();
    const out = orderPassengers({ ...offer, passenger_identity_documents_required: true }, party, contact);
    expect(out[0]!.identity_documents).toEqual([{ type: "passport", unique_identifier: "PC123456", issuing_country_code: "RW", expires_on: "2032-01-01" }]);
  });
});

describe("phone numbers", () => {
  it("accepts international formats and never guesses a country", () => {
    expect(internationalPhone("+250 (788) 123-456")).toBe("+250788123456");
    expect(internationalPhone("00250788123456")).toBe("+250788123456");
    expect(() => internationalPhone("0788123456")).toThrow(DuffelInputError);
  });
});

describe("ticketsFromOrder", () => {
  const order: DuffelOrder = {
    id: "ord_1", booking_reference: "ABC123", total_amount: "245.50", total_currency: "GBP",
    passengers: [{ id: "pas_a1", given_name: "John", family_name: "Smith" }, { id: "pas_a2", given_name: "Jane", family_name: "Smith" }],
    documents: [
      { type: "electronic_ticket", unique_identifier: "176-2345678901", passenger_ids: ["pas_a1"] },
      { type: "electronic_ticket", unique_identifier: "not-a-number", passenger_ids: ["pas_a2"] },
    ],
  };
  const ours = [{ id: "t1", givenNames: "John", surname: "Smith" }, { id: "t2", givenNames: "Jane", surname: "Smith" }];
  it("matches by name, normalises the number, and reports who is still missing", () => {
    const r = ticketsFromOrder(order, ours);
    expect(r.tickets).toEqual([{ passengerId: "t1", ticketNumber: "1762345678901" }]);
    expect(r.missing).toEqual(["Jane Smith"]);
  });
});
