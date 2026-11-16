"use server";

import {publicPreviewAllowed} from "@/lib/soft-launch";
import { directBookingEnabled } from "@/lib/publication";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  BookingError,
  cancelBooking,
  checkAvailability,
  createBooking,
  dayCount,
} from "@/lib/booking";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { CHECKOUT_STATUSES } from "@/lib/payments";
import { RESIDENCIES } from "@/lib/residency";
import { getSiteSettings } from "@/lib/settings";
import type { ServiceType } from "@/generated/prisma/enums";

/**
 * Booking server actions.
 *
 * The client sends a public slug, never a database id, and never a price.
 * Both are resolved server-side inside the booking transaction, so a
 * tampered request can't book a hidden listing or set its own total.
 */

const serviceTypes = ["TOUR", "ROOM", "VEHICLE"] as const;

const bookingSchema = z.object({
  serviceType: z.enum(serviceTypes),
  slug: z.string().trim().min(1).max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date"),
  guests: z.coerce.number().int().min(1).max(40),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  // Hotels only: the room type the customer picked. Checked against the hotel below.
  roomId: z.string().uuid().optional().or(z.literal("")),
  // Car hire only. Checkboxes arrive as "on" or not at all.
  withDriver: z.literal("on").optional(),
  damageAccepted: z.literal("on").optional(),
  // Safaris: which of the three rates applies.
  residency: z.enum(RESIDENCIES).optional(),
  // Who is travelling, when the booker isn't the traveller.
  leadTraveller: z.string().trim().max(120).optional().or(z.literal("")),
  leadPhone: z.string().trim().max(40).optional().or(z.literal("")),
});

export type BookingState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "auth"; signInUrl: string }
  | { status: "success"; reference: string };

/** Resolves a public slug to a live, published resource id. */
async function resolveResource(
  serviceType: ServiceType,
  slug: string,
  roomId?: string,
): Promise<string | null> {
  if (serviceType === "TOUR") {
    const t = await db.tour.findFirst({
      where: { slug, isPublished: true, offerApproval: { not: null }, provider: { status: "VERIFIED", user: { isActive: true } } },
      select: { id: true },
    });
    return t?.id ?? null;
  }
  if (serviceType === "VEHICLE") {
    const v = await db.vehicle.findFirst({
      where: { slug, isPublished: true },
      select: { id: true },
    });
    return v?.id ?? null;
  }
  // The room must belong to this hotel, so a tampered id can't book another property's room.
  // With no room chosen, fall back to the cheapest one.
  const room = await db.room.findFirst({
    where: { ...(roomId ? { id: roomId } : {}), isPublished: true, hotel: { slug, isPublished: true } },
    orderBy: { pricePerNightMinor: "asc" },
    select: { id: true },
  });
  return room?.id ?? null;
}

