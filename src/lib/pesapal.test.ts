import { describe, expect, it } from "vitest";
import { mapMethod, mapStatus, newMerchantReference } from "@/lib/pesapal";

/**
 * Reading Pesapal's answer. Misreading a code either loses a payment that
 * arrived or marks a failed one as paid, so every branch is pinned here.
 */

describe("mapStatus", () => {
  it("maps Pesapal's codes onto our statuses", () => {
    expect(mapStatus(1)).toBe("SUCCEEDED");
    expect(mapStatus(2)).toBe("FAILED");
    expect(mapStatus(3)).toBe("REFUNDED");
    expect(mapStatus(0)).toBe("PENDING");
  });

  it("treats anything unexpected as still pending, never as paid", () => {
    for (const code of [undefined, 99, -1]) {
      expect(mapStatus(code)).toBe("PENDING");
    }
  });
});

describe("mapMethod", () => {
  it("recognises cards whatever the brand", () => {
    for (const m of ["VISA", "visa", "MasterCard", "CARD"]) {
      expect(mapMethod(m)).toBe("CARD");
    }
  });

  it("recognises a bank transfer", () => {
    expect(mapMethod("BANK TRANSFER")).toBe("BANK_TRANSFER");
  });

  it("falls back to M-Pesa, which is the default for mobile payments", () => {
    for (const m of ["MPESA", "Airtel Money", "", null, undefined]) {
      expect(mapMethod(m)).toBe("MPESA");
    }
  });
});

describe("newMerchantReference", () => {
  it("keeps the booking reference readable inside it", () => {
    expect(newMerchantReference("SW-GPBG5C")).toMatch(/^SW-GPBG5C-[0-9A-F]{6}$/);
  });

  it("differs every time, so a retry is a new Pesapal order", () => {
    const refs = new Set(Array.from({ length: 50 }, () => newMerchantReference("SW-GPBG5C")));
    expect(refs.size).toBe(50);
  });
});
