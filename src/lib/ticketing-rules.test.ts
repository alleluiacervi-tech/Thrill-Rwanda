import { describe, expect, it } from "vitest";
import {
  canMoveTicketing, countdown, deadlineUrgency, documentsExpireOn, enquiryParty, issueSchema, nextServiceStatuses, optionSchema,
  passengerProblems, passengerSchema, pnrSchema, segmentSchema, serviceCompletionProblems, ticketNumberSchema, ticketProblems,
  validateSegmentOrder, type PassengerInput,
} from "./ticketing-rules";

const adult = (extra: Partial<PassengerInput> = {}): PassengerInput => ({
  kind: "ADULT", title: "MR", givenNames: "Jean", surname: "Mugisha", dateOfBirth: "1985-04-10", nationality: "RW",
  documentNumber: "PC123456", documentExpiry: "2031-01-01", ...extra,
});
const segment = {
  airline: "WB", flightNumber: "700", origin: "KGL", destination: "NBO",
  departLocal: "2027-03-04T09:15", arriveLocal: "2027-03-04T10:40", cabin: "ECONOMY", bookingClass: "Y", terminal: "",
};

describe("ticketing status machine", () => {
  it("only allows the documented moves", () => {
    expect(canMoveTicketing("OPTIONS", "AWAITING_PAYMENT")).toBe(true);
    expect(canMoveTicketing("OPTIONS", "TICKETING")).toBe(false);
    expect(canMoveTicketing("AWAITING_PAYMENT", "READY_TO_TICKET")).toBe(true);
    expect(canMoveTicketing("TICKETING", "ISSUED")).toBe(true);
    expect(canMoveTicketing("ISSUED", "CANCELLED")).toBe(false);
    expect(canMoveTicketing("CLOSED", "OPTIONS")).toBe(false);
  });
});

describe("deadlines", () => {
  const now = new Date("2027-01-01T12:00:00Z");
  it("grades urgency", () => {
    expect(deadlineUrgency(null, now)).toBe("none");
    expect(deadlineUrgency(new Date("2027-01-01T11:00:00Z"), now)).toBe("overdue");
    expect(deadlineUrgency(new Date("2027-01-01T15:00:00Z"), now)).toBe("critical");
    expect(deadlineUrgency(new Date("2027-01-02T08:00:00Z"), now)).toBe("soon");
    expect(deadlineUrgency(new Date("2027-01-04T12:00:00Z"), now)).toBe("ok");
  });
  it("words the countdown", () => {
    expect(countdown(new Date("2027-01-03T15:30:00Z"), now)).toBe("2d 3h left");
    expect(countdown(new Date("2027-01-01T13:30:00Z"), now)).toBe("1h 30m left");
    expect(countdown(new Date("2027-01-01T11:15:00Z"), now)).toBe("45m overdue");
  });
});

describe("identifiers", () => {
  it("normalises PNRs and ticket numbers", () => {
    expect(pnrSchema.parse(" ab12cd ")).toBe("AB12CD");
    expect(pnrSchema.safeParse("AB1").success).toBe(false);
    expect(ticketNumberSchema.parse("176 2345678901")).toBe("1762345678901");
    expect(ticketNumberSchema.parse("176-2345678901")).toBe("1762345678901");
    expect(ticketNumberSchema.safeParse("17623456789").success).toBe(false);
    expect(ticketNumberSchema.safeParse("17623456789ab").success).toBe(false);
  });
});

describe("fare options and flights", () => {
  it("validates segments", () => {
    expect(segmentSchema.safeParse(segment).success).toBe(true);
    expect(segmentSchema.safeParse({ ...segment, destination: "KGL" }).success).toBe(false);
    expect(segmentSchema.safeParse({ ...segment, origin: "KG" }).success).toBe(false);
    expect(segmentSchema.safeParse({ ...segment, departLocal: "2027-03-04 09:15" }).success).toBe(false);
  });
  it("checks the order of local dates", () => {
    expect(() => validateSegmentOrder([segment, { ...segment, departLocal: "2027-03-05T08:00", arriveLocal: "2027-03-05T11:00" }])).not.toThrow();
    expect(() => validateSegmentOrder([segment, { ...segment, departLocal: "2027-03-03T08:00", arriveLocal: "2027-03-03T11:00" }])).toThrow(/before the previous/);
    expect(() => validateSegmentOrder([{ departLocal: "2027-03-05T09:00", arriveLocal: "2027-03-04T10:00" }])).toThrow(/lands before/);
  });
  it("requires a positive total and at least one flight", () => {
    const option = { label: "Smart", currency: "usd", totalMinor: 85000, validUntil: "2027-01-02T10:00:00Z", segments: [segment] };
    expect(optionSchema.parse(option).currency).toBe("USD");
    expect(optionSchema.safeParse({ ...option, totalMinor: 0 }).success).toBe(false);
    expect(optionSchema.safeParse({ ...option, segments: [] }).success).toBe(false);
  });
});

