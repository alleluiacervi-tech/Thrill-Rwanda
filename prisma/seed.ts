import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { adapterFor } from "../src/lib/db-adapter";
import {
  hotelRooms,
  hotels,
  tours,
  vehicles,
} from "../src/lib/content";
import {
  galleryImages,
  hotelImages,
  tourImages,
  vehicleImages,
} from "../src/lib/images";

/**
 * Seeds the demo catalogue from src/lib/content.ts into Postgres, then
 * generates availability rows so the booking engine has real inventory to
 * hold. Idempotent: re-running updates rather than duplicating.
 *
 *   npm run db:seed
 *
 * The provider users get no Account row, so nobody can sign in as them.
 * Give one a password through the app's sign-up if you need to log in as a
 * provider, then promote the role.
 */

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL / DATABASE_URL not set");

const db = new PrismaClient({ adapter: adapterFor(connectionString) });

/** How far ahead to open the calendar. */
const DAYS_AHEAD = 365;

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Hero image plus two gallery frames, skipping any that are missing. */
function imagesFor(hero?: string) {
  return [hero, ...galleryImages.slice(0, 2)].filter(Boolean) as string[];
}

function utcDay(offset: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

async function main() {
  console.log("seeding…");

  /* ------------------------------------------------------------ providers */
  const providerNames = Array.from(
    new Set([
      ...tours.map((t) => t.provider),
      ...hotels.map((h) => h.provider),
      ...vehicles.map((v) => v.provider),
    ]),
  );

  const providerByName = new Map<string, string>();

  // Derived from what they actually list — `kind` defaults to TOUR, which
  // made every seeded provider a "tour operator" and emptied the admin
  // filters. Majority wins; TOUR breaks a tie, being the default.
  function kindFor(name: string): "TOUR" | "HOTEL" | "CAR" {
    const t = tours.filter((x) => x.provider === name).length;
    const h = hotels.filter((x) => x.provider === name).length;
    const v = vehicles.filter((x) => x.provider === name).length;
    if (v > t && v > h) return "CAR";
    if (h > t && h >= v) return "HOTEL";
    return "TOUR";
  }

  for (const name of providerNames) {
    const slug = slugify(name);
    const email = `${slug}@providers.thrillrwanda.test`;
    const kind = kindFor(name);

    const user = await db.user.upsert({
      where: { email },
      update: { fullName: name, role: "PROVIDER" },
      create: {
        email,
        fullName: name,
        role: "PROVIDER",
        emailVerified: true,
      },
    });

    const provider = await db.provider.upsert({
      where: { userId: user.id },
      // `kind` is in the update too, so re-seeding backfills providers that
      // were created before this was derived.
      update: { businessName: name, status: "VERIFIED", kind },
      create: {
        userId: user.id,
        businessName: name,
        slug,
        kind,
        status: "VERIFIED",
        verifiedAt: new Date(),
        about: `${name} is a verified Thrill Rwanda partner operating in Rwanda.`,
      },
    });

    providerByName.set(name, provider.id);
  }
  console.log(`  providers: ${providerByName.size}`);

  /* ------------------------------------------ availability row generation */
  const availabilityRows: {
    serviceType: "TOUR" | "ROOM" | "VEHICLE" | "TRANSFER";
    resourceId: string;
    day: Date;
    unitsTotal: number;
  }[] = [];

  const openCalendar = (
    serviceType: "TOUR" | "ROOM" | "VEHICLE",
    resourceId: string,
    unitsTotal: number,
  ) => {
    for (let i = 0; i < DAYS_AHEAD; i++) {
      availabilityRows.push({
        serviceType,
        resourceId,
        day: utcDay(i),
        unitsTotal,
      });
    }
  };

  /* ---------------------------------------------------------------- tours */
  for (const t of tours) {
    const providerId = providerByName.get(t.provider)!;
    const row = await db.tour.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        destination: t.destination,
        description: t.summary,
        durationDays: t.durationDays,
        activities: t.activities,
        maxParticipants: t.maxParticipants,
        priceMinor: t.priceFrom,
        isPublished: true,
        providerId,
        images: imagesFor(tourImages[t.slug]),
      },
      create: {
        slug: t.slug,
        name: t.name,
        destination: t.destination,
        description: t.summary,
        durationDays: t.durationDays,
        activities: t.activities,
        maxParticipants: t.maxParticipants,
        priceMinor: t.priceFrom,
        isPublished: true,
        providerId,
        images: imagesFor(tourImages[t.slug]),
        pickupInfo: "Pickup from your Kigali hotel, or the airport on request.",
      },
    });
    // A tour's capacity is seats per departure.
    openCalendar("TOUR", row.id, t.maxParticipants);
  }
  console.log(`  tours: ${tours.length}`);

  /* --------------------------------------------------------------- hotels */
  let roomCount = 0;
  for (const h of hotels) {
    const providerId = providerByName.get(h.provider)!;
    const hotel = await db.hotel.upsert({
      where: { slug: h.slug },
      update: {
        name: h.name,
        location: h.location,
        description: h.summary,
        amenities: h.amenities,
        stars: h.stars,
        isPublished: true,
        providerId,
        images: imagesFor(hotelImages[h.slug]),
      },
      create: {
        slug: h.slug,
        name: h.name,
        location: h.location,
        description: h.summary,
        amenities: h.amenities,
        stars: h.stars,
        isPublished: true,
        providerId,
        images: imagesFor(hotelImages[h.slug]),
      },
    });

    // Properties without a defined room list get one standard room type.
    const rooms = hotelRooms[h.slug] ?? [
      {
        slug: `${h.slug}-standard`,
        name: "Standard Room",
        capacity: 2,
        pricePerNight: h.priceFrom,
        size: "—",
        beds: "1 double",
        features: h.amenities.slice(0, 3),
      },
    ];

    for (const r of rooms) {
      // Room has no unique slug column, so match on hotel + name.
      const existing = await db.room.findFirst({
        where: { hotelId: hotel.id, name: r.name },
        select: { id: true },
      });

      const data = {
        hotelId: hotel.id,
        name: r.name,
        capacity: r.capacity,
        quantity: 4,
        pricePerNightMinor: r.pricePerNight,
        isPublished: true,
        description: r.features.join(" · "),
      };

      const room = existing
        ? await db.room.update({ where: { id: existing.id }, data })
        : await db.room.create({ data });

      openCalendar("ROOM", room.id, room.quantity);
      roomCount++;
    }
  }
  console.log(`  hotels: ${hotels.length}, rooms: ${roomCount}`);

  /* ------------------------------------------------------------- vehicles */
  for (const v of vehicles) {
    const providerId = providerByName.get(v.provider)!;
    const row = await db.vehicle.upsert({
      where: { slug: v.slug },
      update: {
        make: v.make,
        model: v.model,
        year: v.year,
        category: v.category,
        seats: v.seats,
        transmission: v.transmission,
        fuelType: v.fuel,
        features: v.features,
        pricePerDayMinor: v.pricePerDay,
        isPublished: true,
        providerId,
        images: imagesFor(vehicleImages[v.slug]),
      },
      create: {
        slug: v.slug,
        make: v.make,
        model: v.model,
        year: v.year,
        category: v.category,
        seats: v.seats,
        transmission: v.transmission,
        fuelType: v.fuel,
        features: v.features,
        pricePerDayMinor: v.pricePerDay,
        isPublished: true,
        providerId,
        images: imagesFor(vehicleImages[v.slug]),
      },
    });
    // Two identical units of each vehicle in the fleet.
    openCalendar("VEHICLE", row.id, 2);
  }
  console.log(`  vehicles: ${vehicles.length}`);

  /* --------------------------------------------------------- availability */
  // createMany + skipDuplicates keeps this idempotent without wiping
  // unitsBooked on rows that already carry real bookings.
  let written = 0;
  const CHUNK = 1000;
  for (let i = 0; i < availabilityRows.length; i += CHUNK) {
    const res = await db.availability.createMany({
      data: availabilityRows.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
    written += res.count;
  }
  console.log(
    `  availability: ${written} new rows (${availabilityRows.length} considered, ${DAYS_AHEAD} days ahead)`,
  );

  console.log("seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
