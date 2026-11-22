import { describe, expect, it } from "vitest";
import { flightEnquirySchema, todayInRwanda } from "./flight-enquiry-schema";

const valid = {
  submissionKey: "b54316cb-06b1-4347-b123-ec4b69fbe125",
  name: "Test Traveller",
  phone: "+250 788 000 001",
  email: "",
  replyChannel: "WHATSAPP",
  origin: "Kigali",
  destination: "Nairobi",
  tripType: "RETURN",
  departureDate: "2028-02-28",
  returnDate: "2028-02-29",
  flexible: false,
  adults: 1,
  children: 0,
  infants: 0,
  cabin: "ECONOMY",
  baggage: "",
  notes: "",
  consent: true,
  website: "",
};
describe("flight enquiries", () => {
  const nextLeg = { origin: "Nairobi", destination: "London", departureDate: "2028-03-01" };
  const multi = { ...valid, tripType: "MULTI_CITY", returnDate: "", additionalLegs: [nextLeg] };
  it("accepts open-jaw and same-day multi-city legs", () => {
    const onward = { origin: "Manchester", destination: "Kigali", departureDate: nextLeg.departureDate };
    expect(flightEnquirySchema.safeParse({ ...multi, nonstopOnly: true, additionalLegs: [nextLeg, onward] }).success).toBe(true);
  });
  it.each([
    { additionalLegs: [] }, { additionalLegs: undefined }, { returnDate: valid.returnDate },
    { additionalLegs: [ { ...nextLeg, departureDate: "2028-02-27" } ] },
    { additionalLegs: [ { ...nextLeg, destination: "NBO" } ] },
    { additionalLegs: Array(6).fill(nextLeg) }, { tripType: "ONE_WAY" },
  ])("rejects inconsistent multi-city itineraries %j", changes => {
    expect(flightEnquirySchema.safeParse({ ...multi, ...changes }).success).toBe(false);
  });
  it("accepts a phone-only guest request and coerces form counts", () => {
    expect(flightEnquirySchema.parse({ ...valid, adults: "2" }).adults).toBe(2);
  });
  it.each([
    { consent: false },
    { origin: "nairobi" },
    { departureDate: "2027-02-29" },
    { departureDate: "2028-02-30" },
    { returnDate: "2028-02-27" },
    { returnDate: "" },
    { adults: 0 },
    { children: -1 },
    { infants: 2 },
    { adults: 20, children: 1 },
    { adults: 1.5 },
    { replyChannel: "EMAIL" },
    { website: "spam" },
    { submissionKey: "short" },
    { phone: "(((((((" },
    { notes: "x".repeat(2001) },
    { tripType: "ONE_WAY" },
    { cabin: "UNKNOWN" },
  ])("rejects invalid or unsafe input %j", (change) => {
    expect(flightEnquirySchema.safeParse({ ...valid, ...change }).success).toBe(
      false,
    );
  });
  it("accepts one-way without a return date", () => {
    expect(
      flightEnquirySchema.safeParse({
        ...valid,
        tripType: "ONE_WAY",
        returnDate: "",
      }).success,
    ).toBe(true);
  });
  it("uses the Rwanda calendar day across UTC midnight", () => {
    expect(todayInRwanda(new Date("2026-11-15T22:30:00Z"))).toBe("2026-11-16");
  });
});
