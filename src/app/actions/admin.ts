"use server";

import { revalidatePath } from "next/cache";
import { refreshPublicCatalogue } from "@/lib/catalogue";
import { z } from "zod";
import { BookingError, transitionBooking } from "@/lib/booking";
import { db } from "@/lib/db";
import { notifyBookingStatusChanged, notifyProviderStatus } from "@/lib/notifications";
import { setActive, setRole } from "@/app/actions/access";
import { accessRefusal } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/session";
import { slugify } from "@/lib/utils";

/**
 * Admin actions (Step 13).
 *
 * Every one calls `requireAdmin()` first, because an admin is deliberately
 * unscoped. Changing anyone's access is narrower: only a super admin may, and
 * those changes go through src/app/actions/access.ts. Every action records
 * itself in the activity log once it has succeeded.
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
  const admin = await requireAdmin();

  const parsed = providerStatusSchema.safeParse({
    providerId: formData.get("providerId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return fail("That provider action isn't valid.");

  const { providerId, status } = parsed.data;

  const provider = await db.provider.findUnique({
    where: { id: providerId },
    select: { userId: true, businessName: true, status: true },
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
  await logActivity(admin.id, {
    action: "provider.status",
    area: "Providers",
    target: provider.businessName,
    targetId: providerId,
    summary: `Set ${provider.businessName} from ${provider.status.toLowerCase()} to ${status.toLowerCase()}${
      status === "SUSPENDED" || status === "REJECTED" ? " and unpublished its listings" : ""
    }`,
    changes: { from: provider.status, to: status },
  });

  revalidatePath("/admin/providers");
  refreshPublicCatalogue();
  revalidatePath("/admin");
  return { status: "ok", message: `Provider set to ${status.toLowerCase()}.` };
}

/* ------------------------------------------------------------------ users */

export async function setUserActive(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const form = new FormData();
  form.set("userId", String(formData.get("userId") ?? ""));
  form.set("on", String(formData.get("active") ?? ""));
  return setActive({ status: "idle" }, form);
}

