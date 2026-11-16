"use server";

import { revalidatePath } from "next/cache";
import { refreshPublicCatalogue } from "@/lib/catalogue";
import { z } from "zod";
import { openCalendar } from "@/lib/booking";
import { db } from "@/lib/db";
import { isTourCollection } from "@/lib/journey-requests";
import {
  hotelSchema,
  imageUrls,
  roomSchema,
  toList,
  tourSchema,
  vehicleSchema,
  type ListingState,
} from "@/lib/listing-schemas";
import { ListingOwnerError, resolveListingOwner } from "@/lib/session";
import { slugify } from "@/lib/utils";

/**
 * Provider listing management (Step 12).
 *
 * Two rules hold across every creator here:
 *
 * 1. **The calendar opens in the same transaction as the listing.** A listing
 *    with no `availability` rows is not merely empty — it is unbookable,
 *    because `createBooking` requires a row for every day in the range and
 *    reads a short count as "no longer available". Creating one without the
 *    other would produce a listing that looks live and can never be booked.
 *
 * 2. **New listings are drafts.** `isPublished` starts false so a provider
 *    can check their own work before it reaches search results. Publishing
 *    is a separate, deliberate action.
 *
 * `providerId` comes from `resolveListingOwner()`, which reads the session
 * for a provider and the submitted field only for an admin posting on a
 * provider's behalf. A provider can never name a different owner.
 */

function errorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

const fail = (message: string, fieldErrors?: Record<string, string>): ListingState => ({
  status: "error",
  message,
  fieldErrors,
});


async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
) {
  const root = slugify(base) || "listing";
  let candidate = root;
  for (let i = 2; i < 60; i++) {
    if (!(await exists(candidate))) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

/* ------------------------------------------------------------- vehicles */

export async function createVehicle(
  _prev: ListingState,
  formData: FormData,
): Promise<ListingState> {
  let providerId: string;
  try {
    ({ providerId } = await resolveListingOwner(formData, undefined, "CAR"));
  } catch (err) {
    if (err instanceof ListingOwnerError) return fail(err.message, { providerId: err.message });
    throw err;
  }

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

  const v = parsed.data;
  const features = toList(formData.get("features"));
  const images = imageUrls(formData.get("images"));

  const slug = await uniqueSlug(
    `${v.make} ${v.model} ${v.year}`,
    async (s) => (await db.vehicle.count({ where: { slug: s } })) > 0,
  );

  try {
    const created = await db.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.create({
        data: {
          providerId,
          make: v.make,
          model: v.model,
          year: v.year,
          slug,
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
          // Draft unless "Available for rental" was ticked. See rule 2 above.
          isPublished: formData.get("isPublished") === "on",
        },
        select: { id: true, slug: true },
      });

      // Same transaction. See rule 1 above.
      await openCalendar(tx, {
        serviceType: "VEHICLE",
        resourceId: vehicle.id,
        unitsTotal: v.quantity,
      });

      return vehicle;
    });

    revalidatePath("/provider/listings");
    revalidatePath("/provider/availability");
    revalidatePath("/admin/listings");
    refreshPublicCatalogue();
    return { status: "success", id: created.id, slug: created.slug };
  } catch (err) {
    console.error("[listings] vehicle create failed", err);
    return fail("We couldn't save that vehicle. Please try again.");
  }
}

/* ---------------------------------------------------------------- tours */

/** The collection chosen in the tour form, or null when it is unfiled or not one we know. */
const tourCollection = (value: FormDataEntryValue | null) =>
  isTourCollection(value) ? value : null;

