import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderQuotePdf } from "./quote-pdf";
import type { QuoteSnapshot } from "./quote-rules";

const quote: QuoteSnapshot = {
  reference: "TRQ-1234",
  version: 2,
  customerName: "Amina Uwimana",
  preparedBy: "Grace Mukamana",
  company: { name: "Thrill Rwanda", email: "info@example.invalid", phone: "+250 700 000 000", address: "Kigali, Rwanda" },
  issuedAt: "2026-11-18T08:00:00Z",
  expiresAt: "2026-11-25T08:00:00Z",
  paymentDeadline: "2026-11-24T08:00:00Z",
  currency: "USD",
  serviceDescription: "Return flights Kigali – Nairobi for two adults, economy, with 23 kg checked baggage each.",
  travelSummary: "Out 14 December, back 21 December.\nFlexible by one day either side.",
  supplierConditions: "Fare rules: changes allowed for a fee; non-refundable after issue.",
  taxTreatment: "Airport taxes are included in the fare.",
  terms: "Payment by bank transfer by the deadline above. “Smart quotes”, emoji 🚀 and Ŵ are kept safe.",
  items: [
    { kind: "SUPPLIER_FARE", description: "Return fare", quantity: 2, unitMinor: 41000, totalMinor: 82000 },
    { kind: "SERVICE_FEE", description: "Thrill Rwanda service fee", quantity: 1, unitMinor: 3000, totalMinor: 3000 },
  ] as QuoteSnapshot["items"],
  totalMinor: 85000,
};

describe("quotation PDF", () => {
  it("renders a real, titled PDF from an issued quote", async () => {
    const bytes = await renderQuotePdf(quote);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Quotation TRQ-1234 v2");
  });

  it("flows a long quote onto more pages instead of cutting it off", async () => {
    const long = {
      ...quote,
      terms: "Terms paragraph. ".repeat(600),
      items: Array.from({ length: 40 }, (_, i) => ({ ...quote.items[0]!, description: `Line item ${i + 1}` })),
    };
    const doc = await PDFDocument.load(await renderQuotePdf(long));
    expect(doc.getPageCount()).toBeGreaterThan(2);
  });

  it("does not fail on characters the standard fonts lack", async () => {
    await expect(renderQuotePdf({ ...quote, customerName: "Ŵéñdy 李 Test" })).resolves.toBeInstanceOf(Uint8Array);
  });
});
