"use server";

import { revalidatePath } from "next/cache";
import { refreshPublicCatalogue } from "@/lib/catalogue";
import { db } from "@/lib/db";
import {
  addDays,
  clashingRun,
  departureSchema,
  formatRun,
  isoDay,
  runDays,
  runRange,
} from "@/lib/departure-rules";
import { todayInRwanda } from "@/lib/flight-enquiry-schema";
import { resolveListingScope, scopeFilter } from "@/lib/session";

/**
 * Scheduling the dates a fixed-departure tour runs on.
 *
 * Kept apart from editing the offer: changing the offer's content removes
 * its approval, and adding next month's date should not. Scope comes from
 * the session, as in listings-edit.ts: a provider reaches only their own
 * tours, an admin any tour.
 */

export type DepartureState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ok"; message: string };

const fail = (message: string): DepartureState => ({ status: "error", message });

function refresh(tourId: string) {
  revalidatePath(`/admin/listings/tours/${tourId}/edit`);
  revalidatePath(`/provider/listings/tours/${tourId}/edit`);
  refreshPublicCatalogue();
}

export async function addDeparture(
  _prev: DepartureState,
  formData: FormData,
): Promise<DepartureState> {
  const scope = await resolveListingScope();
  const parsed = departureSchema.safeParse({
    tourId: formData.get("tourId"),
    startsOn: formData.get("startsOn"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the date.");
  const { tourId, startsOn, note } = parsed.data;

  if (startsOn < todayInRwanda()) return fail("Choose today or a later date.");
  // Guards against 2027-02-31 and the like, which the pattern alone lets through.
  if (isoDay(addDays(startsOn, 0)) !== startsOn) return fail("That is not a real date.");

  const tour = await db.tour.findFirst({
    where: { id: tourId, ...scopeFilter(scope) },
    select: {
      id: true,
      durationDays: true,
      maxParticipants: true,
      fixedDepartures: true,
      departures: { select: { startsOn: true } },
    },
  });
  if (!tour) return fail("That tour no longer exists, or is not yours to schedule.");
  if (!tour.fixedDepartures)
    return fail("Turn on “Runs on set dates only” for this tour, save it, then add dates.");

  const clash = clashingRun(
    startsOn,
    tour.durationDays,
    tour.departures.map((d) => d.startsOn),
  );
  if (clash) {
    const other = runRange(clash, tour.durationDays);
    return fail(
      `That overlaps the run of ${formatRun(other.start, other.lastDay)}. Two runs of one tour cannot share a day.`,
    );
  }

  const start = addDays(startsOn, 0);
  await db.$transaction(async (tx) => {
    await tx.tourDeparture.create({
      data: { tourId: tour.id, startsOn: start, note: note || null },
    });
    // The calendar is opened a year ahead when a tour is created. A date
    // beyond that needs its days added, or the booking engine has nothing to hold.
    await tx.availability.createMany({
      data: runDays(start, tour.durationDays).map((day) => ({
        serviceType: "TOUR" as const,
        resourceId: tour.id,
        day: addDays(day, 0),
        unitsTotal: tour.maxParticipants,
      })),
      skipDuplicates: true,
    });
  });

  refresh(tour.id);
  const range = runRange(start, tour.durationDays);
  return { status: "ok", message: `Added ${formatRun(range.start, range.lastDay)}.` };
}

export async function removeDeparture(
  _prev: DepartureState,
  formData: FormData,
): Promise<DepartureState> {
  const scope = await resolveListingScope();
  const id = String(formData.get("id") ?? "");

  const departure = await db.tourDeparture.findFirst({
    where: { id, tour: scopeFilter(scope) },
    select: { id: true, startsOn: true, tourId: true, tour: { select: { durationDays: true } } },
  });
  if (!departure) return fail("That date no longer exists.");

  // People who have a place on this run keep it: the date cannot be withdrawn from under them.
  const held = await db.booking.count({
    where: {
      serviceType: "TOUR",
      resourceId: departure.tourId,
      startDate: departure.startsOn,
      status: { in: ["PENDING", "AWAITING_PAYMENT", "PAID", "CONFIRMED"] },
    },
  });
  if (held > 0)
    return fail(
      `${held} ${held === 1 ? "booking is" : "bookings are"} held on this date. Cancel or move ${held === 1 ? "it" : "them"} first.`,
    );

  await db.tourDeparture.delete({ where: { id: departure.id } });
  refresh(departure.tourId);
  const range = runRange(departure.startsOn, departure.tour.durationDays);
  return { status: "ok", message: `Removed ${formatRun(range.start, range.lastDay)}.` };
}
