import { getPublications } from "@/lib/publication";
import { isTourCollection, type TourCollection } from "@/lib/journey-requests";
import { cache } from "react";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { destinations, type Destination } from "@/lib/content";
import { imageFor } from "@/lib/images";
import { lowestRate } from "@/lib/residency";
import type { ServiceType } from "@/generated/prisma/enums";

// The public catalogue, read from the database. Only published listings from
// verified providers ever leave this module, so pages never filter themselves.

export type CatalogueTour = {
  /** The collection this offer is filed under, or null. */
  collection: TourCollection | null;
  /** Sold by written quote only, even while trips can be booked directly. */
  enquiryOnly: boolean;
  /** Runs only on its scheduled departures (src/lib/departures.ts). */
  fixedDepartures: boolean;
  itinerary: string;
  suitability: string;
  inclusions: string[];
  exclusions: string[];
  id: string;
  slug: string;
  name: string;
  destination: string;
  durationDays: number;
  nights: number;
  /** The cheapest rate, for cards. */
  priceFrom: number;
  /** Per-person rates by residency; residents and visitors fall back to the citizen rate. */
  priceMinor: number;
  priceResidentMinor: number | null;
  priceNonResidentMinor: number | null;
  maxParticipants: number;
  activities: string[];
  summary: string;
  pickupInfo: string | null;
  provider: string;
  badge?: string;
  /** Average of published reviews, or null while it has none. */
  rating: number | null;
  reviews: number;
  image?: string;
  images: string[];
};

export type CatalogueRoom = {
  id: string;
  name: string;
  capacity: number;
  pricePerNight: number;
  features: string[];
};

export type CatalogueHotel = {
  id: string;
  slug: string;
  name: string;
  location: string;
  stars: number | null;
  priceFrom: number;
  maxGuests: number;
  amenities: string[];
  summary: string;
  provider: string;
  badge?: string;
  rating: number | null;
  reviews: number;
  image?: string;
  images: string[];
  rooms: CatalogueRoom[];
};

export type CatalogueVehicle = {
  id: string;
  slug: string;
  make: string;
  model: string;
  year: number;
  category: string;
  seats: number;
  transmission: string;
  fuel: string;
  pricePerDay: number;
  /** Extra per day for a driver; null means self-drive only. */
  driverPerDay: number | null;
  /** What the customer agrees to be liable for if the vehicle is damaged. */
  insuranceCharge: number | null;
  features: string[];
  provider: string;
  badge?: string;
  rating: number | null;
  reviews: number;
  image?: string;
  images: string[];
};

const LIVE_PROVIDER = { status: "VERIFIED" } as const;

const TAG = "catalogue";
// Shared across requests: the filterable list pages render per visit and would otherwise query the DB every time.
const shared = <T>(key: string, fn: () => Promise<T>) =>
  cache(unstable_cache(fn, ["catalogue", key], { tags: [TAG], revalidate: 300 }));

// Uploaded photos first; the placeholder set only fills a listing that has none.
function photos(kind: "tour" | "hotel" | "vehicle", slug: string, stored: string[]) {
  const images = stored.length ? stored : [imageFor(kind, slug)].filter(Boolean) as string[];
  return { image: images[0], images };
}

type Tally = { sum: number; count: number };

/** Published-review totals per listing id, in one query per service type. */
async function reviewTallies(serviceType: ServiceType, ids: string[]) {
  const tallies = new Map<string, Tally>();
  if (!ids.length) return tallies;
  const rows = await db.review.groupBy({
    by: ["resourceId"],
    where: { status: "PUBLISHED", serviceType, resourceId: { in: ids } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  for (const r of rows) {
    tallies.set(r.resourceId, { sum: (r._avg.rating ?? 0) * r._count._all, count: r._count._all });
  }
  return tallies;
}

function toRating(t: Tally | undefined) {
  return t && t.count > 0
    ? { rating: Math.round((t.sum / t.count) * 10) / 10, reviews: t.count }
    : { rating: null, reviews: 0 };
}

/* ------------------------------------------------------------------ tours */

const tourInclude = { provider: { select: { businessName: true } } } as const;

type TourRow = Awaited<ReturnType<typeof db.tour.findMany<{ include: typeof tourInclude }>>>[number];

function mapTour(t: TourRow, tallies: Map<string, Tally>): CatalogueTour {
  return {
    collection: isTourCollection(t.collection) ? t.collection : null,
    enquiryOnly: t.enquiryOnly,
    fixedDepartures: t.fixedDepartures,
    itinerary: t.itinerary, suitability: t.suitability, inclusions: t.inclusions, exclusions: t.exclusions,
    id: t.id,
    slug: t.slug,
    name: t.name,
    destination: t.destination,
    durationDays: t.durationDays,
    nights: Math.max(0, t.durationDays - 1),
    priceFrom: lowestRate(t),
    priceMinor: t.priceMinor,
    priceResidentMinor: t.priceResidentMinor,
    priceNonResidentMinor: t.priceNonResidentMinor,
    maxParticipants: t.maxParticipants,
    activities: t.activities,
    summary: t.description ?? "",
    pickupInfo: t.pickupInfo,
    provider: t.provider.businessName,
    badge: t.durationDays === 1 ? "Day trip" : undefined,
    ...toRating(tallies.get(t.id)),
    ...photos("tour", t.slug, t.images),
  };
}

export const listTours = shared("tours", async (): Promise<CatalogueTour[]> => {
  if ((await getPublications()).TRIP === "HIDDEN") return [];
  const rows = await db.tour.findMany({
    where: { isPublished: true, offerApproval: { not: null }, provider: LIVE_PROVIDER },
    include: tourInclude,
    orderBy: { createdAt: "asc" },
  });
  const tallies = await reviewTallies("TOUR", rows.map((r) => r.id));
  return rows.map((r) => mapTour(r, tallies));
});

export const getTour = cache(async (slug: string) => {
  if ((await getPublications()).TRIP === "HIDDEN") return null;
  const row = await db.tour.findFirst({
    where: { slug, isPublished: true, offerApproval: { not: null }, provider: LIVE_PROVIDER },
    include: tourInclude,
  });
  if (!row) return null;
  return mapTour(row, await reviewTallies("TOUR", [row.id]));
});

/* ----------------------------------------------------------------- hotels */

const hotelInclude = {
  provider: { select: { businessName: true } },
  rooms: { where: { isPublished: true }, orderBy: { pricePerNightMinor: "asc" } },
} as const;

type HotelRow = Awaited<ReturnType<typeof db.hotel.findMany<{ include: typeof hotelInclude }>>>[number];

// A hotel's rating pools every one of its rooms, since reviews attach to the room booked.
function mapHotel(h: HotelRow, tallies: Map<string, Tally>): CatalogueHotel {
  const pooled = h.rooms.reduce<Tally>(
    (acc, room) => {
      const t = tallies.get(room.id);
      return t ? { sum: acc.sum + t.sum, count: acc.count + t.count } : acc;
    },
    { sum: 0, count: 0 },
  );

  return {
    id: h.id,
    slug: h.slug,
    name: h.name,
    location: h.location,
    stars: h.stars,
    priceFrom: h.rooms[0]?.pricePerNightMinor ?? 0,
    maxGuests: Math.max(1, ...h.rooms.map((r) => r.capacity)),
    amenities: h.amenities,
    summary: h.description ?? "",
    provider: h.provider.businessName,
    ...toRating(pooled),
    ...photos("hotel", h.slug, h.images),
    rooms: h.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      capacity: r.capacity,
      pricePerNight: r.pricePerNightMinor,
      features: (r.description ?? "").split("·").map((f) => f.trim()).filter(Boolean),
    })),
  };
}

