import { db } from "@/lib/db";
import type { ServiceType } from "@/generated/prisma/enums";

/**
 * Resolves polymorphic booking rows to human-readable subjects.
 *
 * This is the cost of one booking table instead of four: `resourceId` has no
 * foreign key, so display needs a lookup. Batched by service type — three
 * queries for a whole page of bookings, not one per row.
 */

type Row = { serviceType: ServiceType; resourceId: string };

export type BookingSubject = {
  title: string;
  href: string | null;
  kind: string;
};

export async function resolveBookingSubjectDetails(
  rows: Row[],
): Promise<Map<string, BookingSubject>> {
  const byType = {
    TOUR: [] as string[],
    ROOM: [] as string[],
    VEHICLE: [] as string[],
    TRANSFER: [] as string[],
  };
  for (const r of rows) byType[r.serviceType].push(r.resourceId);

  const out = new Map<string, BookingSubject>();

  const [tours, rooms, vehicles] = await Promise.all([
    byType.TOUR.length
      ? db.tour.findMany({
          where: { id: { in: byType.TOUR } },
          select: { id: true, name: true, slug: true, destination: true },
        })
      : [],
    byType.ROOM.length
      ? db.room.findMany({
          where: { id: { in: byType.ROOM } },
          select: {
            id: true,
            name: true,
            hotel: { select: { name: true, slug: true } },
          },
        })
      : [],
    byType.VEHICLE.length
      ? db.vehicle.findMany({
          where: { id: { in: byType.VEHICLE } },
          select: { id: true, make: true, model: true, year: true, slug: true },
        })
      : [],
  ]);

  for (const t of tours) {
    out.set(t.id, {
      title: t.name,
      href: `/tours/${t.slug}`,
      kind: `Safari · ${t.destination}`,
    });
  }
  for (const r of rooms) {
    out.set(r.id, {
      title: `${r.hotel.name} — ${r.name}`,
      href: `/hotels/${r.hotel.slug}`,
      kind: "Hotel stay",
    });
  }
  for (const v of vehicles) {
    out.set(v.id, {
      title: `${v.make} ${v.model} (${v.year})`,
      href: `/cars/${v.slug}`,
      kind: "Car hire",
    });
  }

  // A transfer has no listing behind it; its route is in the booking's details.
  for (const r of rows) {
    if (r.serviceType === "TRANSFER") {
      out.set(r.resourceId, { title: "Airport transfer", href: "/transfers", kind: "Transfer" });
    }
  }

  // A deleted listing must not break a customer's booking history.
  for (const r of rows) {
    if (!out.has(r.resourceId)) {
      out.set(r.resourceId, {
        title: "Listing no longer available",
        href: null,
        kind: r.serviceType,
      });
    }
  }

  return out;
}

/** Convenience wrapper when only the title is needed. */
export async function resolveBookingSubjects(rows: Row[]) {
  const details = await resolveBookingSubjectDetails(rows);
  return new Map(
    Array.from(details.entries()).map(([id, d]) => [id, d.title]),
  );
}

/**
 * Listing ids whose name matches a search term.
 *
 * Bookings store a bare `resourceId`, so a search for "mara" would otherwise
 * miss the booking whose first column reads "Mountain Gorilla Trekking".
 * Three small queries, then the caller filters on the ids.
 */
export async function resourceIdsMatching(term: string): Promise<string[]> {
  const like = { contains: term, mode: "insensitive" as const };

  const [tours, rooms, vehicles] = await Promise.all([
    db.tour.findMany({ where: { name: like }, select: { id: true }, take: 200 }),
    db.room.findMany({
      where: { OR: [{ name: like }, { hotel: { name: like } }] },
      select: { id: true },
      take: 200,
    }),
    db.vehicle.findMany({
      where: { OR: [{ make: like }, { model: like }] },
      select: { id: true },
      take: 200,
    }),
  ]);

  return [...tours, ...rooms, ...vehicles].map((r) => r.id);
}