export async function createTour(
  _prev: ListingState,
  formData: FormData,
): Promise<ListingState> {
  let providerId: string;
  try {
    ({ providerId } = await resolveListingOwner(formData, undefined, "TOUR"));
  } catch (err) {
    if (err instanceof ListingOwnerError) return fail(err.message, { providerId: err.message });
    throw err;
  }

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

  const t = parsed.data;
  const activities = toList(formData.get("activities"));
  const images = imageUrls(formData.get("images"));

  const slug = await uniqueSlug(
    t.name,
    async (s) => (await db.tour.count({ where: { slug: s } })) > 0,
  );

  try {
    const created = await db.$transaction(async (tx) => {
      const tour = await tx.tour.create({
        data: {
          providerId,
          name: t.name,
          slug,
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

      // A tour's daily capacity is seats per departure.
      await openCalendar(tx, {
        serviceType: "TOUR",
        resourceId: tour.id,
        unitsTotal: t.maxParticipants,
      });

      return tour;
    });

    revalidatePath("/provider/listings");
    revalidatePath("/provider/availability");
    revalidatePath("/admin/listings");
    refreshPublicCatalogue();
    return { status: "success", id: created.id, slug: created.slug };
  } catch (err) {
    console.error("[listings] tour create failed", err);
    return fail("We couldn't save that tour. Please try again.");
  }
}

/* --------------------------------------------------------------- hotels */

/**
 * Creates a property and its room types together.
 *
 * A hotel on its own is not bookable — rooms are. `resolveResource` in the
 * booking action looks up a hotel's cheapest published room, so a property
 * saved with no rooms would appear in search and fail at the point of
 * booking. At least one room type is therefore required, and the calendar
 * is opened per ROOM (each with its own capacity), never per hotel.
 */
export async function createHotel(
  _prev: ListingState,
  formData: FormData,
): Promise<ListingState> {
  let providerId: string;
  try {
    ({ providerId } = await resolveListingOwner(formData, undefined, "HOTEL"));
  } catch (err) {
    if (err instanceof ListingOwnerError) return fail(err.message, { providerId: err.message });
    throw err;
  }

  const parsedHotel = hotelSchema.safeParse({
    name: formData.get("name"),
    location: formData.get("location"),
    stars: formData.get("stars") || undefined,
    description: formData.get("description") ?? "",
  });

  if (!parsedHotel.success) {
    return fail("Please check the highlighted fields.", errorsFrom(parsedHotel.error));
  }

  // Room fields arrive as parallel arrays — one entry per repeated row.
  const names = formData.getAll("roomName");
  const capacities = formData.getAll("roomCapacity");
  const quantities = formData.getAll("roomQuantity");
  const prices = formData.getAll("roomPrice");

  const rooms: z.infer<typeof roomSchema>[] = [];
  for (let i = 0; i < names.length; i++) {
    // Skip blank rows so an untouched extra row isn't an error.
    if (!String(names[i] ?? "").trim()) continue;

    const parsedRoom = roomSchema.safeParse({
      name: names[i],
      capacity: capacities[i],
      quantity: quantities[i],
      price: prices[i],
    });
    if (!parsedRoom.success) {
      const first = parsedRoom.error.issues[0];
      return fail(
        `Room ${i + 1}: ${first?.message ?? "check those details"}`,
        { rooms: `Room ${i + 1} needs attention.` },
      );
    }
    rooms.push(parsedRoom.data);
  }

  if (rooms.length === 0) {
    return fail("Add at least one room type — a property with no rooms can't be booked.", {
      rooms: "At least one room type is required.",
    });
  }

  const h = parsedHotel.data;
  const amenities = toList(formData.get("amenities"));
  const images = imageUrls(formData.get("images"));

  const slug = await uniqueSlug(
    h.name,
    async (s) => (await db.hotel.count({ where: { slug: s } })) > 0,
  );

  try {
    const created = await db.$transaction(async (tx) => {
      const hotel = await tx.hotel.create({
        data: {
          providerId,
          name: h.name,
          slug,
          location: h.location,
          description: h.description || null,
          stars: h.stars ?? null,
          amenities,
          images,
          isPublished: false,
        },
        select: { id: true, slug: true },
      });

      for (const r of rooms) {
        const room = await tx.room.create({
          data: {
            hotelId: hotel.id,
            name: r.name,
            capacity: r.capacity,
            quantity: r.quantity,
            pricePerNightMinor: r.price,
            isPublished: false,
          },
          select: { id: true },
        });

        // Per room, with that room type's own physical count as capacity.
        await openCalendar(tx, {
          serviceType: "ROOM",
          resourceId: room.id,
          unitsTotal: r.quantity,
        });
      }

      return hotel;
    });

    revalidatePath("/provider/listings");
    revalidatePath("/provider/availability");
    revalidatePath("/admin/listings");
    refreshPublicCatalogue();
    return { status: "success", id: created.id, slug: created.slug };
  } catch (err) {
    console.error("[listings] hotel create failed", err);
    return fail("We couldn't save that property. Please try again.");
  }
}
