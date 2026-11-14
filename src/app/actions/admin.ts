"use server";

import { revalidatePath } from "next/cache";
import { refreshPublicCatalogue } from "@/lib/catalogue";
import { z } from "zod";
import { BookingError, transitionBooking } from "@/lib/booking";
import { db } from "@/lib/db";
import { notifyBookingStatusChanged, notifyProviderStatus } from "@/lib/notifications";
import { requireAdmin } from "@/lib/session";
import { slugify } from "@/lib/utils";

/**
 * Admin actions (Step 13).
 *
 * Every one calls `requireAdmin()` first — that guard is the whole
 * authorisation story here, because an admin is deliberately unscoped.
 *
 * Two invariants worth preserving:
 *   1. An admin cannot deactivate or demote themselves. Locking the last
 *      admin out of the platform is a support incident with no in-app fix.
 *   2. Suspending a provider unpublishes their listings, so a suspension
 *      actually stops new bookings instead of only changing a label.
 */

export type AdminState = { status: "idle" | "error" | "ok"; message?: string };

const ok: AdminState = { status: "idle" };
const fail = (message: string): AdminState => ({ status: "error", message });

/* -------------------------------------------------------------- providers */

const providerStatusSchema = z.object({
  providerId: z.string().uuid(),
  status: z.enum(["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"]),
});

export async function setProviderStatus(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const parsed = providerStatusSchema.safeParse({
    providerId: formData.get("providerId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return fail("That provider action isn't valid.");

  const { providerId, status } = parsed.data;

  const provider = await db.provider.findUnique({
    where: { id: providerId },
    select: { userId: true },
  });
  if (!provider) return fail("Provider not found.");

  await db.$transaction(async (tx) => {
    await tx.provider.update({
      where: { id: providerId },
      data: {
        status,
        verifiedAt: status === "VERIFIED" ? new Date() : null,
      },
    });

    // Approval is what actually grants the PROVIDER role — sign-up can't.
    if (status === "VERIFIED") {
      await tx.user.update({
        where: { id: provider.userId },
        data: { role: "PROVIDER" },
      });
    }

    // A suspension that leaves listings bookable isn't a suspension.
    if (status === "SUSPENDED" || status === "REJECTED") {
      await Promise.all([
        tx.tour.updateMany({ where: { providerId }, data: { isPublished: false } }),
        tx.vehicle.updateMany({ where: { providerId }, data: { isPublished: false } }),
        tx.hotel.updateMany({ where: { providerId }, data: { isPublished: false } }),
        tx.room.updateMany({
          where: { hotel: { providerId } },
          data: { isPublished: false },
        }),
      ]);
    }
  });

  if (status !== "PENDING") await notifyProviderStatus(providerId, status);

  revalidatePath("/admin/providers");
  refreshPublicCatalogue();
  revalidatePath("/admin");
  return { status: "ok", message: `Provider set to ${status.toLowerCase()}.` };
}

/* ------------------------------------------------------------------ users */

const userActiveSchema = z.object({
  userId: z.string().uuid(),
  active: z.enum(["true", "false"]),
});

export async function setUserActive(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin();

  const parsed = userActiveSchema.safeParse({
    userId: formData.get("userId"),
    active: formData.get("active"),
  });
  if (!parsed.success) return fail("That user action isn't valid.");

  const { userId } = parsed.data;
  const isActive = parsed.data.active === "true";

  // Invariant 1: no locking yourself out.
  if (userId === admin.id && !isActive) {
    return fail("You can't deactivate your own account.");
  }

  await db.user.update({ where: { id: userId }, data: { isActive } });

  revalidatePath("/admin/users");
  return {
    status: "ok",
    message: isActive ? "Account reactivated." : "Account deactivated.",
  };
}

const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["CUSTOMER", "PROVIDER", "ADMIN"]),
});

export async function setUserRole(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin();

  const parsed = roleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return fail("That role isn't valid.");

  const { userId, role } = parsed.data;

  if (userId === admin.id && role !== "ADMIN") {
    return fail("You can't remove your own admin access.");
  }

  // Promoting to PROVIDER without a provider record would land them on
  // /provider/apply with no way forward, so say so rather than doing it.
  if (role === "PROVIDER") {
    const hasProvider = await db.provider.count({ where: { userId } });
    if (hasProvider === 0) {
      return fail(
        "That user has no provider record yet. Create one from Providers first.",
      );
    }
  }

  await db.user.update({ where: { id: userId }, data: { role } });

  revalidatePath("/admin/users");
  return { status: "ok", message: `Role set to ${role.toLowerCase()}.` };
}

/* --------------------------------------------------------------- bookings */

