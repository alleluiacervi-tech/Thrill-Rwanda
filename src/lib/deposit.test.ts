import { describe, expect, it } from "vitest";
import { DEFAULT_DEPOSIT_PERCENT, depositMinor, nextCharge, quotedDepositPercent } from "@/lib/deposit";

/**
 * What a customer is charged, and when. A mistake here is money, so these
 * cover the edges: rounding, the 100% case, and part-paid bookings.
 */

const KSH = (shillings: number) => shillings * 100;

describe("depositMinor", () => {
  it("takes the percentage of the total", () => {
    expect(depositMinor(KSH(84_000), 30)).toBe(KSH(25_200));
  });

  it("rounds up to a whole shilling, never leaving stray cents", () => {
    // 30% of 1,001 is 300.30 shillings.
    const deposit = depositMinor(KSH(1_001), 30);
    expect(deposit).toBe(KSH(301));
    expect(deposit % 100).toBe(0);
  });

  it("charges the full total at 100%", () => {
    expect(depositMinor(KSH(84_000), 100)).toBe(KSH(84_000));
  });

  it("never exceeds the total, however the rounding falls", () => {
    expect(depositMinor(KSH(10), 99)).toBeLessThanOrEqual(KSH(10));
  });

  it("asks for at least one shilling", () => {
    expect(depositMinor(KSH(5), 1)).toBeGreaterThanOrEqual(100);
  });
});

describe("nextCharge", () => {
  it("asks for the deposit first", () => {
    expect(nextCharge(KSH(84_000), 0, 30)).toEqual({ amountMinor: KSH(25_200), kind: "deposit" });
  });

  it("asks for the balance once a deposit is paid", () => {
    expect(nextCharge(KSH(84_000), KSH(25_200), 30)).toEqual({
      amountMinor: KSH(58_800),
      kind: "balance",
    });
  });

  it("calls it a full payment when the deposit is the whole total", () => {
    expect(nextCharge(KSH(84_000), 0, 100)).toEqual({ amountMinor: KSH(84_000), kind: "full" });
  });

  it("asks for nothing once the total is covered", () => {
    expect(nextCharge(KSH(84_000), KSH(84_000), 30).amountMinor).toBe(0);
  });

  it("never asks for a negative amount after an overpayment", () => {
    expect(nextCharge(KSH(84_000), KSH(90_000), 30).amountMinor).toBe(0);
  });
});

describe("quotedDepositPercent", () => {
  it("honours the percentage saved on the booking", () => {
    expect(quotedDepositPercent({ depositPercent: 50 }, 30)).toBe(50);
  });

  it("falls back for bookings made before the setting existed", () => {
    expect(quotedDepositPercent({}, 30)).toBe(30);
    expect(quotedDepositPercent(null, 30)).toBe(30);
  });

  it("ignores nonsense in the saved details", () => {
    for (const bad of [0, -5, 101, "30", null, undefined, {}]) {
      expect(quotedDepositPercent({ depositPercent: bad }, DEFAULT_DEPOSIT_PERCENT)).toBe(
        DEFAULT_DEPOSIT_PERCENT,
      );
    }
  });
});