// A hotel with no published room has nothing to book, so it stays off the site.
const liveHotel = {
  isPublished: true,
  provider: LIVE_PROVIDER,
  rooms: { some: { isPublished: true } },
} as const;

export const listHotels = shared("hotels", async (): Promise<CatalogueHotel[]> => {
  if ((await getPublications()).STAY === "HIDDEN") return [];
  const rows = await db.hotel.findMany({ where: liveHotel, include: hotelInclude, orderBy: { createdAt: "asc" } });
  const tallies = await reviewTallies("ROOM", rows.flatMap((h) => h.rooms.map((r) => r.id)));
  return rows.map((r) => mapHotel(r, tallies));
});

export const getHotel = cache(async (slug: string) => {
  if ((await getPublications()).STAY === "HIDDEN") return null;
  const row = await db.hotel.findFirst({ where: { ...liveHotel, slug }, include: hotelInclude });
  if (!row) return null;
  return mapHotel(row, await reviewTallies("ROOM", row.rooms.map((r) => r.id)));
});

/* --------------------------------------------------------------- vehicles */

const vehicleInclude = { provider: { select: { businessName: true } } } as const;

type VehicleRow = Awaited<ReturnType<typeof db.vehicle.findMany<{ include: typeof vehicleInclude }>>>[number];

function mapVehicle(v: VehicleRow, tallies: Map<string, Tally>): CatalogueVehicle {
  return {
    id: v.id,
    slug: v.slug,
    make: v.make,
    model: v.model,
    year: v.year,
    category: v.category,
    seats: v.seats,
    transmission: v.transmission,
    fuel: v.fuelType,
    pricePerDay: v.pricePerDayMinor,
    driverPerDay: v.driverPerDayMinor,
    insuranceCharge: v.insuranceChargeMinor,
    features: v.features,
    provider: v.provider.businessName,
    ...toRating(tallies.get(v.id)),
    ...photos("vehicle", v.slug, v.images),
  };
}

export const listVehicles = shared("vehicles", async (): Promise<CatalogueVehicle[]> => {
  if ((await getPublications()).TRANSPORT === "HIDDEN") return [];
  const rows = await db.vehicle.findMany({
    where: { isPublished: true, provider: LIVE_PROVIDER },
    include: vehicleInclude,
    // Vehicles carry no createdAt; premium first reads better than an arbitrary id order.
    orderBy: [{ pricePerDayMinor: "desc" }, { slug: "asc" }],
  });
  const tallies = await reviewTallies("VEHICLE", rows.map((r) => r.id));
  return rows.map((r) => mapVehicle(r, tallies));
});

export const getVehicle = cache(async (slug: string) => {
  if ((await getPublications()).TRANSPORT === "HIDDEN") return null;
  const row = await db.vehicle.findFirst({
    where: { slug, isPublished: true, provider: LIVE_PROVIDER },
    include: vehicleInclude,
  });
  if (!row) return null;
  return mapVehicle(row, await reviewTallies("VEHICLE", [row.id]));
});

/* ----------------------------------------------------------- destinations */

/** The editorial destination list, with live tour and stay counts. */
export async function destinationsWithCounts(): Promise<Destination[]> {
  const [tours, hotels] = await Promise.all([listTours(), listHotels()]);
  const has = (text: string, name: string) => text.toLowerCase().includes(name.toLowerCase());
  return destinations.map((d) => ({
    ...d,
    tours: tours.filter((t) => has(t.destination, d.name)).length,
    stays: hotels.filter((h) => has(h.location, d.name)).length,
  }));
}

/* ------------------------------------------------------------- freshness */

// Called after anything that changes what the public sees, so edits show at once instead of at the next revalidate.
export function refreshPublicCatalogue() {
  revalidateTag(TAG, { expire: 0 });
  revalidatePath("/", "layout");
}
