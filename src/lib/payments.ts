import { db } from "@/lib/db";
import { notifyPaymentReceived } from "@/lib/notifications";
import { getTransactionStatus, mapMethod, mapStatus } from "@/lib/pesapal";
import { bookingPaymentStatuses, lockBooking } from "@/lib/collections/checkout";
import { toQuoteMinor } from "@/lib/quote-rules";

export const CHECKOUT_STATUSES = bookingPaymentStatuses;

type Reconciled = {
  outcome: "succeeded" | "failed" | "pending" | "unknown";
  bookingReference?: string;
};

/** Reconcile previously opened Pesapal orders during cutover. */
export async function reconcilePayment(orderTrackingId: string): Promise<Reconciled> {
  if (!/^[\w-]{1,160}$/.test(orderTrackingId)) return { outcome: "unknown" };
  const payment = await db.payment.findFirst({
    where: { gateway: "PESAPAL", transactionId: orderTrackingId },
    include: { booking: { select: { reference: true, totalMinor: true } } },
  });
  if (!payment) return { outcome: "unknown" };
  const bookingReference = payment.booking.reference;
  if (payment.status === "SUCCEEDED") return { outcome: "succeeded", bookingReference };
  if (["FAILED", "REFUNDED"].includes(payment.status)) return { outcome: "failed", bookingReference };
  if (process.env.PESAPAL_LEGACY_RECONCILE !== "true") return { outcome: "pending", bookingReference };
  let response;
  try { response = await getTransactionStatus(orderTrackingId); }
  catch { return { outcome: "pending", bookingReference }; }
  const next = mapStatus(response.status_code);
  if (next === "SUCCEEDED") {
    try {
      if (response.merchant_reference !== payment.idempotencyKey || response.currency !== payment.currency ||
        toQuoteMinor(String(response.amount), payment.currency) !== payment.amountMinor) return { outcome: "pending", bookingReference };
    } catch { return { outcome: "pending", bookingReference }; }
  }
  const paid = await db.$transaction(async (tx) => {
    await lockBooking(tx, payment.bookingId);
    const change = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: ["INITIATED", "PENDING"] } },
      data: { status: next, method: mapMethod(response.payment_method), ...(next === "SUCCEEDED" ? { paidAt: new Date() } : {}) },
    });
    if (!change.count || next !== "SUCCEEDED") return 0;
    const { _sum } = await tx.payment.aggregate({
      where: { bookingId: payment.bookingId, currency: payment.currency, status: "SUCCEEDED" },
      _sum: { amountMinor: true },
    });
    if ((_sum.amountMinor ?? 0) === payment.booking.totalMinor) {
      await tx.booking.updateMany({ where: { id: payment.bookingId, status: { in: ["PENDING", "AWAITING_PAYMENT"] } }, data: { status: "PAID" } });
    }
    return _sum.amountMinor ?? 0;
  });
  if (paid) await notifyPaymentReceived(payment.bookingId, payment.amountMinor, { paidMinor: paid, totalMinor: payment.booking.totalMinor });
  return { outcome: next === "SUCCEEDED" ? "succeeded" : next === "PENDING" ? "pending" : "failed", bookingReference };
}
