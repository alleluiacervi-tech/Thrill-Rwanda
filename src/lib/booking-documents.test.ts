import { describe, expect, it } from "vitest";
import { canViewDocuments, requiredDocuments, sniffDocument } from "./booking-documents";

describe("requiredDocuments", () => {
  it("asks self-drive hirers for licence and ID", () => {
    expect(requiredDocuments({ withDriver: false })).toEqual(["DRIVING_LICENCE", "ID_DOCUMENT"]);
    expect(requiredDocuments(null)).toEqual(["DRIVING_LICENCE", "ID_DOCUMENT"]);
  });

  it("asks only for ID when the hire comes with a driver", () => {
    expect(requiredDocuments({ withDriver: true })).toEqual(["ID_DOCUMENT"]);
  });
});

describe("sniffDocument", () => {
  const pad = (head: number[]) => new Uint8Array([...head, ...new Array(20).fill(0)]);

  it("recognises PDFs, JPEGs and PNGs from their bytes", () => {
    expect(sniffDocument(pad([...Buffer.from("%PDF-1.7")]))).toBe("application/pdf");
    expect(sniffDocument(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffDocument(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
  });

  it("refuses anything else, whatever it claims to be", () => {
    expect(sniffDocument(pad([...Buffer.from("<html><script>")]))).toBeNull();
    expect(sniffDocument(pad([0x4d, 0x5a]))).toBeNull();
  });
});

describe("canViewDocuments", () => {
  const booking = { customerId: "c1", providerUserId: "p1" };

  it("lets the customer, the booking's provider and admins in", () => {
    expect(canViewDocuments({ id: "c1", role: "CUSTOMER" }, booking)).toBe(true);
    expect(canViewDocuments({ id: "p1", role: "PROVIDER" }, booking)).toBe(true);
    expect(canViewDocuments({ id: "x", role: "ADMIN" }, booking)).toBe(true);
  });

  it("keeps everyone else out, including other providers", () => {
    expect(canViewDocuments({ id: "c2", role: "CUSTOMER" }, booking)).toBe(false);
    expect(canViewDocuments({ id: "p2", role: "PROVIDER" }, booking)).toBe(false);
  });
});
