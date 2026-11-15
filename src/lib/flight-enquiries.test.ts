import { beforeEach, describe, expect, it, vi } from "vitest";
const { tx } = vi.hoisted(() => ({
  tx: {
    $queryRaw: vi.fn(),
    enquiry: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn() },
    legalDocument: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({
  db: { $transaction: (fn: (value: typeof tx) => unknown) => fn(tx) },
}));
import { saveFlightEnquiry } from "./flight-enquiries";
import { flightEnquirySchema } from "./flight-enquiry-schema";
const input = flightEnquirySchema.parse({
  submissionKey: "b54316cb-06b1-4347-b123-ec4b69fbe125",
  name: "Test Traveller",
  phone: "+250788000001",
  email: "",
  replyChannel: "PHONE",
  origin: "Kigali",
  destination: "Nairobi",
  tripType: "ONE_WAY",
  departureDate: "2028-01-01",
  returnDate: "",
  flexible: false,
  adults: 1,
  children: 0,
  infants: 0,
  cabin: "ECONOMY",
  baggage: "",
  notes: "",
  consent: true,
  website: "",
});
beforeEach(() => {
  vi.resetAllMocks();
  tx.enquiry.findUnique.mockResolvedValue(null);
  tx.enquiry.count.mockResolvedValue(0);
  tx.legalDocument.findUnique.mockResolvedValue({ version: 3 });
  tx.enquiry.create.mockImplementation(async ({ data }) => data);
});
describe("durable flight capture", () => {
  it("persists notice evidence and a reference without creating a booking or sending email", async () => {
    const result = await saveFlightEnquiry(input);
    expect(result.reference).toMatch(/^TRQ-/);
    expect(tx.enquiry.create.mock.calls[0][0].data).toMatchObject({
      privacyVersion: 3,
      consentVersion: "flight-enquiry-v1",
      email: null,
    });
  });
  it("returns the original reference after retry without another insert", async () => {
    const first = await saveFlightEnquiry(input);
    tx.enquiry.findUnique.mockResolvedValue(
      tx.enquiry.create.mock.calls[0][0].data,
    );
    expect(await saveFlightEnquiry(input)).toEqual(first);
    expect(tx.enquiry.create).toHaveBeenCalledTimes(1);
  });
  it("rejects token reuse with changed details instead of disclosing another reference", async () => {
    tx.enquiry.findUnique.mockResolvedValue({
      fingerprint: "different",
      reference: "private",
    });
    await expect(saveFlightEnquiry(input)).rejects.toThrow("different details");
    expect(tx.enquiry.create).not.toHaveBeenCalled();
  });
  it("limits repeated new requests for a contact", async () => {
    tx.enquiry.count.mockResolvedValue(5);
    await expect(saveFlightEnquiry(input)).rejects.toThrow("Several requests");
    expect(tx.enquiry.create).not.toHaveBeenCalled();
  });
  it("propagates a failed save so the action cannot claim success", async () => {
    tx.enquiry.create.mockRejectedValue(new Error("database unavailable"));
    await expect(saveFlightEnquiry(input)).rejects.toThrow(
      "database unavailable",
    );
  });
});
