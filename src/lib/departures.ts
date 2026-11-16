import { db } from "@/lib/db";
import {
  addDays,
  isoDay,
  runDays,
  runRange,
  seatsLeft,
  type DayInventory,
} from "@/lib/departure-rules";
import { getPublications } from "@/lib/publication";
import { imageFor } from "@/lib/images";
import { lowestRate } from "@/lib/residency";

/**
 * Dated departures: reading them for the public pages and the booking panel.
 *
 * A departure is a date on a fixed-departure tour. Its seats are the tour's
 * capacity, held day by day in `availability` by the booking engine, so the
 * number shown here is always the number the engine will actually sell.
 * Nothing in this file is cached: seats change with every booking.
 */

export type Departure = {
  id: string;
  /** First day, YYYY-MM-DD. */
  startsOn: string;
  /** Last day of the run. */
  lastDay: string;
  /** Exclusive end, as a booking stores it. */
  end: string;
  note: string | null;
  seatsTotal: number;
  seatsLeft: number;
};

const today = () => new Date(`${isoDay(new Date())}T00:00:00Z`);

/** Upcoming departures for one tour, earliest first, with live seat counts. */
export async function upcomingDepartures(tour: {
  id: string;
  durationDays: number;
  maxParticipants: number;
}): Promise<Departure[]> {
  const rows = await db.tourDeparture.findMany({
    where: { tourId: tour.id, startsOn: { gte: today() } },
    orderBy: { startsOn: "asc" },
    select: { id: true, startsOn: true, note: true },
  });
  if (rows.length === 0) return [];

  const inventory = await inventoryFor([tour.id], rows[0]!.startsOn, addDays(rows.at(-1)!.startsOn, tour.durationDays));
  return rows.map((row) => toDeparture(row, tour, inventory.get(tour.id)));
}

async function inventoryFor(tourIds: string[], from: Date, to: Date) {
  const days = await db.availability.findMany({
    where: { serviceType: "TOUR", resourceId: { in: tourIds }, day: { gte: from, lt: to } },
    select: { resourceId: true, day: true, unitsTotal: true, unitsBooked: true, isBlocked: true },
  });
  const byTour = new Map<string, Map<string, DayInventory>>();
  for (const day of days) {
    if (!byTour.has(day.resourceId)) byTour.set(day.resourceId, new Map());
    byTour.get(day.resourceId)!.set(isoDay(day.day), day);
  }
  return byTour;
}

function toDeparture(
  row: { id: string; startsOn: Date; note: string | null },
  tour: { durationDays: number; maxParticipants: number },
  inventory: Map<string, DayInventory> | undefined,
): Departure {
  const range = runRange(row.startsOn, tour.durationDays);
  return {
    id: row.id,
    startsOn: range.start,
    lastDay: range.lastDay,
    end: range.end,
    note: row.note,
    seatsTotal: tour.maxParticipants,
    seatsLeft: seatsLeft(runDays(row.startsOn, tour.durationDays), inventory ?? new Map()),
  };
}

/* ---------------------------------------------------------------- editions */

/** One bookable date of a Tembera u Rwanda tour, ready for a card. */
export type Edition = {
  departure: Departure;
  tour: {
    slug: string;
    name: string;
    destination: string;
    durationDays: number;
    summary: string;
    image?: string;
    priceMinor: number;
    priceResidentMinor: number | null;
    priceNonResidentMinor: number | null;
    priceFrom: number;
    inclusions: string[];
    /** True when this edition is sold by written quote rather than booked. */
    enquiryOnly: boolean;
  };
};

/**
 * Every upcoming edition, soonest first: approved, published tours filed
 * under the Tembera collection that run on fixed departures. Empty while
 * trips are hidden or no edition has been scheduled.
 */
export async function listEditions(limit = 12): Promise<Edition[]> {
  if ((await getPublications()).TRIP === "HIDDEN") return [];
  const tours = await db.tour.findMany({
    where: {
      collection: "TEMBERA",
      fixedDepartures: true,
      isPublished: true,
      offerApproval: { not: null },
      provider: { status: "VERIFIED" },
      departures: { some: { startsOn: { gte: today() } } },
    },
    include: {
      departures: {
        where: { startsOn: { gte: today() } },
        orderBy: { startsOn: "asc" },
        select: { id: true, startsOn: true, note: true },
      },
    },
  });
  if (tours.length === 0) return [];

  const starts = tours.flatMap((t) => t.departures.map((d) => d.startsOn.getTime()));
  const longest = Math.max(...tours.map((t) => t.durationDays));
  const inventory = await inventoryFor(
    tours.map((t) => t.id),
    new Date(Math.min(...starts)),
    addDays(new Date(Math.max(...starts)), longest),
  );

  return tours
    .flatMap((tour) =>
      tour.departures.map((row) => ({
        departure: toDeparture(row, tour, inventory.get(tour.id)),
        tour: {
          slug: tour.slug,
          name: tour.name,
          destination: tour.destination,
          durationDays: tour.durationDays,
          summary: tour.description ?? "",
          image: tour.images[0] ?? imageFor("tour", tour.slug),
          priceMinor: tour.priceMinor,
          priceResidentMinor: tour.priceResidentMinor,
          priceNonResidentMinor: tour.priceNonResidentMinor,
          priceFrom: lowestRate(tour),
          inclusions: tour.inclusions,
          enquiryOnly: tour.enquiryOnly,
        },
      })),
    )
    .sort((a, b) => a.departure.startsOn.localeCompare(b.departure.startsOn))
    .slice(0, limit);
}
