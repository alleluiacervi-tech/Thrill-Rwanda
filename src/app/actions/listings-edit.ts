"use server";

import { revalidatePath } from "next/cache";
import { refreshPublicCatalogue } from "@/lib/catalogue";
import { z } from "zod";
import { openCalendar } from "@/lib/booking";
import { db } from "@/lib/db";
import { isTourCollection } from "@/lib/journey-requests";
import { resolveListingScope, scopeFilter } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";
import {
  hotelSchema,
  imageUrls,
  roomSchema,
  tourSchema,
  toList,
  vehicleSchema,
  type ListingState,
} from "@/lib/listing-schemas";

/**
 * Editing existing listings (Step 12).
 *
 * Split from the creators because the risky part is different: creating
 * opens a calendar, editing has to *change* one that may already hold
 * bookings.
 *
 * Scope comes from the session: a provider is pinned to their own rows, an
 * admin reads across the platform. Ownership is never read from the form, so
 * an admin edit cannot reassign a listing whose bookings reference it.
 */

/** "Not found" phrased for whoever is asking. */
const notMine = (scope: { kind: string }, noun: string) =>
  scope.kind === "admin"
    ? `That ${noun} no longer exists.`
    : `That ${noun} isn't yours to edit.`;

function errorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

const fail = (
  message: string,
  fieldErrors?: Record<string, string>,
): ListingState => ({ status: "error", message, fieldErrors });

class CapacityConflict extends Error {}

// Reducing capacity below what is booked would trip the
// availability_not_overbooked CHECK, so look first and name the day. The
// constraint stays the backstop; this just makes the failure legible.
async function setCapacity(
  tx: Prisma.TransactionClient,
  serviceType: "TOUR" | "ROOM" | "VEHICLE",
  resourceId: string,
  newTotal: number,
) {
  const conflict = await tx.availability.findFirst({
    where: { serviceType, resourceId, unitsBooked: { gt: newTotal } },
    orderBy: { day: "asc" },
    select: { day: true, unitsBooked: true },
  });

  if (conflict) {
    const when = conflict.day.toISOString().slice(0, 10);
    throw new CapacityConflict(
      `You already have ${conflict.unitsBooked} booked on ${when}, so capacity can't drop to ${newTotal}. Cancel those bookings first, or keep capacity at ${conflict.unitsBooked} or above.`,
    );
  }

  await tx.availability.updateMany({
    where: { serviceType, resourceId },
    data: { unitsTotal: newTotal },
  });
}

/** Turns a CapacityConflict into a field error rather than a crash. */
async function runUpdate(
  work: () => Promise<{ id: string; slug: string }>,
  label: string,
): Promise<ListingState> {
  try {
    const row = await work();
    revalidatePath("/provider/listings");
    revalidatePath("/provider/availability");
    revalidatePath("/admin/listings");
    refreshPublicCatalogue();
    return { status: "success", id: row.id, slug: row.slug };
  } catch (err) {
    if (err instanceof CapacityConflict) {
      return fail(err.message, { quantity: "Too low for existing bookings." });
    }
    console.error(`[listings] ${label} update failed`, err);
    return fail(`We couldn't save that ${label}. Please try again.`);
  }
}


/* --------------------------------------------------------- edit vehicle */

export async function updateVehicle(
  _prev: ListingState,
  formData: FormData,
): Promise<ListingState> {
  const scope = await resolveListingScope();
  const id = String(formData.get("id") ?? "");

  const parsed = vehicleSchema.safeParse({
    make: formData.get("make"),
    model: formData.get("model"),
    year: formData.get("year"),
    category: formData.get("category"),
    seats: formData.get("seats"),
    transmission: formData.get("transmission"),
    fuelType: formData.get("fuelType"),
    quantity: formData.get("quantity"),
    pricePerDay: formData.get("pricePerDay"),
    driverPerDay: formData.get("driverPerDay") ?? "",
    insuranceCharge: formData.get("insuranceCharge") ?? "",
  });
  if (!parsed.success) {
    return fail("Please check the highlighted fields.", errorsFrom(parsed.error));
  }

  const owned = await db.vehicle.findFirst({
    where: { id, ...scopeFilter(scope) },
    select: { id: true, slug: true },
  });
  if (!owned) return fail(notMine(scope, "vehicle"));

  const v = parsed.data;
  const features = toList(formData.get("features"));
  const images = imageUrls(formData.get("images"));

  return runUpdate(
    () =>
      db.$transaction(async (tx) => {
        await setCapacity(tx, "VEHICLE", owned.id, v.quantity);
        return tx.vehicle.update({
          where: { id: owned.id },
          data: {
            make: v.make,
            model: v.model,
            year: v.year,
            category: v.category,
            seats: v.seats,
            transmission: v.transmission,
            fuelType: v.fuelType,
            quantity: v.quantity,
            pricePerDayMinor: v.pricePerDay,
            driverPerDayMinor: v.driverPerDay,
            insuranceChargeMinor: v.insuranceCharge,
            features,
            images,
            isPublished: formData.get("isPublished") === "on",
          },
          select: { id: true, slug: true },
        });
      }),
    "vehicle",
  );
}

/* ------------------------------------------------------------ edit tour */

/** The collection chosen in the tour form, or null when it is unfiled or not one we know. */
const tourCollection = (value: FormDataEntryValue | null) =>
  isTourCollection(value) ? value : null;

