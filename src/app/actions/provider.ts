"use server";

import { revalidatePath } from "next/cache";
import { refreshPublicCatalogue } from "@/lib/catalogue";
import { z } from "zod";
import { BookingError, transitionBooking } from "@/lib/booking";
import { db } from "@/lib/db";
import { notifyBookingStatusChanged } from "@/lib/notifications";
import { requireProvider } from "@/lib/session";
import { logActivityAsCurrentUser } from "@/lib/activity";



export type ActionState = { status: "idle" | "error" | "ok"; message?: string };

const ok: ActionState = { status: "idle" };

function fail(message: string): ActionState {
  return { status: "error", message };
}

/* --------------------------------------------------------------- bookings */

const transitionSchema = z.object({
  reference: z.string().trim().min(3).max(20),
  to: z.enum(["CONFIRMED", "REJECTED", "COMPLETED"]),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function providerTransitionBooking(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { providerId } = await requireProvider();

  const parsed = transitionSchema.safeParse({
    reference: formData.get("reference"),
    to: formData.get("to"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return fail("That action isn't valid.");

  try {
    const booking = await transitionBooking({
      reference: parsed.data.reference,
      to: parsed.data.to,
      actor: "PROVIDER",
      providerId, // from the session, never the form
      reason: parsed.data.reason || undefined,
    });
    await notifyBookingStatusChanged(booking.id, parsed.data.to, "PROVIDER");
    await logActivityAsCurrentUser({
      action: "booking.status",
      area: "Bookings",
      target: parsed.data.reference,
      targetId: booking.id,
      summary: `Set booking ${parsed.data.reference} to ${parsed.data.to.toLowerCase()}${parsed.data.reason ? `: ${parsed.data.reason}` : ""}`,
    });
    revalidatePath("/provider/bookings");
    revalidatePath("/provider");
    return ok;
  } catch (err) {
    if (err instanceof BookingError) return fail(err.message);
    console.error("[provider] transition failed", err);
    return fail("We couldn't update that booking.");
  }
}

/* --------------------------------------------------------------- listings */

const publishSchema = z.object({
  kind: z.enum(["TOUR", "HOTEL", "VEHICLE", "ROOM"]),
  id: z.string().uuid(),
  publish: z.enum(["true", "false"]),
});

export async function setListingPublished(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { providerId } = await requireProvider();

  const parsed = publishSchema.safeParse({
    kind: formData.get("kind"),
    id: formData.get("id"),
    publish: formData.get("publish"),
  });
  if (!parsed.success) return fail("That listing reference isn't valid.");

  const { kind, id } = parsed.data;
  const isPublished = parsed.data.publish === "true";

  // Each branch scopes on providerId so a guessed id from another provider
  // matches zero rows rather than flipping their listing.
  let count = 0;
  if (kind === "TOUR") {
    ({ count } = await db.tour.updateMany({
      where: { id, providerId, ...(isPublished ? { offerApproval: { not: null } } : {}) },
      data: { isPublished },
    }));
  } else if (kind === "HOTEL") {
    ({ count } = await db.hotel.updateMany({
      where: { id, providerId },
      data: { isPublished },
    }));
  } else if (kind === "VEHICLE") {
    ({ count } = await db.vehicle.updateMany({
      where: { id, providerId },
      data: { isPublished },
    }));
  } else {
    // Rooms hang off a hotel, so the scope goes through the relation.
    ({ count } = await db.room.updateMany({
      where: { id, hotel: { providerId } },
      data: { isPublished },
    }));
  }

  if (count === 0) return fail("That listing isn't yours to change.");

  // Only going live is news; unpublishing needs no admin attention.
  if (isPublished) {
    const { notifyListingPublished } = await import("@/lib/notifications");
    await notifyListingPublished(kind, id);
  }

  await logActivityAsCurrentUser({
    action: isPublished ? "listing.publish" : "listing.unpublish",
    area: "Listings",
    targetId: id,
    summary: `${isPublished ? "Published" : "Unpublished"} a ${kind.toLowerCase()} listing`,
  });
  revalidatePath("/provider/listings");
  refreshPublicCatalogue();
  return ok;
}

/* ----------------------------------------------------------- availability */

const availabilitySchema = z.object({
  serviceType: z.enum(["TOUR", "ROOM", "VEHICLE"]),
  resourceId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  action: z.enum(["block", "open"]),
});

/** Confirms the resource belongs to this provider before touching its calendar. */
async function ownsResource(
  providerId: string,
  serviceType: "TOUR" | "ROOM" | "VEHICLE",
  resourceId: string,
) {
  if (serviceType === "TOUR") {
    return (await db.tour.count({ where: { id: resourceId, providerId } })) > 0;
  }
  if (serviceType === "VEHICLE") {
    return (
      (await db.vehicle.count({ where: { id: resourceId, providerId } })) > 0
    );
  }
  return (
    (await db.room.count({ where: { id: resourceId, hotel: { providerId } } })) >
    0
  );
}

export async function setAvailabilityWindow(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { providerId } = await requireProvider();

  const parsed = availabilitySchema.safeParse({
    serviceType: formData.get("serviceType"),
    resourceId: formData.get("resourceId"),
    from: formData.get("from"),
    to: formData.get("to"),
    action: formData.get("action"),
  });
  if (!parsed.success) return fail("Check the dates and try again.");

  const { serviceType, resourceId, action } = parsed.data;
  const from = new Date(`${parsed.data.from}T00:00:00Z`);
  const to = new Date(`${parsed.data.to}T00:00:00Z`);

  if (to < from) return fail("The end date must be on or after the start date.");

  if (!(await ownsResource(providerId, serviceType, resourceId))) {
    return fail("That listing isn't yours to change.");
  }

  const isBlocked = action === "block";

  // Blocking never removes an existing hold: a day with real bookings stays
  // sold. `isBlocked` only stops NEW bookings, so a provider closing dates
  // can't silently strand a customer who already booked.
  const { count } = await db.availability.updateMany({
    where: {
      serviceType,
      resourceId,
      day: { gte: from, lte: to },
      ...(isBlocked ? { unitsBooked: 0 } : {}),
    },
    data: { isBlocked },
  });

  await logActivityAsCurrentUser({
    action: isBlocked ? "availability.close" : "availability.reopen",
    area: "Listings",
    targetId: resourceId,
    summary: `${isBlocked ? "Closed" : "Reopened"} ${count} ${count === 1 ? "day" : "days"} (${parsed.data.from} to ${parsed.data.to}) on a ${serviceType.toLowerCase()} listing`,
  });
  revalidatePath("/provider/availability");

  if (isBlocked && count === 0) {
    return fail(
      "Nothing was closed — every day in that range already has a booking on it.",
    );
  }
  return {
    status: "ok",
    message: `${count} ${count === 1 ? "day" : "days"} ${isBlocked ? "closed" : "reopened"}.`,
  };
}

/* ------------------------------------------------------------------ profile */

const profileSchema = z.object({
  businessName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  about: z.string().trim().max(2000).optional().or(z.literal("")),
  kraPin: z.string().trim().max(40).optional().or(z.literal("")),
  licenceNumber: z.string().trim().max(60).optional().or(z.literal("")),
});

export async function updateProviderProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { providerId } = await requireProvider();

  const parsed = profileSchema.safeParse({
    businessName: formData.get("businessName"),
    phone: formData.get("phone") ?? "",
    about: formData.get("about") ?? "",
    kraPin: formData.get("kraPin") ?? "",
    licenceNumber: formData.get("licenceNumber") ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check those details.");
  }

  const d = parsed.data;
  // Note: `status` is deliberately not updatable here. A provider cannot
  // verify themselves — only an admin can (Step 13).
  await db.provider.update({
    where: { id: providerId },
    data: {
      businessName: d.businessName,
      phone: d.phone || null,
      about: d.about || null,
      kraPin: d.kraPin || null,
      licenceNumber: d.licenceNumber || null,
    },
  });

  await logActivityAsCurrentUser({
    action: "provider.profile",
    area: "Providers",
    target: d.businessName,
    targetId: providerId,
    summary: `Updated the business profile of ${d.businessName}`,
  });
  revalidatePath("/provider/profile");
  refreshPublicCatalogue();
  return { status: "ok", message: "Profile saved." };
}
