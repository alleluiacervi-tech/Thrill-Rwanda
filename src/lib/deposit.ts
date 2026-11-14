
export const DEFAULT_DEPOSIT_PERCENT = 30;

export function depositMinor(totalMinor: number, percent: number) {
  if (percent >= 100) return totalMinor;
  const wholeShillings = Math.ceil((totalMinor * percent) / 100 / 100) * 100;
  return Math.min(totalMinor, Math.max(100, wholeShillings));
}

export type NextCharge = { amountMinor: number; kind: "full" | "deposit" | "balance" };

export function nextCharge(totalMinor: number, paidMinor: number, percent: number): NextCharge {
  const outstanding = Math.max(0, totalMinor - paidMinor);
  if (paidMinor > 0) return { amountMinor: outstanding, kind: "balance" };
  const deposit = Math.min(outstanding, depositMinor(totalMinor, percent));
  return { amountMinor: deposit, kind: deposit >= outstanding ? "full" : "deposit" };
}

/** The deposit share saved on a booking when it was made, or the fallback for bookings made before that. */
export function quotedDepositPercent(details: unknown, fallback: number) {
  const saved = (details as { depositPercent?: unknown } | null)?.depositPercent;
  return typeof saved === "number" && saved >= 1 && saved <= 100 ? saved : fallback;
}
