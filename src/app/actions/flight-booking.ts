"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkoutSchema } from "@/lib/flight-shop-rules";
import { CheckoutError, startOnlineBooking } from "@/lib/flight-checkout";
import { ShopError } from "@/lib/flight-shop";
import { getCurrentUser } from "@/lib/session";

export type CheckoutState =
  | { status: "idle" }
  | { status: "error"; message: string; newTotalRwf?: number };

/** The traveller's "Continue to payment": creates the booking records and sends them to /pay. */
export async function bookFlightOnline(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { status: "error", message: "Something went wrong with the form. Reload the page and try again." };
  }
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the details and try again." };

  const list = await headers();
  let payUrl: string;
  try {
    ({ payUrl } = await startOnlineBooking(parsed.data, {
      viewer: await getCurrentUser(),
      ip: list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "unknown",
      userAgent: list.get("user-agent") ?? "",
    }));
  } catch (error) {
    if (error instanceof CheckoutError) return { status: "error", message: error.message, newTotalRwf: error.newTotalRwf };
    if (error instanceof ShopError) return { status: "error", message: error.message };
    console.error("[online booking] checkout failed", error);
    return { status: "error", message: "We could not start this booking. Nothing has been charged. Try again, or send the desk a request." };
  }
  redirect(payUrl);
}