const adminTransitionSchema = z.object({
  reference: z.string().trim().min(3).max(20),
  to: z.enum(["CONFIRMED", "REJECTED", "CANCELLED", "COMPLETED"]),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function adminTransitionBooking(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const parsed = adminTransitionSchema.safeParse({
    reference: formData.get("reference"),
    to: formData.get("to"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return fail("That action isn't valid.");

  try {
    const booking = await transitionBooking({
      reference: parsed.data.reference,
      to: parsed.data.to,
      actor: "ADMIN",
      reason: parsed.data.reason || undefined,
    });
    await notifyBookingStatusChanged(booking.id, parsed.data.to, "ADMIN");
    revalidatePath("/admin/bookings");
    revalidatePath("/admin");
    return ok;
  } catch (err) {
    if (err instanceof BookingError) return fail(err.message);
    console.error("[admin] transition failed", err);
    return fail("We couldn't update that booking.");
  }
}

/* --------------------------------------------------------------- listings */

const listingSchema = z.object({
  kind: z.enum(["TOUR", "HOTEL", "VEHICLE", "ROOM"]),
  id: z.string().uuid(),
  publish: z.enum(["true", "false"]),
});

/** Same as the provider action but unscoped — an admin may act on any listing. */
export async function adminSetListingPublished(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const parsed = listingSchema.safeParse({
    kind: formData.get("kind"),
    id: formData.get("id"),
    publish: formData.get("publish"),
  });
  if (!parsed.success) return fail("That listing reference isn't valid.");

  const { kind, id } = parsed.data;
  const isPublished = parsed.data.publish === "true";
  const data = { isPublished };

  if (kind === "TOUR") await db.tour.update({ where: { id }, data });
  else if (kind === "HOTEL") await db.hotel.update({ where: { id }, data });
  else if (kind === "VEHICLE") await db.vehicle.update({ where: { id }, data });
  else await db.room.update({ where: { id }, data });

  revalidatePath("/admin/listings");
  refreshPublicCatalogue();
  return ok;
}

const deleteSchema = z.object({
  kind: z.enum(["TOUR", "HOTEL", "VEHICLE"]),
  id: z.string().uuid(),
});

class HasBookings extends Error {
  constructor(readonly count: number) {
    super("listing has bookings");
  }
}

/**
 * Permanently removes a listing and its calendar.
 *
 * Refused once anything has been booked: bookings, payments and receipts all
 * point at the listing, and deleting it would leave them describing nothing.
 */
export async function adminDeleteListing(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const parsed = deleteSchema.safeParse({ kind: formData.get("kind"), id: formData.get("id") });
  if (!parsed.success) return fail("That listing reference isn't valid.");
  const { kind, id } = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      // A hotel is booked through its rooms, so its calendar and bookings live under the room ids.
      const serviceType = kind === "HOTEL" ? "ROOM" : kind;
      const resourceIds =
        kind === "HOTEL"
          ? (await tx.room.findMany({ where: { hotelId: id }, select: { id: true } })).map((r) => r.id)
          : [id];

      // Calendar first: it locks those rows, so a booking racing this delete either
      // lands before the count below (and blocks it) or finds no calendar and fails.
      if (resourceIds.length) {
        await tx.availability.deleteMany({ where: { serviceType, resourceId: { in: resourceIds } } });
      }

      const bookings = resourceIds.length
        ? await tx.booking.count({ where: { serviceType, resourceId: { in: resourceIds } } })
        : 0;
      if (bookings > 0) throw new HasBookings(bookings);

      // Rooms go with the hotel through the schema's cascade.
      if (kind === "TOUR") await tx.tour.delete({ where: { id } });
      else if (kind === "HOTEL") await tx.hotel.delete({ where: { id } });
      else await tx.vehicle.delete({ where: { id } });
    });
  } catch (err) {
    if (err instanceof HasBookings) {
      return fail(
        `It has ${err.count} booking${err.count === 1 ? "" : "s"} on record, so it can't be deleted. Unpublish it instead.`,
      );
    }
    if (typeof err === "object" && err && "code" in err && err.code === "P2025") {
      return fail("That listing was already deleted.");
    }
    console.error("[admin] delete listing failed", err);
    return fail("We couldn't delete that listing. Nothing was removed.");
  }

  revalidatePath("/admin/listings");
  revalidatePath("/provider/listings");
  revalidatePath("/provider/availability");
  refreshPublicCatalogue();
  return { status: "ok", message: "Listing deleted." };
}

/* ------------------------------------------------------------ user support */

const userIdSchema = z.object({ userId: z.string().uuid() });

/**
 * Sends the customer a reset link instead of an admin setting a password for
 * them: nobody but the account holder ever knows it, and the email proves
 * they still control the address.
 */
export async function sendUserPasswordReset(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const parsed = userIdSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) return fail("That user reference isn't valid.");

  const user = await db.user.findUnique({
    where: { id: parsed.data.userId },
    select: { email: true, isActive: true },
  });
  if (!user) return fail("That user no longer exists.");
  if (!user.isActive) return fail("Reactivate the account before sending a reset.");

  try {
    const { auth } = await import("@/lib/auth");
    await auth.api.requestPasswordReset({
      body: { email: user.email, redirectTo: "/reset-password" },
    });
  } catch (err) {
    console.error("[admin] password reset failed", err);
    return fail("We couldn't send that reset. Check email settings and try again.");
  }

  return { status: "ok", message: `Reset link sent to ${user.email}.` };
}

/**
 * Drops every session the user holds.
 *
 * Deactivating blocks the next sign-in but leaves an existing session alive
 * for up to 30 days, which is no use when an account has been compromised or
 * someone has left.
 */
export async function revokeUserSessions(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin();

  const parsed = userIdSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) return fail("That user reference isn't valid.");
  if (parsed.data.userId === admin.id) {
    return fail("Use your profile page to sign your own other devices out.");
  }

  const { count } = await db.session.deleteMany({ where: { userId: parsed.data.userId } });

  revalidatePath("/admin/users");
  return {
    status: "ok",
    message: count === 0 ? "They had no active sessions." : `Signed out of ${count} session${count === 1 ? "" : "s"}.`,
  };
}

