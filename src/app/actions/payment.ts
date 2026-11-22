"use server";

import { prepareBookingInvoice } from "@/lib/collections/checkout";
import { getCurrentUser } from "@/lib/session";

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
    if (!(await prepareBookingInvoice(reference, user.id))) {
      return { status: "error", message: "Contact the desk for approved payment instructions.", retryable: false };
    }
    return { status: "redirect", url: `/checkout/${reference}/pay` };
  } catch {
    return {
      status: "error",
      message: "Checkout is temporarily unavailable. Refresh your booking before retrying.",
      retryable: true,
    };
  }
}
