"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { db } from "@/lib/db";
import { imageUrls, toList } from "@/lib/listing-schemas";
import { requireAdmin } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { publishBlocker, venueSchema, type VenueState } from "@/lib/venue-rules";
import { logActivity } from "@/lib/activity";

/**
 * Admin-only management of the venue catalogue shown on /weddings.
 *
 * Venues are Thrill Rwanda's own list, not a provider's listing, so only an
 * administrator can add, change, publish or remove one.
 */

type RowState = { status: "idle" | "error" | "ok"; message?: string };

function parse(formData: FormData) {
  return venueSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    location: formData.get("location"),
    capacity: formData.get("capacity"),
    description: formData.get("description"),
  });
}

function invalid(error: z.ZodError): VenueState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key) fieldErrors[key] ??= issue.message;
  }
  return { status: "error", message: "Please check the highlighted fields.", fieldErrors };
}

function refresh() {
  revalidatePath("/admin/venues");
  revalidatePath("/weddings");
}

/** A slug nobody else has: the name, then the name with a number. */
async function freeSlug(name: string) {
  const base = slugify(name) || "venue";
  for (let n = 1; n < 50; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await db.venue.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  return `${base}-${Date.now()}`;
}

export async function createVenue(_prev: VenueState, formData: FormData): Promise<VenueState> {
  const admin = await requireAdmin();
  const parsed = parse(formData);
  if (!parsed.success) return invalid(parsed.error);

  try {
    // Saved as a draft: it appears on the public page only once published.
    const venue = await db.venue.create({
      data: {
        ...parsed.data,
        slug: await freeSlug(parsed.data.name),
        features: toList(formData.get("features")),
        images: imageUrls(formData.get("images")),
      },
      select: { id: true, slug: true },
    });
    await logActivity(admin.id, {
      action: "venue.create",
      area: "Venues",
      target: parsed.data.name,
      targetId: venue.id,
      summary: `Added venue ${parsed.data.name} (${parsed.data.location}) as a draft`,
    });
    refresh();
    return { status: "success", ...venue };
  } catch (err) {
    console.error("[venues] create failed", err);
    return { status: "error", message: "We couldn't save that venue. Please try again." };
  }
}

export async function updateVenue(_prev: VenueState, formData: FormData): Promise<VenueState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = parse(formData);
  if (!parsed.success) return invalid(parsed.error);

  const existing = await db.venue.findUnique({ where: { id }, select: { id: true, isPublished: true } });
  if (!existing) return { status: "error", message: "That venue no longer exists." };

  const images = imageUrls(formData.get("images"));
  // A published venue must stay fit to be seen: it cannot be saved without its photographs.
  const blocker = existing.isPublished
    ? publishBlocker({ images, description: parsed.data.description })
    : null;
  if (blocker) return { status: "error", message: `${blocker} Hide the venue first if you need to remove them.` };

  try {
    const venue = await db.venue.update({
      where: { id },
      // The slug stays put, so links already shared keep working.
      data: { ...parsed.data, features: toList(formData.get("features")), images },
      select: { id: true, slug: true },
    });
    await logActivity(admin.id, {
      action: "venue.update",
      area: "Venues",
      target: parsed.data.name,
      targetId: venue.id,
      summary: `Edited venue ${parsed.data.name}`,
      changes: { ...parsed.data, images: images.length } as never,
    });
    refresh();
    return { status: "success", ...venue };
  } catch (err) {
    console.error("[venues] update failed", err);
    return { status: "error", message: "We couldn't save that venue. Please try again." };
  }
}

export async function setVenuePublished(_prev: RowState, formData: FormData): Promise<RowState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const publish = formData.get("publish") === "true";

  const venue = await db.venue.findUnique({ where: { id }, select: { images: true, description: true, name: true } });
  if (!venue) return { status: "error", message: "That venue no longer exists." };
  if (publish) {
    const blocker = publishBlocker(venue);
    if (blocker) return { status: "error", message: blocker };
  }

  await db.venue.update({ where: { id }, data: { isPublished: publish } });
  await logActivity(admin.id, {
    action: publish ? "venue.publish" : "venue.hide",
    area: "Venues",
    target: venue.name,
    targetId: id,
    summary: `${publish ? "Published" : "Hid"} venue ${venue.name}`,
  });
  refresh();
  return { status: "ok" };
}

export async function deleteVenue(_prev: RowState, formData: FormData): Promise<RowState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = (await db.venue.findUnique({ where: { id }, select: { name: true } }))?.name ?? "a venue";
  try {
    await db.venue.delete({ where: { id } });
  } catch {
    return { status: "error", message: "That venue no longer exists." };
  }
  await logActivity(admin.id, {
    action: "venue.delete",
    area: "Venues",
    target: name,
    targetId: id,
    summary: `Deleted venue ${name}`,
  });
  refresh();
  return { status: "ok" };
}
