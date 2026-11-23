import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { localDate, localTime, pdfSafe, renderItineraryPdf, type ItineraryData } from "./itinerary-pdf";

const data: ItineraryData = {
  company: { name: "Thrill Rwanda", email: "desk@example.invalid", phone: "+250 788 000 000", address: "Kigali" },
  reference: "TRQ-1234", pnr: "AB12CD", partner: "Partner Travel", issuedAt: "2027-01-05T08:00:00.000Z", customerName: "Jean Mugisha",
  passengers: [
    { name: "MR JEAN MUGISHA", kind: "Adult", ticketNumber: "1762345678901", status: "ACTIVE" },
    { name: "MS ÉLISE UWASE", kind: "Adult", ticketNumber: "1762345678902", status: "VOIDED" },
  ],
  segments: [
    { airline: "WB", airlineName: "RwandAir", flightNumber: "700", origin: "KGL", originCity: "Kigali", destination: "NBO", destinationCity: "Nairobi", departLocal: "2027-03-04T09:15", arriveLocal: "2027-03-04T10:40", cabin: "ECONOMY", bookingClass: "Y", terminal: "1" },
    ...Array.from({ length: 6 }, (_, i) => ({ airline: "KQ", airlineName: "Kenya Airways", flightNumber: String(500 + i), origin: "NBO", originCity: null, destination: "KGL", destinationCity: null, departLocal: "2027-03-10T09:15", arriveLocal: "2027-03-10T10:40", cabin: "BUSINESS", bookingClass: "", terminal: "" })),
  ],
  baggage: "1 checked bag of 23 kg and 7 kg cabin bag.",
  changeRule: "Changes permitted for a fee of USD 75 plus fare difference.",
  refundRule: "Non-refundable; taxes refundable.",
  fareBasis: "YOW",
};

describe("itinerary PDF", () => {
  it("renders a valid multi-page document with the ticket details", async () => {
    const bytes = await renderItineraryPdf(data);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getTitle()).toBe("E-ticket itinerary TRQ-1234");
  });
  it("prints airport-local times as written and replaces unsupported characters", () => {
    expect(localTime("2027-03-04T09:15")).toBe("09:15");
    expect(localDate("2027-03-04T09:15")).toBe("4 Mar 2027");
    expect(pdfSafe("Kigali → Nairobi ✈")).toBe("Kigali to Nairobi ?");
  });
});
