import { db } from "@/lib/db";
import { nextCharge, quotedDepositPercent } from "@/lib/deposit";
import { notifyPaymentReceived } from "@/lib/notifications";
import { getSite, getSiteSettings, paysOnline } from "@/lib/settings";
import {
  PesapalError,
  getTransactionStatus,
  mapMethod,
  mapStatus,
  newMerchantReference,
  pesapalConfigured,
  pesapalIpnId,
  submitOrder,
} from "@/lib/pesapal";


const PAYABLE = ["PENDING", "AWAITING_PAYMENT"] as const;

/** Statuses a customer may still pay from; a provider can confirm after the deposit, before the balance. */
export const CHECKOUT_STATUSES = ["PENDING", "AWAITING_PAYMENT", "CONFIRMED"] as const;

export class PaymentError extends Error {
  constructor(
    message: string,
    /** False when pressing Pay again cannot possibly work. */
    readonly retryable = true,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}


function explainGatewayError(err: PesapalError): { message: string; retryable: boolean } {
  if (err.code === "amount_exceeds_default_limit") {
    return {
      message:
        "This amount is above the per-transaction limit on our Pesapal account. Please call us and we'll take payment another way.",
      retryable: false,
    };
  }
  if (err.errorType === "contractual_error") {
    return {
      message:
        "Our payment provider can't take this booking right now. Please call us and we'll settle it with you directly.",
      retryable: false,
    };
  }
  return {
    message: "Pesapal wouldn't open that payment. Please try again in a moment.",
    retryable: true,
  };
}


function siteOrigin() {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const raw =
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (vercel ? `https://${vercel}` : "");
  return raw.replace(/\/+$/, "");
}

/**
 * Opens a Pesapal order for a booking and returns the hosted page URL.
 *
 * `customerId` is the authorisation boundary — it is taken from the session
 * by the caller and matched in the query, so a guessed booking id resolves
 * to nothing rather than to somebody else's booking.
 */
export async function startCheckout(params: {
  bookingId: string;
  customerId: string;
}) {
  if (!pesapalConfigured()) {
    throw new PaymentError("Card and mobile money payments are not switched on yet.");
  }

  const notificationId = pesapalIpnId();
  if (!notificationId) {
    throw new PaymentError(
      "Payments are not finished being set up. Please call us to settle this booking.",
    );
  }

  // Pesapal has to be able to reach both URLs, so a missing or http origin
  // is a misconfiguration rather than something to paper over.
  const origin = siteOrigin();
  if (!origin) {
    throw new PaymentError("Payments need NEXT_PUBLIC_SITE_URL set to this site's origin.");
  }
  if (!origin.startsWith("https://") && process.env.NODE_ENV === "production") {
    throw new PaymentError("Payments need NEXT_PUBLIC_SITE_URL set to the live https origin.");
  }

  const booking = await db.booking.findFirst({
    where: { id: params.bookingId, customerId: params.customerId },
    select: {
      id: true,
      reference: true,
      serviceType: true,
      status: true,
      totalMinor: true,
      currency: true,
      details: true,
      customer: { select: { email: true, fullName: true, phone: true } },
      provider: { select: { businessName: true } },
      payments: { select: { amountMinor: true, status: true } },
    },
  });

  if (!booking) throw new PaymentError("We couldn't find that booking.");

  // Hotel stays are paid at the property, never online.
  if (booking.serviceType === "ROOM") {
    throw new PaymentError("Hotel stays are paid at the property, not online.");
  }
  if (!(await paysOnline(booking.serviceType))) {
    throw new PaymentError("Online payment is switched off for this service. Please call or WhatsApp us to pay.", false);
  }

  if (!CHECKOUT_STATUSES.includes(booking.status as (typeof CHECKOUT_STATUSES)[number])) {
    throw new PaymentError(
      booking.status === "PAID" ? "This booking is already paid." : "This booking can no longer be paid online.",
    );
  }

  const settled = booking.payments
    .filter((p) => p.status === "SUCCEEDED")
    .reduce((sum, p) => sum + p.amountMinor, 0);
  const outstanding = booking.totalMinor - settled;

  if (outstanding <= 0) throw new PaymentError("This booking is already paid in full.");

  // Deposit first, then the balance, using the same rule the booking panel showed the customer.
  const depositPercent = quotedDepositPercent(booking.details, (await getSiteSettings()).depositPercent);
  const charge = nextCharge(booking.totalMinor, settled, depositPercent);
  const chargeLabel = charge.kind === "deposit" ? "deposit" : charge.kind === "balance" ? "balance" : "payment";

  // The merchant reference is unique per attempt, so an abandoned checkout
  // never collides with the retry that follows it.
  const merchantReference = newMerchantReference(booking.reference);

  const [firstName, ...rest] = booking.customer.fullName.trim().split(/\s+/);

  let order;
  try {
    order = await submitOrder({
      id: merchantReference,
      amountMinor: charge.amountMinor,
      currency: booking.currency,
      description: `${(await getSite()).name} booking ${booking.reference} (${chargeLabel})`,
      callbackUrl: `${origin}/payments/return`,
      notificationId,
      email: booking.customer.email,
      phone: booking.customer.phone,
      firstName,
      lastName: rest.join(" ") || undefined,
    });
  } catch (err) {
    if (err instanceof PesapalError) {
      // Pesapal's own code and message, not just the wrapper — this is the
      // only place the real reason exists, and "try again" hides it.
      console.error(
        `[pesapal] submit order failed: ${err.code ?? "no code"} — ${err.message}`,
        err.detail,
      );
      const explained = explainGatewayError(err);
      throw new PaymentError(explained.message, explained.retryable);
    }
    console.error("[pesapal] submit order failed", err);
    throw new PaymentError("We couldn't reach the payment gateway. Please try again.");
  }

  if (!order.redirect_url || !order.order_tracking_id) {
    throw new PaymentError("Pesapal did not return a payment page.");
  }

  // Written only once the order exists, so an INITIATED row in the ledger
  // always has a real tracking id to reconcile against.
  await db.payment.create({
    data: {
      bookingId: booking.id,
      idempotencyKey: merchantReference,
      transactionId: order.order_tracking_id,
      amountMinor: charge.amountMinor,
      currency: booking.currency,
      method: "MPESA",
      status: "INITIATED",
      gatewayResponse: { stage: "submit", ...order } as object,
    },
  });

  return { redirectUrl: order.redirect_url, orderTrackingId: order.order_tracking_id };
}

export type Reconciled = {
  outcome: "succeeded" | "failed" | "pending" | "unknown";
  bookingReference?: string;
  message?: string;
};

/**
 * Asks Pesapal what actually happened and writes the result.
 *
 * Safe to call repeatedly and from two directions at once — the customer
 * coming back from the hosted page and the IPN both land here, which is
 * exactly why the booking update is a conditional updateMany rather than a
 * read-then-write.
 */
export async function reconcilePayment(orderTrackingId: string): Promise<Reconciled> {
  const payment = await db.payment.findUnique({
    where: { transactionId: orderTrackingId },
    select: {
      id: true,
      status: true,
      amountMinor: true,
      bookingId: true,
      booking: { select: { reference: true, totalMinor: true, status: true } },
    },
  });

  // An unknown tracking id means somebody is guessing at the endpoint.
  if (!payment) {
    console.warn("[pesapal] reconcile: no payment for tracking id", orderTrackingId);
    return { outcome: "unknown" };
  }

  let status;
  try {
    status = await getTransactionStatus(orderTrackingId);
  } catch (err) {
    console.error("[pesapal] status lookup failed", err);
    return { outcome: "pending", bookingReference: payment.booking.reference };
  }

  const next = mapStatus(status.status_code);

  // Trust the gateway's figure over our own. A short payment then shows as
  // exactly that in the ledger instead of quietly reading as paid in full.
  const receivedMinor =
    typeof status.amount === "number" && status.amount > 0
      ? Math.round(status.amount * 100)
      : payment.amountMinor;

  // The IPN and the return page often arrive together. Only the call that actually flips the
  // payment to SUCCEEDED gets a count of 1, so exactly one receipt goes out.
  const { count: firstSettle } = await db.payment.updateMany({
    where: { id: payment.id, ...(next === "SUCCEEDED" ? { status: { not: "SUCCEEDED" as const } } : {}) },
    data: {
      status: next,
      method: mapMethod(status.payment_method),
      amountMinor: next === "SUCCEEDED" ? receivedMinor : payment.amountMinor,
      paidAt: next === "SUCCEEDED" ? new Date() : null,
      gatewayResponse: { stage: "status", ...status } as object,
    },
  });

  if (next !== "SUCCEEDED") {
    return {
      outcome: next === "FAILED" ? "failed" : "pending",
      bookingReference: payment.booking.reference,
      message: status.payment_status_description ?? undefined,
    };
  }

  // Sum across every settled attempt, so a deposit followed by a balance
  // moves the booking exactly once, on the payment that completes it.
  const settled = await db.payment.aggregate({
    where: { bookingId: payment.bookingId, status: "SUCCEEDED" },
    _sum: { amountMinor: true },
  });

  const paidInFull = (settled._sum.amountMinor ?? 0) >= payment.booking.totalMinor;

  if (paidInFull) {
    // updateMany, not update: if the IPN and the return page race, the
    // loser matches zero rows instead of overwriting a later status.
    await db.booking.updateMany({
      where: { id: payment.bookingId, status: { in: [...PAYABLE] } },
      data: { status: "PAID" },
    });

  }

  // A receipt for every payment that lands, deposit or balance, not only the one that completes it.
  if (firstSettle > 0) {
    await notifyPaymentReceived(payment.bookingId, receivedMinor, {
      paidMinor: settled._sum.amountMinor ?? receivedMinor,
      totalMinor: payment.booking.totalMinor,
    });
  }

  return { outcome: "succeeded", bookingReference: payment.booking.reference };
}
