import { z } from "zod";
import { QUOTE_CURRENCIES, toQuoteMinor } from "@/lib/quote-rules";
import type { EnquiryActor } from "@/lib/enquiry-workflow";
export const FINANCE_ACTIONS = [
  "INSTRUCTIONS",
  "RECORD_RECEIPT",
  "ALLOCATE_RECEIPT",
  "RECONCILE_RECEIPT",
  "AMEND_RECEIPT",
  "RELEASE_ALLOCATION",
  "REVERSE_RECEIPT",
  "COMMIT_SUPPLIER",
  "SUPPLIER_DEBIT",
  "SUPPLIER_CREDIT",
  "SUPPLIER_PAYMENT",
  "SUPPLIER_RECOVERY",
  "PAYMENT_CHARGE",
  "COMMISSION",
  "REVERSE_ENTRY",
  "REVIEW",
  "APPROVE_REFUND",
  "AMEND_REFUND",
  "SETTLE_REFUND",
  "RELEASE_PROCESSING",
  "CONFIRM_SUPPLIER",
  "CONFIRM_SERVICE",
  "COMPLETE_SERVICE",
  "LINK_BOOKING",
] as const;
export const METHODS = ["BANK_TRANSFER", "CASH", "MOBILE_MONEY"] as const;
export const SUPPLIER_CATEGORIES = [
  "FLIGHT",
  "STAY",
  "TRANSPORT",
  "TOUR",
  "VENUE",
  "OTHER",
] as const;
const uuid = z.string().uuid().or(z.literal(""));
export const financeCommandSchema = z.object({
  verified: z.literal(true, {
    error: "Verify supporting records and authority before saving",
  }),
  action: z.enum(FINANCE_ACTIONS),
  reference: z.string().min(4).max(80),
  expectedVersion: z.coerce.number().int().min(0),
  intentKey: z.string().uuid(),
  currency: z.enum(QUOTE_CURRENCIES),
  amount: z.string().trim().max(30).default(""),
  secondaryAmount: z.string().trim().max(30).default(""),
  feeAmount: z.string().trim().max(30).default(""),
  taxAmount: z.string().trim().max(30).default(""),
  thresholdAmount: z.string().trim().max(30).default(""),
  targetId: uuid.default(""),
  supplierId: uuid.default(""),
  accountId: uuid.default(""),
  externalRef: z.string().trim().max(160).default(""),
  payer: z.string().trim().max(120).default(""),
  label: z.string().trim().max(200).default(""),
  instructions: z.string().trim().max(3000).default(""),
  date: z.string().max(30).default(""),
  bookingRef: z.string().trim().max(80).default(""),
  evidence: z
    .string()
    .trim()
    .min(10, "Record supporting evidence (at least 10 characters)")
    .max(3000),
});
export type FinanceCommand = z.infer<typeof financeCommandSchema>;
export class FinanceError extends Error {}
export function canFinance(actor: EnquiryActor) {
  return (
    actor.isActive && (actor.role === "ADMIN" || actor.staffRole === "FINANCE")
  );
}
export function canOperate(actor: EnquiryActor, ownerId: string | null) {
  return (
    actor.isActive &&
    (actor.role === "ADMIN" ||
      (actor.staffRole === "OPERATIONS" && ownerId === actor.id))
  );
}
export function referenceKey(value: string) {
  const key = value.normalize("NFKC").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._:/-]{1,159}$/.test(key))
    throw new FinanceError(
      "Enter a statement/order reference using letters, digits and . _ : / - (2–160 characters).",
    );
  return key;
}
export function money(value: string, currency: string, allowZero = false) {
  let amount: number;
  try {
    amount = toQuoteMinor(value, currency);
  } catch {
    throw new FinanceError(
      "Enter a valid amount in this case's currency; RWF uses whole units.",
    );
  }
  if (!allowZero && amount === 0)
    throw new FinanceError("Amount must be greater than zero.");
  return amount;
}
export type FinancialData = {
  currency: string;
  customerChargeMinor: number;
  serviceFeeMinor: number;
  taxReserveMinor: number;
  requiredFundingMinor: number;
  reviewed: boolean;
  entries: {
    kind: string;
    amountMinor: number;
    commitmentId: string | null;
    refundId: string | null;
  }[];
  commitments: { id: string; costMinor: number }[];
  refunds: { id: string; amountMinor: number }[];
};
export function financialSummary(data: FinancialData) {
  const sum = (kind: string) =>
    data.entries
      .filter((e) => e.kind === kind)
      .reduce((n, e) => n + e.amountMinor, 0);
  const collections = sum("RECEIPT");
  const customerRefunds = sum("REFUND_SETTLEMENT");
  const refundObligations =
    data.refunds.reduce((n, r) => n + r.amountMinor, 0) +
    sum("REFUND_ADJUSTMENT");
  const supplierCost =
    data.commitments.reduce((n, c) => n + c.costMinor, 0) +
    sum("SUPPLIER_DEBIT") -
    sum("SUPPLIER_CREDIT");
  const supplierNetPaid = sum("SUPPLIER_PAYMENT") - sum("SUPPLIER_RECOVERY");
  const charges = sum("PAYMENT_CHARGE"),
    commissions = sum("COMMISSION");
  const netCustomerCash = collections - customerRefunds;
  const customerCredit = Math.max(
    0,
    netCustomerCash - data.customerChargeMinor,
  );
  const refundDue = refundObligations - customerRefunds;
  const values = {
    collections,
    customerRefunds,
    refundObligations,
    refundDue,
    supplierCost,
    supplierNetPaid,
    charges,
    commissions,
    netCustomerCash,
    customerCredit,
    customerBalance: Math.max(0, data.customerChargeMinor - netCustomerCash),
    unallocatedCustomerCredit: Math.max(0, customerCredit - refundDue),
    supplierDue: data.commitments.reduce(
      (total, c) => total + commitmentBalance(data, c.id).due,
      0,
    ),
    supplierRecoveryDue: data.commitments.reduce(
      (total, c) => total + commitmentBalance(data, c.id).recoveryDue,
      0,
    ),
    serviceFees: data.serviceFeeMinor,
    passThroughReserve: data.taxReserveMinor,
    contribution: data.reviewed
      ? data.customerChargeMinor -
        data.taxReserveMinor -
        supplierCost -
        charges +
        commissions
      : null,
    supplierSpreadAndOtherRetained: data.reviewed
      ? data.customerChargeMinor -
        data.serviceFeeMinor -
        data.taxReserveMinor -
        supplierCost
      : null,
    cashPosition: netCustomerCash - supplierNetPaid - charges + commissions,
    funded:
      data.requiredFundingMinor > 0 &&
      netCustomerCash >= data.requiredFundingMinor,
  };
  for (const value of Object.values(values))
    if (typeof value === "number" && !Number.isSafeInteger(value))
      throw new FinanceError(
        "Ledger totals exceed the supported integer range.",
      );
  return values;
}
export function commitmentBalance(data: FinancialData, id: string) {
  const item = data.commitments.find((c) => c.id === id);
  if (!item) throw new FinanceError("Supplier commitment not found.");
  const entries = data.entries.filter((e) => e.commitmentId === id);
  const sum = (kind: string) =>
    entries
      .filter((e) => e.kind === kind)
      .reduce((n, e) => n + e.amountMinor, 0);
  const cost = item.costMinor + sum("SUPPLIER_DEBIT") - sum("SUPPLIER_CREDIT");
  const paid = sum("SUPPLIER_PAYMENT") - sum("SUPPLIER_RECOVERY");
  return {
    cost,
    paid,
    due: Math.max(0, cost - paid),
    recoveryDue: Math.max(0, paid - cost),
  };
}
export function refundBalance(data: FinancialData, id: string) {
  const refund = data.refunds.find((r) => r.id === id);
  if (!refund) throw new FinanceError("Refund obligation not found.");
  const settled = data.entries
    .filter((e) => e.refundId === id && e.kind === "REFUND_SETTLEMENT")
    .reduce((n, e) => n + e.amountMinor, 0);
  return {
    approved:
      refund.amountMinor +
      data.entries
        .filter((e) => e.refundId === id && e.kind === "REFUND_ADJUSTMENT")
        .reduce((n, e) => n + e.amountMinor, 0),
    settled,
    due:
      refund.amountMinor +
      data.entries
        .filter((e) => e.refundId === id && e.kind === "REFUND_ADJUSTMENT")
        .reduce((n, e) => n + e.amountMinor, 0) -
      settled,
  };
}
export type FinanceActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
};
export const supplierSchema = z
  .object({
    verified: z.literal(true),
    intentKey: z.string().uuid(),
    id: uuid.default(""),
    version: z.coerce.number().int().min(0).default(0),
    name: z.string().trim().min(2).max(160),
    category: z.enum(SUPPLIER_CATEGORIES),
    contact: z.string().trim().min(5).max(500),
    escalation: z.string().trim().min(5).max(500),
    serviceArea: z.string().trim().min(2).max(500),
    deliverables: z.string().trim().min(10).max(2000),
    limitations: z.string().trim().min(5).max(2000),
    commercialTerms: z.string().trim().min(10).max(3000),
    currencies: z.array(z.enum(QUOTE_CURRENCIES)).min(1),
    agreementEvidence: z.string().trim().min(10).max(2000),
    performanceNotes: z.string().trim().max(2000).default(""),
    nextReviewAt: z.string().default(""),
    publicationAllowed: z.boolean(),
    approvedWording: z.string().trim().max(1000).default(""),
    status: z.enum(["DRAFT", "APPROVED", "SUSPENDED"]),
  })
  .refine((s) => !s.publicationAllowed || s.approvedWording.length >= 10, {
    message: "Record the exact authorized publication wording",
    path: ["approvedWording"],
  });
export type SupplierInput = z.infer<typeof supplierSchema>;
export const accountSchema = z.object({
  verified: z.literal(true),
  intentKey: z.string().uuid(),
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  method: z.enum(METHODS),
  currency: z.enum(QUOTE_CURRENCIES),
  instructions: z.string().trim().min(10).max(2000),
  approvalEvidence: z.string().trim().min(10).max(2000),
});