export async function updateTour(
  _prev: ListingState,
  formData: FormData,
): Promise<ListingState> {
  const scope = await resolveListingScope();
  const id = String(formData.get("id") ?? "");

  const parsed = tourSchema.safeParse({
    name: formData.get("name"),
    destination: formData.get("destination"),
    durationDays: formData.get("durationDays"),
    maxParticipants: formData.get("maxParticipants"),
    price: formData.get("price"),
    priceResident: formData.get("priceResident") ?? "",
    priceNonResident: formData.get("priceNonResident") ?? "",
    description: formData.get("description") ?? "",
    pickupInfo: formData.get("pickupInfo") ?? "",
  });
  if (!parsed.success) {
    return fail("Please check the highlighted fields.", errorsFrom(parsed.error));
  }

  const owned = await db.tour.findFirst({
    where: { id, ...scopeFilter(scope) },
    select: { id: true, slug: true },
  });
  if (!owned) return fail(notMine(scope, "tour"));

  const t = parsed.data;
  const activities = toList(formData.get("activities"));
  const images = imageUrls(formData.get("images"));

  return runUpdate(
    () =>
      db.$transaction(async (tx) => {
        await setCapacity(tx, "TOUR", owned.id, t.maxParticipants);
        return tx.tour.update({
          where: { id: owned.id },
          data: {
            name: t.name,
            destination: t.destination,
            description: t.description || null,
            pickupInfo: t.pickupInfo || null,
          collection: tourCollection(formData.get("collection")),
          // Unticked boxes are absent from the form, so absence means off.
          enquiryOnly: formData.get("enquiryOnly") === "on",
          fixedDepartures: formData.get("fixedDepartures") === "on",
          itinerary: String(formData.get("itinerary") ?? "").trim().slice(0,6000),
          suitability: String(formData.get("suitability") ?? "").trim().slice(0,3000),
          inclusions: toList(formData.get("inclusions")),
          exclusions: toList(formData.get("exclusions")),
          offerApproval: null,
          isPublished: false,
            durationDays: t.durationDays,
            maxParticipants: t.maxParticipants,
            priceMinor: t.price,
            priceResidentMinor: t.priceResident,
            priceNonResidentMinor: t.priceNonResident,
            activities,
            images,
          },
          select: { id: true, slug: true },
        });
      }),
    "tour",
  );
}

/* ----------------------------------------------------------- edit hotel */

export async function updateHotel(
  _prev: ListingState,
  formData: FormData,
): Promise<ListingState> {
  const scope = await resolveListingScope();
  const id = String(formData.get("id") ?? "");

  const parsedHotel = hotelSchema.safeParse({
    name: formData.get("name"),
    location: formData.get("location"),
    stars: formData.get("stars") || undefined,
    description: formData.get("description") ?? "",
  });
  if (!parsedHotel.success) {
    return fail("Please check the highlighted fields.", errorsFrom(parsedHotel.error));
  }

  const owned = await db.hotel.findFirst({
    where: { id, ...scopeFilter(scope) },
    select: { id: true, slug: true, rooms: { select: { id: true } } },
  });
  if (!owned) return fail(notMine(scope, "property"));

  const ownedRoomIds = new Set(owned.rooms.map((r) => r.id));

  /* Rooms arrive as parallel arrays. `roomId` is blank for a newly added row
     and carries the existing id otherwise, so one pass handles both update
     and insert. */
  const ids = formData.getAll("roomId");
  const names = formData.getAll("roomName");
  const capacities = formData.getAll("roomCapacity");
  const quantities = formData.getAll("roomQuantity");
  const prices = formData.getAll("roomPrice");

  type Row = z.infer<typeof roomSchema> & { id: string | null };
  const rows: Row[] = [];

  for (let i = 0; i < names.length; i++) {
    if (!String(names[i] ?? "").trim()) continue;

    const parsedRoom = roomSchema.safeParse({
      name: names[i],
      capacity: capacities[i],
      quantity: quantities[i],
      price: prices[i],
    });
    if (!parsedRoom.success) {
      return fail(
        `Room ${i + 1}: ${parsedRoom.error.issues[0]?.message ?? "check those details"}`,
        { rooms: `Room ${i + 1} needs attention.` },
      );
    }

    const rawId = String(ids[i] ?? "").trim();
    // Reject an id that isn't one of this hotel's rooms rather than
    // silently treating it as a new room.
    if (rawId && !ownedRoomIds.has(rawId)) {
      return fail("One of those rooms doesn't belong to this property.");
    }
    rows.push({ ...parsedRoom.data, id: rawId || null });
  }

  if (rows.length === 0) {
    return fail("A property needs at least one room type to be bookable.", {
      rooms: "At least one room type is required.",
    });
  }

  const h = parsedHotel.data;
  const amenities = toList(formData.get("amenities"));
  const images = imageUrls(formData.get("images"));

  return runUpdate(
    () =>
      db.$transaction(async (tx) => {
        for (const r of rows) {
          if (r.id) {
            await setCapacity(tx, "ROOM", r.id, r.quantity);
            await tx.room.update({
              where: { id: r.id },
              data: {
                name: r.name,
                capacity: r.capacity,
                quantity: r.quantity,
                pricePerNightMinor: r.price,
              },
            });
          } else {
            const room = await tx.room.create({
              data: {
                hotelId: owned.id,
                name: r.name,
                capacity: r.capacity,
                quantity: r.quantity,
                pricePerNightMinor: r.price,
                isPublished: false,
              },
              select: { id: true },
            });
            await openCalendar(tx, {
              serviceType: "ROOM",
              resourceId: room.id,
              unitsTotal: r.quantity,
            });
          }
        }

        return tx.hotel.update({
          where: { id: owned.id },
          data: {
            name: h.name,
            location: h.location,
            description: h.description || null,
            stars: h.stars ?? null,
            amenities,
            images,
          },
          select: { id: true, slug: true },
        });
      }),
    "property",
  );
}
