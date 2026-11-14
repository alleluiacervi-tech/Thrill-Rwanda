"use server";

import { db } from "@/lib/db";
import { PaymentError, startCheckout } from "@/lib/payments";
import { getCurrentUser } from "@/lib/session";

// Opening a checkout is a POST because it creates an order at Pesapal and a
// row in our ledger. The redirect is handed back for the client to follow,
// so a gateway failure renders on the booking page instead of a dead end.

export type CheckoutState =
  | { status: "idle" }
  | { status: "error"; message: string; retryable: boolean }
  | { status: "redirect"; url: string };

export async function beginPayment(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Please sign in again.", retryable: true };

  const reference = String(formData.get("reference") ?? "").trim();
  if (!reference) return { status: "error", message: "Missing booking reference.", retryable: false };

  try {
    // The booking is resolved from the reference and the session user
    // together, so the id never comes off the form.
    const booking = await db.booking.findFirst({
      where: { reference, customerId: user.id },
      select: { id: true },
    });
    if (!booking) return { status: "error", message: "We couldn't find that booking.", retryable: false };

    await startCheckout({
      bookingId: booking.id,
      customerId: user.id,
    });

    // Pesapal's form is embedded on our own payment page.
    return { status: "redirect", url: `/checkout/${reference}/pay` };
  } catch (err) {
    if (err instanceof PaymentError) {
      return { status: "error", message: err.message, retryable: err.retryable };
    }
    console.error("[payment] checkout failed", err);
    return {
      status: "error",
      message: "We couldn't start that payment. Nothing has been charged — please try again.",
      retryable: true,
    };
  }
}