export async function setUserRole(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return setRole({ status: "idle" }, formData);
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
  const admin = await requireAdmin();

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
    await logActivity(admin.id, {
      action: "booking.status",
      area: "Bookings",
      target: parsed.data.reference,
      targetId: booking.id,
      summary: `Set booking ${parsed.data.reference} to ${parsed.data.to.toLowerCase()}${
        parsed.data.reason ? `: ${parsed.data.reason}` : ""
      }`,
      changes: { to: parsed.data.to, reason: parsed.data.reason || null },
    });
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
  const admin = await requireAdmin();

  const parsed = listingSchema.safeParse({
    kind: formData.get("kind"),
    id: formData.get("id"),
    publish: formData.get("publish"),
  });
  if (!parsed.success) return fail("That listing reference isn't valid.");

  const { kind, id } = parsed.data;
  const isPublished = parsed.data.publish === "true";
  const data = { isPublished };
  let hotelId: string | undefined;

  if (kind === "TOUR") {
    if (isPublished && !(await db.tour.findFirst({ where: { id, offerApproval: { not: null } } }))) return fail("Review and approve this offer under Launch controls first.");
    await db.tour.update({ where: { id }, data });
  }
  else if (kind === "HOTEL") await db.hotel.update({ where: { id }, data });
  else if (kind === "VEHICLE") await db.vehicle.update({ where: { id }, data });
  else {
    const room = await db.room.findUnique({ where: { id }, select: { hotelId: true } });
    if (!room) return fail("That room no longer exists. Reload the property.");
    const updated = await db.room.updateMany({ where: { id }, data });
    if (!updated.count) return fail("That room no longer exists. Reload the property.");
    hotelId = room.hotelId;
  }

  await logActivity(admin.id, {
    action: isPublished ? "listing.publish" : "listing.unpublish",
    area: "Listings",
    target: await listingName(kind, id),
    targetId: id,
    summary: `${isPublished ? "Published" : "Unpublished"} ${kind.toLowerCase()} ${await listingName(kind, id)}`,
    changes: { kind, isPublished },
  });
  revalidatePath("/admin/listings");
  if (hotelId) revalidatePath(`/admin/listings/hotels/${hotelId}/edit`);
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
  const admin = await requireAdmin();

  const parsed = deleteSchema.safeParse({ kind: formData.get("kind"), id: formData.get("id") });
  if (!parsed.success) return fail("That listing reference isn't valid.");
  const { kind, id } = parsed.data;
  // Named before it is gone, for the activity log.
  const name = await listingName(kind, id);

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

  await logActivity(admin.id, {
    action: "listing.delete",
    area: "Listings",
    target: name,
    targetId: id,
    summary: `Deleted ${kind.toLowerCase()} ${name} and its calendar`,
    changes: { kind },
  });
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
  const admin = await requireAdmin();

  const parsed = userIdSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) return fail("That user reference isn't valid.");

  const user = await db.user.findUnique({
    where: { id: parsed.data.userId },
    select: { email: true, isActive: true, fullName: true, role: true, isSuperAdmin: true },
  });
  if (!user) return fail("That user no longer exists.");
  if (!user.isActive) return fail("Reactivate the account before sending a reset.");
  // Resetting an administrator's password is an access matter.
  if (user.role === "ADMIN" && !(await actorIsSuper(admin.id)))
    return fail("Only a super admin can reset an administrator's password.");

  try {
    const { auth } = await import("@/lib/auth");
    await auth.api.requestPasswordReset({
      body: { email: user.email, redirectTo: "/reset-password" },
    });
  } catch (err) {
    console.error("[admin] password reset failed", err);
    return fail("We couldn't send that reset. Check email settings and try again.");
  }

  await logActivity(admin.id, {
    action: "user.password_reset",
    area: "Access",
    target: user.fullName,
    targetId: parsed.data.userId,
    summary: `Sent a password reset link to ${user.fullName}`,
  });
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

  const person = await db.user.findUnique({
    where: { id: parsed.data.userId },
    select: { fullName: true, role: true },
  });
  if (!person) return fail("That user no longer exists.");
  if (person.role === "ADMIN" && !(await actorIsSuper(admin.id)))
    return fail("Only a super admin can sign an administrator out.");

  const { count } = await db.session.deleteMany({ where: { userId: parsed.data.userId } });
  await logActivity(admin.id, {
    action: "user.sign_out",
    area: "Access",
    target: person.fullName,
    targetId: parsed.data.userId,
    summary: `Signed ${person.fullName} out of ${count} session${count === 1 ? "" : "s"}`,
  });

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
  const admin = await requireAdmin();

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

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, phone: true, fullName: true, role: true, staffRole: true, isSuperAdmin: true, isActive: true },
  });
  if (!user) return fail("That user no longer exists.");
  // Promoting someone to provider changes their access: the same rules as any role change.
  const actor = await db.user.findUnique({
    where: { id: admin.id },
    select: { id: true, role: true, staffRole: true, isSuperAdmin: true },
  });
  const othersSuper = await db.user.count({
    where: { role: "ADMIN", isSuperAdmin: true, isActive: true, id: { not: userId } },
  });
  const refusal = actor && accessRefusal(actor, user, { kind: "role", role: "PROVIDER" }, othersSuper);
  if (!actor || refusal) return fail(refusal || "Only a super admin can change someone's access.");

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
    db.user.update({ where: { id: userId }, data: { role: "PROVIDER", isSuperAdmin: false } }),
  ]);
  await logActivity(admin.id, {
    action: "access.role",
    area: "Access",
    target: user.fullName,
    targetId: userId,
    summary: `Created provider ${businessName} for ${user.fullName} and made them a provider${verified ? " (verified)" : ""}`,
    changes: { business: businessName, kind, verified },
  });

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
  const admin = await requireAdmin();

  const parsed = categoriesSchema.safeParse({
    providerId: formData.get("providerId"),
    kinds: formData.getAll("kinds").map(String),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Pick at least one category.");
  }

  const { providerId, kinds } = parsed.data;

  const updated = await db.provider.update({
    where: { id: providerId },
    // `kind` stays as the primary label; `kinds` is what the guards read.
    data: { kinds, kind: kinds[0] },
    select: { businessName: true },
  });
  await logActivity(admin.id, {
    action: "provider.categories",
    area: "Providers",
    target: updated.businessName,
    targetId: providerId,
    summary: `Set what ${updated.businessName} may list: ${kinds.map((k) => k.toLowerCase()).join(", ")}`,
    changes: { kinds },
  });

  revalidatePath("/admin/providers");
  revalidatePath("/provider/listings");
  return { status: "ok", message: "Categories updated." };
}

/* ---------------------------------------------------------------- helpers */

/** A listing's name, as staff would recognise it in the activity log. */
async function listingName(kind: string, id: string) {
  if (kind === "TOUR") return (await db.tour.findUnique({ where: { id }, select: { name: true } }))?.name ?? id;
  if (kind === "HOTEL") return (await db.hotel.findUnique({ where: { id }, select: { name: true } }))?.name ?? id;
  if (kind === "VEHICLE") {
    const v = await db.vehicle.findUnique({ where: { id }, select: { make: true, model: true } });
    return v ? `${v.make} ${v.model}` : id;
  }
  const r = await db.room.findUnique({ where: { id }, select: { name: true, hotel: { select: { name: true } } } });
  return r ? `${r.hotel.name}: ${r.name}` : id;
}

async function actorIsSuper(id: string) {
  const u = await db.user.findUnique({ where: { id }, select: { role: true, isSuperAdmin: true, isActive: true } });
  return !!u?.isActive && u.role === "ADMIN" && u.isSuperAdmin;
}
