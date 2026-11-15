"use server";

import { directBookingEnabled } from "@/lib/publication";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BookingError } from "@/lib/booking";
import { getCurrentUser } from "@/lib/session";
import { getSite, getSiteSettings } from "@/lib/settings";
import { createTransferBooking } from "@/lib/transfer-booking";
import { PICKUP_POINTS, VEHICLES } from "@/lib/transfer-zones-shared";

export type TransferBookingState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "auth"; signInUrl: string }
  | { status: "success"; reference: string };

const schema = z.object({
  point: z.enum(PICKUP_POINTS.map((p) => p.key) as [string, ...string[]], { message: "Choose where we meet you" }),
  zoneId: z.string().uuid("Choose your area"),
  area: z.string().trim().min(1, "Choose your area").max(200),
  direction: z.enum(["from", "to"]),
  vehicle: z.enum(VEHICLES.map((v) => v.key) as ["sedan", "van", "premium"], { message: "Choose a vehicle" }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date of the transfer"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a pickup time"),
  passengers: z.coerce.number().int().min(1).max(40),
  flight: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

/** Step one for a transfer: price it on the server, hold it, then on to checkout. */
export async function bookTransfer(
  _prev: TransferBookingState,
  formData: FormData,
): Promise<TransferBookingState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check those details." };
  }

  if (!(await directBookingEnabled("TRANSFER"))) return { status: "error", message: "Transfers are available by checked quotation. Please send a transport enquiry." };
  const { maxPassengers } = (await getSite()).rules;
  if (parsed.data.passengers > maxPassengers) {
    return {
      status: "error",
      message: `We book up to ${maxPassengers} online. Send it as a request and we'll quote your group.`,
    };
  }

  const user = await getCurrentUser();
  if (!user) return { status: "auth", signInUrl: "/sign-in?next=%2Ftransfers" };

  try {
    const booking = await createTransferBooking({
      customerId: user.id,
      ...parsed.data,
      depositPercent: (await getSiteSettings()).depositPercent,
    });
    revalidatePath("/account/bookings");
    return { status: "success", reference: booking.reference };
  } catch (err) {
    if (err instanceof BookingError) return { status: "error", message: err.message };
    console.error("[transfer] booking failed", err);
    return { status: "error", message: "We couldn't book that transfer. Nothing was charged — please try again." };
  }
}