export async function submitBooking(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const parsed = bookingSchema.safeParse({
    serviceType: formData.get("serviceType"),
    slug: formData.get("slug"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    guests: formData.get("guests"),
    notes: formData.get("notes") ?? "",
    roomId: formData.get("roomId") ?? "",
    // Unticked boxes and unchosen radios are absent: null must become undefined.
    withDriver: formData.get("withDriver") ?? undefined,
    damageAccepted: formData.get("damageAccepted") ?? undefined,
    residency: formData.get("residency") ?? undefined,
    leadTraveller: formData.get("leadTraveller") ?? "",
    leadPhone: formData.get("leadPhone") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Please check those details.",
    };
  }

  if (!(await publicPreviewAllowed())) return {status:"error",message:"This private preview accepts new arrangements from invited accounts only."};
  const input = parsed.data;
  if (!(await directBookingEnabled(input.serviceType))) return { status: "error", message: "This service is available by checked quotation. Please send an enquiry instead." };

  // Booking requires an account, so the customer has somewhere to see it.
  const user = await getCurrentUser();
  if (!user) {
    const next = `/${input.serviceType === "TOUR" ? "tours" : input.serviceType === "VEHICLE" ? "cars" : "hotels"}/${input.slug}`;
    return {
      status: "auth",
      signInUrl: `/sign-in?next=${encodeURIComponent(next)}`,
    };
  }

  const resourceId = await resolveResource(input.serviceType, input.slug, input.roomId || undefined);
  if (!resourceId) {
    return {
      status: "error",
      message: input.roomId
        ? "That room is no longer available to book. Please choose another."
        : "That listing is no longer available to book.",
    };
  }

  if (
    input.serviceType === "TOUR" &&
    (await db.tour.findUnique({ where: { id: resourceId }, select: { enquiryOnly: true } }))?.enquiryOnly
  ) {
    return {
      status: "error",
      message: "This journey is arranged by written quote. Please send a request instead.",
    };
  }

  if (input.serviceType === "TOUR" && !input.residency) {
    return {
      status: "error",
      message: "Please choose your residency — safari rates depend on it.",
    };
  }

  // The general terms are agreed at checkout (step two), next to the payment.

  // Saved on the booking, so a later change to the deposit setting never changes what this customer was quoted.
  const { depositPercent, damageLiabilityText } = await getSiteSettings();

  // The damage terms are agreed before the booking exists, not after.
  let liability: Record<string, unknown> = {};
  if (input.serviceType === "VEHICLE") {
    const vehicle = await db.vehicle.findUnique({
      where: { id: resourceId },
      select: { insuranceChargeMinor: true },
    });
    if (vehicle?.insuranceChargeMinor) {
      if (input.damageAccepted !== "on") {
        return {
          status: "error",
          message: "Please accept the vehicle damage liability terms to continue.",
        };
      }
      liability = {
        damageLiability: {
          acceptedAt: new Date().toISOString(),
          amountMinor: vehicle.insuranceChargeMinor,
          // The wording as it stood on the day, so a later edit can't rewrite what was agreed.
          text: damageLiabilityText,
        },
      };
    }
  }

  try {
    const booking = await createBooking({
      customerId: user.id,
      serviceType: input.serviceType,
      resourceId,
      startDate: input.startDate,
      endDate: input.endDate,
      guests: input.guests,
      customerNotes: input.notes || undefined,
      withDriver: input.withDriver === "on",
      residency: input.residency,
      details: {
        depositPercent,
        // Kept for the provider's manifest: who is actually travelling.
        ...(input.leadTraveller ? { leadTraveller: input.leadTraveller } : {}),
        ...(input.leadPhone ? { leadPhone: input.leadPhone } : {}),
        ...liability,
      },
    });

    // No notifications yet: the customer, provider and admins hear once it's confirmed at checkout.
    revalidatePath("/account/bookings");
    // A dated tour shows seats left; the page should not go on offering the ones just taken.
    if (input.serviceType === "TOUR") revalidatePath(`/tours/${input.slug}`);
    return { status: "success", reference: booking.reference };
  } catch (err) {
    if (err instanceof BookingError) {
      return { status: "error", message: err.message };
    }
    console.error("[booking] create failed", err);
    return {
      status: "error",
      message:
        "Something went wrong holding those dates. Nothing was charged — please try again.",
    };
  }
}

/** Advisory availability probe for the quote panel. */
export async function probeAvailability(params: {
  serviceType: (typeof serviceTypes)[number];
  slug: string;
  startDate: string;
  endDate: string;
  guests: number;
}) {
  const resourceId = await resolveResource(params.serviceType, params.slug);
  if (!resourceId) return { available: false as const, reason: "Listing not found." };

  try {
    const result = await checkAvailability({
      serviceType: params.serviceType,
      resourceId,
      startDate: params.startDate,
      endDate: params.endDate,
      units: params.serviceType === "TOUR" ? params.guests : 1,
    });
    return result.available
      ? { available: true as const }
      : { available: false as const, reason: result.reason };
  } catch {
    return { available: false as const, reason: "Couldn't check those dates." };
  }
}

/* ------------------------------------------------------------ cancellation */

export type CancelState = { status: "idle" | "error"; message?: string };

export async function submitCancellation(
  _prev: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Please sign in again." };

  const reference = String(formData.get("reference") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || undefined;

  if (!reference) return { status: "error", message: "Missing booking reference." };

  try {
    // customerId comes from the session — a customer can only cancel their own.
    await cancelBooking({ reference, customerId: user.id, reason });
    revalidatePath("/account/bookings");
    revalidatePath(`/account/bookings/${reference}`);
    return { status: "idle" };
  } catch (err) {
    if (err instanceof BookingError) {
      return { status: "error", message: err.message };
    }
    console.error("[booking] cancel failed", err);
    return { status: "error", message: "We couldn't cancel that just now." };
  }
}

/* ------------------------------------------------------- adding a driver */

const driverSchema = z.object({ reference: z.string().trim().min(3).max(20) });

export type DriverRequestState = { status: "idle" | "error" | "ok"; message?: string };

/**
 * Adds a driver to a car hire booking the customer already made.
 *
 * The charge is recalculated from the vehicle's current rate and added to the
 * booking total, so the balance the customer pays next includes it. Allowed
 * only while the booking is still live and not yet fully paid — adding a
 * charge to a settled booking would leave money owed with nothing to pay it
 * against.
 */
export async function requestDriver(
  _prev: DriverRequestState,
  formData: FormData,
): Promise<DriverRequestState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Please sign in again." };

  const parsed = driverSchema.safeParse({ reference: formData.get("reference") });
  if (!parsed.success) return { status: "error", message: "That booking reference isn't valid." };

  const booking = await db.booking.findFirst({
    where: { reference: parsed.data.reference, customerId: user.id },
    select: {
      id: true,
      serviceType: true,
      resourceId: true,
      status: true,
      startDate: true,
      endDate: true,
      subtotalMinor: true,
      totalMinor: true,
      details: true,
      payments: { where: { status: "SUCCEEDED" }, select: { amountMinor: true } },
    },
  });
  if (!booking) return { status: "error", message: "We couldn't find that booking." };
  if (booking.serviceType !== "VEHICLE") {
    return { status: "error", message: "Drivers apply to car hire only." };
  }
  if (!(CHECKOUT_STATUSES as readonly string[]).includes(booking.status)) {
    return { status: "error", message: "This booking is closed. Call us and we'll arrange it." };
  }
  if ((booking.details as { withDriver?: boolean })?.withDriver) {
    return { status: "error", message: "A driver is already included." };
  }

  const vehicle = await db.vehicle.findUnique({
    where: { id: booking.resourceId },
    select: { driverPerDayMinor: true },
  });
  if (!vehicle?.driverPerDayMinor) {
    return { status: "error", message: "This vehicle is self-drive only." };
  }

  const days = dayCount(booking.startDate, booking.endDate);
  const extra = vehicle.driverPerDayMinor * days;

  await db.booking.update({
    where: { id: booking.id },
    data: {
      subtotalMinor: booking.subtotalMinor + extra,
      totalMinor: booking.totalMinor + extra,
      details: {
        ...(booking.details as Record<string, unknown>),
        withDriver: true,
        driverPerDayMinor: vehicle.driverPerDayMinor,
        driverTotalMinor: extra,
        driverAddedAt: new Date().toISOString(),
      },
    },
  });

  revalidatePath(`/account/bookings/${parsed.data.reference}`);
  revalidatePath("/account/bookings");
  return {
    status: "ok",
    message: `Driver added for ${days} ${days === 1 ? "day" : "days"}. The extra is on your balance.`,
  };
}