describe("travellers", () => {
  it("accepts passport-style names only", () => {
    expect(passengerSchema.safeParse(adult()).success).toBe(true);
    expect(passengerSchema.safeParse(adult({ givenNames: "Jéan" })).success).toBe(false);
    expect(passengerSchema.safeParse(adult({ surname: "M4" })).success).toBe(false);
    expect(passengerSchema.safeParse(adult({ documentNumber: "x" })).success).toBe(false);
  });
  it("flags age, passport and duplicate problems", () => {
    const trip = "2027-03-04";
    expect(passengerProblems([adult()], trip)).toEqual([]);
    expect(passengerProblems([adult({ documentExpiry: "2027-02-01" })], trip)[0]).toMatch(/expires before the trip/);
    expect(passengerProblems([adult({ documentExpiry: "2027-06-01" })], trip)[0]).toMatch(/within six months/);
    expect(passengerProblems([adult(), adult()], trip)[0]).toMatch(/duplicates/);
    expect(passengerProblems([adult({ kind: "CHILD", dateOfBirth: "2010-01-01" })], trip)[0]).toMatch(/must be booked as an adult/);
    expect(passengerProblems([adult({ kind: "ADULT", dateOfBirth: "2026-06-01" })], trip)[0]).toMatch(/must be booked as an infant/);
    expect(passengerProblems([adult({ kind: "INFANT", dateOfBirth: "2026-06-01", givenNames: "Baby" })], trip).join(" ")).toMatch(/needs an accompanying adult/);
    expect(passengerProblems([adult({ kind: "INFANT", dateOfBirth: "2024-01-01", givenNames: "Baby" }), adult({ givenNames: "Mum" })], trip).join(" ")).toMatch(/2 or older/);
  });
  it("compares the list with the requested party", () => {
    expect(passengerProblems([adult()], null, { adults: 2, children: 0, infants: 0 })[0]).toMatch(/2 adults; 1 listed/);
    expect(passengerProblems([adult()], null, { adults: 1, children: 0, infants: 0 })).toEqual([]);
  });
  it("reads the party from enquiry details", () => {
    expect(enquiryParty({ adults: 2, children: "1", infants: 0 })).toEqual({ adults: 2, children: 1, infants: 0 });
    expect(enquiryParty({})).toBeNull();
  });
});

describe("issuing tickets", () => {
  const ids = ["6f6b1c0e-6d34-4d4f-a4a5-1a0b7f0a0001", "6f6b1c0e-6d34-4d4f-a4a5-1a0b7f0a0002"];
  it("needs a ticket for every traveller, each unique", () => {
    const t = (passengerId: string, ticketNumber: string) => ({ passengerId, ticketNumber });
    expect(ticketProblems([t(ids[0]!, "1762345678901"), t(ids[1]!, "1762345678902")], ids)).toEqual([]);
    expect(ticketProblems([t(ids[0]!, "1762345678901")], ids)[0]).toMatch(/Every traveller/);
    expect(ticketProblems([t(ids[0]!, "1762345678901"), t(ids[1]!, "1762345678901")], ids)[0]).toMatch(/twice/);
    expect(ticketProblems([t("6f6b1c0e-6d34-4d4f-a4a5-1a0b7f0a0009", "1762345678901"), t(ids[0]!, "1762345678902"), t(ids[1]!, "1762345678903")], ids).join(" ")).toMatch(/not on this file/);
  });
  it("requires evidence of the partner's confirmation", () => {
    const base = { pnr: "ab12cd", partner: "Partner Ltd", tickets: [{ passengerId: ids[0], ticketNumber: "176 2345678901" }] };
    expect(issueSchema.safeParse({ ...base, evidence: "short" }).success).toBe(false);
    expect(issueSchema.parse({ ...base, evidence: "Partner portal shows OK status for all tickets" }).pnr).toBe("AB12CD");
  });
});

describe("after-sales", () => {
  it("moves requests along a fixed path", () => {
    expect(nextServiceStatuses("REQUESTED")).toContain("QUOTED");
    expect(nextServiceStatuses("APPROVED")).toEqual(["COMPLETED", "REJECTED"]);
    expect(nextServiceStatuses("COMPLETED")).toEqual([]);
  });
  it("needs evidence, and an amount for refunds, to complete", () => {
    expect(serviceCompletionProblems("VOID", { evidence: "x", refundMinor: 0 })).toHaveLength(1);
    expect(serviceCompletionProblems("VOID", { evidence: "Partner confirmed void", refundMinor: 0 })).toEqual([]);
    expect(serviceCompletionProblems("REFUND", { evidence: "Partner confirmed refund", refundMinor: 0 })).toHaveLength(1);
    expect(serviceCompletionProblems("REFUND", { evidence: "Partner confirmed refund", refundMinor: 5000 })).toEqual([]);
  });
});

describe("retention", () => {
  it("clears documents 30 days after the last flight", () => {
    expect(documentsExpireOn("2027-03-04").toISOString().slice(0, 10)).toBe("2027-04-03");
  });
});
