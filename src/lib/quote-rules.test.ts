import { describe, expect, it } from "vitest";
import {
  quoteInputSchema,
  toQuoteMinor,
  quoteTotals,
  acceptanceSchema,
  type QuoteSnapshot,
} from "./quote-rules";
import { quoteContentHash, renderQuoteHtml } from "./quote-render";
import { canWriteQuotes } from "./quotes";
const valid = {
  reference: "TRQ-test",
  enquiryVersion: 1,
  intentKey: "40563e2d-c44f-40fc-a9c6-739f949f06bb",
  currency: "USD",
  serviceDescription: "Checked flight assistance",
  travelSummary: "Kigali to Nairobi, January 2028",
  supplierConditions: "Checked supplier baggage and fare rules",
  taxTreatment: "Applicable taxes included",
  terms:
    "Payment, changes and refund terms checked with supplier before issue.",
  expiresAt: "2028-01-01T12:00",
  paymentDeadline: "2028-01-01T10:00",
  lines: [
    {
      kind: "SUPPLIER",
      description: "Supplier fare",
      quantity: 2,
      unitPrice: "10.01",
    },
    {
      kind: "SERVICE_FEE",
      description: "Service fee",
      quantity: 1,
      unitPrice: "0.10",
    },
  ],
  checked: true,
  sendEmail: false,
};
describe("quote money, validation and document safety", () => {
  it("computes in integer minor units without rounding errors", () => {
    expect(
      quoteTotals(quoteInputSchema.parse(valid).lines, "USD").totalMinor,
    ).toBe(2012);
    expect(toQuoteMinor("0.10", "USD")).toBe(10);
    expect(toQuoteMinor("1200", "RWF")).toBe(1200);
  });
  it.each(["1.001", "-1", "1e3", "NaN", "100000000.00"])(
    "rejects invalid monetary input %s",
    (amount) => {
      expect(() => toQuoteMinor(amount, "USD")).toThrow();
    },
  );
  it("does not accept fractional RWF units", () => {
    expect(() => toQuoteMinor("1.10", "RWF")).toThrow();
  });
  it.each([
    { checked: false },
    { currency: "XXX" },
    { expiresAt: "2028-02-30T12:00" },
    { lines: [valid.lines[0]] },
    { lines: valid.lines.map((line) => ({ ...line, unitPrice: "0" })) },
  ])("requires safe amounts, breakdown and attestation %j", (change) => {
    expect(quoteInputSchema.safeParse({ ...valid, ...change }).success).toBe(
      false,
    );
  });
  it("requires verified exact-version acceptance", () => {
    expect(
      acceptanceSchema.safeParse({
        reference: "TRQ-test",
        quoteId: valid.intentKey,
        enquiryVersion: 2,
        customerName: "Traveller",
        channel: "EMAIL",
        evidence: "Written acceptance",
        verified: false,
      }).success,
    ).toBe(false);
  });
  it("restricts quotation mutation to active admin or assigned sales", () => {
    const actor = {
      id: "a",
      role: "CUSTOMER",
      staffRole: "SALES",
      isActive: true,
    };
    expect(canWriteQuotes(actor, "a")).toBe(true);
    expect(canWriteQuotes(actor, "b")).toBe(false);
    expect(canWriteQuotes({ ...actor, staffRole: "OPERATIONS" }, "a")).toBe(
      false,
    );
    expect(canWriteQuotes({ ...actor, isActive: false }, "a")).toBe(false);
  });
  it("hashes nested content canonically and escapes untrusted document fields", () => {
    const snapshot: QuoteSnapshot = {
      reference: "TRQ-test",
      version: 1,
      customerName: '<script>alert("x")</script>',
      preparedBy: "Staff",
      company: {
        name: "Test",
        phone: "",
        email: "test@example.invalid",
        address: "Kigali",
      },
      issuedAt: "2026-11-15T10:00:00Z",
      expiresAt: "2028-01-01T10:00:00Z",
      paymentDeadline: "2028-01-01T10:00:00Z",
      currency: "USD",
      serviceDescription: "Flight assistance",
      travelSummary: "Kigali to Nairobi",
      supplierConditions: "Supplier terms",
      taxTreatment: "Tax treatment",
      terms: "Approved terms",
      ...quoteTotals(quoteInputSchema.parse(valid).lines, "USD"),
    };
    expect(renderQuoteHtml(snapshot)).not.toContain("<script>");
    expect(renderQuoteHtml(snapshot)).toContain("&lt;script&gt;");
    expect(quoteContentHash(snapshot)).not.toBe(
      quoteContentHash({
        ...snapshot,
        company: { ...snapshot.company, name: "Different" },
      }),
    );
    expect(quoteContentHash(snapshot)).not.toBe(
      quoteContentHash({
        ...snapshot,
        items: snapshot.items.map((item) => ({
          ...item,
          totalMinor: item.totalMinor + 1,
        })),
      }),
    );
    expect(quoteContentHash(snapshot)).toBe(
      quoteContentHash({
        ...snapshot,
        company: {
          address: "Kigali",
          email: "test@example.invalid",
          phone: "",
          name: "Test",
        },
      }),
    );
  });
});
