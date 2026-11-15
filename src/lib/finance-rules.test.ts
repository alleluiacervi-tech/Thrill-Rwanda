import { describe, expect, it } from "vitest";
import {
  canFinance,
  canOperate,
  commitmentBalance,
  financeCommandSchema,
  financialSummary,
  money,
  referenceKey,
  refundBalance,
  type FinancialData,
} from "./finance-rules";
const base: FinancialData = {
  currency: "USD",
  customerChargeMinor: 100000,
  serviceFeeMinor: 10000,
  taxReserveMinor: 5000,
  requiredFundingMinor: 30000,
  reviewed: false,
  commitments: [{ id: "supplier", costMinor: 60000 }],
  refunds: [],
  entries: [],
};
const entry = (
  kind: string,
  amountMinor: number,
  commitmentId: string | null = null,
  refundId: string | null = null,
) => ({ kind, amountMinor, commitmentId, refundId });
describe("off-site financial balances and access", () => {
  it("does not treat gross collections or unreviewed costs as profit", () => {
    const summary = financialSummary({
      ...base,
      entries: [entry("RECEIPT", 100000)],
    });
    expect(summary.collections).toBe(100000);
    expect(summary.serviceFees).toBe(10000);
    expect(summary.contribution).toBeNull();
  });
  it("separates fees, supplier costs, tax reserve, charges and external commission", () => {
    const summary = financialSummary({
      ...base,
      reviewed: true,
      entries: [
        entry("RECEIPT", 100000),
        entry("PAYMENT_CHARGE", 2000),
        entry("COMMISSION", 1000),
      ],
    });
    expect(summary.contribution).toBe(34000);
    expect(summary.cashPosition).toBe(99000);
    expect(summary.supplierDue).toBe(60000);
  });
  it("credits partial payments and equal-and-opposite reversals without deleting history", () => {
    const summary = financialSummary({
      ...base,
      entries: [entry("RECEIPT", 50000), entry("RECEIPT", -20000)],
    });
    expect(summary.collections).toBe(30000);
    expect(summary.customerBalance).toBe(70000);
    expect(summary.funded).toBe(true);
  });
  it("keeps refund obligations separate from payouts and customer credit", () => {
    const summary = financialSummary({
      ...base,
      customerChargeMinor: 10000,
      refunds: [{ id: "refund", amountMinor: 40000 }],
      entries: [
        entry("RECEIPT", 50000),
        entry("REFUND_SETTLEMENT", 15000, null, "refund"),
      ],
    });
    expect(summary.refundDue).toBe(25000);
    expect(summary.customerCredit).toBe(25000);
    expect(summary.unallocatedCustomerCredit).toBe(0);
  });
  it("reopens a refund balance when a payout is corrected", () => {
    expect(
      refundBalance(
        {
          ...base,
          refunds: [{ id: "r", amountMinor: 100 }],
          entries: [
            entry("REFUND_SETTLEMENT", 100, null, "r"),
            entry("REFUND_SETTLEMENT", -40, null, "r"),
          ],
        },
        "r",
      ).due,
    ).toBe(40);
  });
  it("tracks supplier credits and recoveries independently", () => {
    const data = {
      ...base,
      entries: [
        entry("SUPPLIER_PAYMENT", 60000, "supplier"),
        entry("SUPPLIER_CREDIT", 20000, "supplier"),
        entry("SUPPLIER_RECOVERY", 5000, "supplier"),
      ],
    };
    expect(commitmentBalance(data, "supplier")).toEqual({
      cost: 40000,
      paid: 55000,
      due: 0,
      recoveryDue: 15000,
    });
  });
  it("does not offset one supplier's recoverable against another supplier's payable", () => {
    const summary = financialSummary({
      ...base,
      commitments: [
        { id: "a", costMinor: 100 },
        { id: "b", costMinor: 200 },
      ],
      entries: [entry("SUPPLIER_PAYMENT", 150, "a")],
    });
    expect(summary.supplierDue).toBe(200);
    expect(summary.supplierRecoveryDue).toBe(50);
  });
  it("allows negative operational contribution rather than concealing supplier losses", () => {
    expect(
      financialSummary({ ...base, reviewed: true, customerChargeMinor: 10000 })
        .contribution,
    ).toBe(-55000);
  });
  it("uses currency-specific integer units and rejects invalid money", () => {
    expect(money("1.25", "USD")).toBe(125);
    expect(money("125", "RWF")).toBe(125);
    expect(() => money("1.25", "RWF")).toThrow();
    expect(() => money("0", "USD")).toThrow();
    expect(money("0", "USD", true)).toBe(0);
  });
  it("normalizes statement identity without accepting invisible or control characters", () => {
    expect(referenceKey(" bank-001 ")).toBe(referenceKey("BANK-001"));
    expect(() => referenceKey("BANK\u200b001")).toThrow();
  });
  it("requires fresh active finance/operations permissions", () => {
    const actor = {
      id: "u",
      role: "CUSTOMER",
      staffRole: "FINANCE",
      isActive: true,
    };
    expect(canFinance(actor)).toBe(true);
    expect(canFinance({ ...actor, staffRole: "SALES" })).toBe(false);
    expect(canFinance({ ...actor, isActive: false })).toBe(false);
    expect(canOperate({ ...actor, staffRole: "OPERATIONS" }, "u")).toBe(true);
    expect(
      canOperate({ ...actor, staffRole: "OPERATIONS" }, "someone-else"),
    ).toBe(false);
  });
  it("requires verification and rejects unknown operations", () => {
    expect(financeCommandSchema.safeParse({}).success).toBe(false);
  });
});
