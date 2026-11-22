"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/session";
import { layouts, meetingVenues, spaceTypes } from "@/lib/meeting-directory";

const id = z.string().uuid().or(z.literal(""));
const optionalLink = z.url({ protocol: /^https$/ }).max(1000).or(z.literal(""));
const capacity = z.string().trim().regex(/^$|^[1-9]\d{0,4}$/).transform((value) => value ? Number(value) : null);
const shared = {
  id,
  updatedAt: z.iso.datetime().or(z.literal("")),
  name: z.string().trim().min(2).max(120),
  visibility: z.enum(["draft", "published"]),
};
const venueSchema = z.object({
  ...shared,
  kind: z.enum(["Hotel", "Convention centre"]),
  description: z.string().trim().min(10).max(600),
  source: optionalLink,
  image: optionalLink,
});
const spaceSchema = z.object({
  ...shared,
  venueId: z.uuid(),
  type: z.enum(spaceTypes),
  maximum: capacity,
  features: z.string().trim().max(1000),
  capacities: z.partialRecord(z.enum(layouts), capacity),
});

export type BusinessVenueState = { status: "idle" | "ok" | "error"; message?: string };

export async function saveBusinessVenue(_state: BusinessVenueState, form: FormData): Promise<BusinessVenueState> {
  const actor = await requireAdmin("/admin/business-venues");
  const parsed = venueSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "Check the venue name and description. Use HTTPS for website and photo URLs." };
  const input = parsed.data;
  if (input.id && !input.updatedAt) return { status: "error", message: "Reload this venue before editing." };
  const slug = input.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!input.id && (!slug || meetingVenues.some((property) => property.slug === slug)))
    return { status: "error", message: "Choose a name that differs from an existing directory property." };
  try {
    const data = {
      name: input.name, kind: input.kind, description: input.description,
      source: input.source || null, image: input.image || null,
      isPublished: input.visibility === "published",
    };
    const saved = input.id
      ? await db.businessVenue.update({ where: { id: input.id, updatedAt: input.updatedAt || undefined }, data })
      : await db.businessVenue.create({ data: { ...data, slug } });
    await logActivity(actor.id, { action: "business_venue.save", area: "Venues", target: saved.name, targetId: saved.id, summary: `Saved business venue as ${input.visibility}` });
    revalidatePath("/admin/business-venues");
    revalidatePath("/events-business");
    return { status: "ok", message: "Venue saved. Add at least one published room to show it in the directory." };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002")
      return { status: "error", message: "A venue with this name already exists." };
    return { status: "error", message: "Could not save this venue. Reload before retrying." };
  }
}

export async function saveBusinessVenueSpace(_state: BusinessVenueState, form: FormData): Promise<BusinessVenueState> {
  const actor = await requireAdmin("/admin/business-venues");
  const parsed = spaceSchema.safeParse({
    ...Object.fromEntries(form),
    capacities: Object.fromEntries(layouts.map((layout) => [layout, form.get(`capacity-${layout}`)])),
  });
  if (!parsed.success) return { status: "error", message: "Check the space name, layout capacities and room details." };
  const input = parsed.data;
  if (input.id && !input.updatedAt) return { status: "error", message: "Reload this meeting space before editing." };
  if (input.maximum && Object.values(input.capacities).some((value) => (value ?? 0) > input.maximum!))
    return { status: "error", message: "Maximum capacity must cover the largest published layout." };
  try {
    const data = {
      name: input.name, type: input.type, maximum: input.maximum, features: input.features || null,
      capacities: Object.fromEntries(Object.entries(input.capacities).filter(([, value]) => value !== null)),
      isPublished: input.visibility === "published",
    };
    const saved = input.id
      ? await db.businessVenueSpace.update({ where: { id: input.id, venueId: input.venueId, updatedAt: input.updatedAt || undefined }, data })
      : await db.businessVenueSpace.create({ data: { ...data, venueId: input.venueId } });
    await logActivity(actor.id, { action: "business_venue.space.save", area: "Venues", target: saved.name, targetId: saved.id, summary: `Saved meeting space as ${input.visibility}` });
    revalidatePath("/admin/business-venues");
    revalidatePath("/events-business");
    return { status: "ok", message: "Meeting space saved." };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002")
      return { status: "error", message: "This venue already has a room with that name." };
    return { status: "error", message: "Could not save this meeting space. Reload before retrying." };
  }
}