/* ------------------------------------------------- provider record for a user */

const newProviderSchema = z.object({
  userId: z.string().uuid(),
  businessName: z.string().trim().min(2, "Business name is required").max(160),
  kind: z.enum(["TOUR", "HOTEL", "CAR"]),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  verify: z.enum(["true", "false"]).optional(),
});

/**
 * Creates the provider record a PROVIDER role needs, and promotes the user in
 * the same transaction. Without this an admin could only promote someone who
 * had already applied themselves.
 */
export async function createProviderForUser(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const parsed = newProviderSchema.safeParse({
    userId: formData.get("userId"),
    businessName: formData.get("businessName"),
    kind: formData.get("kind"),
    city: formData.get("city") ?? "",
    phone: formData.get("phone") ?? "",
    verify: formData.get("verify") ?? "false",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check those details.");
  }

  const { userId, businessName, kind, city, phone, verify } = parsed.data;

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, phone: true } });
  if (!user) return fail("That user no longer exists.");

  const existing = await db.provider.count({ where: { userId } });
  if (existing > 0) return fail("That user already has a provider record.");

  const base = slugify(businessName) || "provider";
  let slug = base;
  for (let i = 2; i < 50 && (await db.provider.count({ where: { slug } })) > 0; i++) {
    slug = `${base}-${i}`;
  }

  const verified = verify === "true";

  await db.$transaction([
    db.provider.create({
      data: {
        userId,
        businessName,
        slug,
        kind,
        city: city || null,
        phone: phone || user.phone || null,
        status: verified ? "VERIFIED" : "PENDING",
        verifiedAt: verified ? new Date() : null,
      },
    }),
    // The role only works alongside a provider record, so both or neither.
    db.user.update({ where: { id: userId }, data: { role: "PROVIDER" } }),
  ]);

  revalidatePath("/admin/users");
  revalidatePath("/admin/providers");
  refreshPublicCatalogue();
  return { status: "ok", message: `${businessName} created and the account promoted.` };
}

/* ------------------------------------------------- provider categories */

const categoriesSchema = z.object({
  providerId: z.string().uuid(),
  kinds: z.array(z.enum(["TOUR", "HOTEL", "CAR"])).min(1, "Pick at least one category"),
});

/**
 * Sets what a provider may list.
 *
 * Existing listings outside the new set are left alone rather than hidden:
 * taking a category away should stop new listings, not silently unpublish a
 * property that has bookings against it.
 */
export async function setProviderCategories(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const parsed = categoriesSchema.safeParse({
    providerId: formData.get("providerId"),
    kinds: formData.getAll("kinds").map(String),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Pick at least one category.");
  }

  const { providerId, kinds } = parsed.data;

  await db.provider.update({
    where: { id: providerId },
    // `kind` stays as the primary label; `kinds` is what the guards read.
    data: { kinds, kind: kinds[0] },
  });

  revalidatePath("/admin/providers");
  revalidatePath("/provider/listings");
  return { status: "ok", message: "Categories updated." };
}
