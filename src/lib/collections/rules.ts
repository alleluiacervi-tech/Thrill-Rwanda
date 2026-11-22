export const COLLECTION_METHODS = ["MOMO", "AIRTEL_MONEY", "CARD"] as const;
export type CollectionMethod = (typeof COLLECTION_METHODS)[number];
export const OPEN_COLLECTIONS = ["CREATED", "INITIATED", "PENDING", "REQUIRES_ACTION", "RECONCILIATION_REQUIRED", "DISPUTED"];
export const COLLECTION_METHOD_LABEL: Record<CollectionMethod, string> = {
  MOMO: "MTN Mobile Money",
  AIRTEL_MONEY: "Airtel Money",
  CARD: "Visa or Mastercard",
};

export class CollectionError extends Error {}

export function payerPhone(raw: string, method: CollectionMethod) {
  const number = raw.replace(/[\s().-]/g, "");
  const rwanda = number.match(/^(?:\+?250|0)?(7\d{8})$/);
  if (rwanda) return `250${rwanda[1]}`;
  if (method === "CARD" && /^\+?[1-9]\d{7,14}$/.test(number)) return number.replace(/^\+/, "");
  return null;
}

export function rwfInteger(value: unknown) {
  if (typeof value === "string" && /^\d+(?:\.0+)?$/.test(value)) value = Number(value);
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 2_000_000_000 ? value : null;
}

export function invoiceCharge(total: number, paid: number, deposit: number) {
  const remaining = Math.max(0, total - paid);
  const depositBalance = Math.max(0, deposit - paid);
  return Math.min(remaining, depositBalance || remaining);
}

export const paymentStatusLabel: Record<string, string> = {
  CREATED: "Checking payment request",
  INITIATED: "Awaiting authorization",
  PENDING: "Processing payment",
  REQUIRES_ACTION: "Authorization required",
  SUCCESSFUL: "Payment verified",
  FAILED: "Payment unsuccessful",
  CANCELLED: "Payment cancelled",
  EXPIRED: "Payment expired",
  RECONCILIATION_REQUIRED: "Payment under review",
  PARTIALLY_REFUNDED: "Partially refunded",
  REFUNDED: "Refunded",
  DISPUTED: "Payment disputed",
};
