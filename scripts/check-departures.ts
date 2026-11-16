/** Local-only integration check. Run: npx tsx scripts/check-departures.ts */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { BookingError, assertScheduledRun } from "../src/lib/booking";
import { addDays, isoDay, runDays } from "../src/lib/departure-rules";
import { listEditions, upcomingDepartures } from "../src/lib/departures";

/**
 * Dated departures against a real database: a fixed-departure tour can be
 * booked only on its scheduled dates and for its full length, the seats left
 * follow the calendar the booking engine holds, and only approved offers are
 * listed as editions.
 *
 * It calls the engine's own rule (`assertScheduledRun`) rather than
 * `createBooking`, which reads cached site settings and so needs the web
 * server. Builds its own provider and tour, and removes them afterwards.
 */
async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "54329" ||
    url.pathname !== "/thrill_rwanda" ||
    process.env.NODE_ENV === "production"
  ) {
    throw new Error(
      "This check only runs against the project-local development database.",
    );
  }

  const tag = randomUUID().slice(0, 8);
  const today = new Date(`${isoDay(new Date())}T00:00:00Z`);
  const startsOn = addDays(today, 40);
  const SEATS = 5;
  const DAYS = 2;

  try {
    await run();
    console.log("Departure checks passed.");
  } finally {
    // By tag, so a failure part-way through the fixtures still leaves nothing behind.
    const tours = await db.tour.findMany({ where: { slug: `departure-check-${tag}` }, select: { id: true } });
    const ids = tours.map((t) => t.id);
    await db.booking.deleteMany({ where: { resourceId: { in: ids } } });
    await db.availability.deleteMany({ where: { serviceType: "TOUR", resourceId: { in: ids } } });
    await db.tour.deleteMany({ where: { id: { in: ids } } });
    await db.provider.deleteMany({ where: { slug: `departure-check-${tag}` } });
    await db.user.deleteMany({ where: { email: { endsWith: `-${tag}@example.invalid` } } });
  }

  async function run() {
    const owner = await db.user.create({
      data: { email: `departure-owner-${tag}@example.invalid`, fullName: "Departure check owner", role: "PROVIDER", emailVerified: true },
    });
    const provider = await db.provider.create({
      data: { userId: owner.id, businessName: `Departure check ${tag}`, slug: `departure-check-${tag}`, status: "VERIFIED", kind: "TOUR" },
    });
    const tour = await db.tour.create({
      data: {
        providerId: provider.id,
        slug: `departure-check-${tag}`,
        name: `Departure check ${tag}`,
        destination: "Kigali",
        description: "Integration fixture, removed after the check.",
        durationDays: DAYS,
        maxParticipants: SEATS,
        priceMinor: 10000,
        collection: "TEMBERA",
        fixedDepartures: true,
        isPublished: true,
        offerApproval: "integration check",
        images: ["/media/hero/kivu.webp"],
      },
    });

    /** Asks the booking engine's own rule whether this start and length may be booked. */
    const allowed = (start: Date, days: number) =>
      db.$transaction((tx) => assertScheduledRun(tx, tour.id, start, days));
    const refused = async (work: Promise<unknown>, why: string) => {
      await assert.rejects(work, (err) => err instanceof BookingError, why);
    };
    /** Holds seats on every day of the run, as a booking does. */
    const hold = (seats: number) =>
      db.availability.updateMany({
        where: { serviceType: "TOUR", resourceId: tour.id, day: { in: runDays(startsOn, DAYS).map((d) => addDays(d, 0)) } },
        data: { unitsBooked: { increment: seats } },
      });

    // A calendar open on every day, so only the departure rule can refuse a date.
    await db.availability.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        serviceType: "TOUR" as const,
        resourceId: tour.id,
        day: addDays(today, i),
        unitsTotal: SEATS,
      })),
    });

    // With no departure scheduled, nothing can be booked and nothing is listed.
    await refused(allowed(startsOn, DAYS), "a dated tour with no dates must not be bookable");
    assert.equal((await upcomingDepartures(tour)).length, 0);

    await db.tourDeparture.create({ data: { tourId: tour.id, startsOn, note: "Check run" } });

    // Only the scheduled first day, and only for the whole run.
    await allowed(startsOn, DAYS);
    await refused(allowed(addDays(startsOn, 1), DAYS), "the day after a departure is not a departure");
    await refused(allowed(addDays(startsOn, -1), DAYS), "the day before a departure is not a departure");
    await refused(allowed(startsOn, DAYS - 1), "a run cannot be booked for part of its length");
    await refused(allowed(startsOn, DAYS + 1), "a run cannot be stretched past its length");

    // A tour without fixed departures is not held to any schedule.
    await db.tour.update({ where: { id: tour.id }, data: { fixedDepartures: false } });
    await allowed(addDays(startsOn, 5), 7);
    await db.tour.update({ where: { id: tour.id }, data: { fixedDepartures: true } });

    const [open] = await upcomingDepartures(tour);
    assert.ok(open, "the departure is listed");
    assert.equal(open.seatsLeft, SEATS);
    assert.equal(open.startsOn, isoDay(startsOn));
    assert.equal(open.end, isoDay(addDays(startsOn, DAYS)));

    // Seats held on the run come off what is left to sell.
    await hold(3);
    assert.equal((await upcomingDepartures(tour))[0]!.seatsLeft, SEATS - 3);

    // The database itself will not let a run be oversold.
    await assert.rejects(hold(3), "a run cannot hold more seats than it has");
    assert.equal((await upcomingDepartures(tour))[0]!.seatsLeft, SEATS - 3);

    // The last seats can still go, and then the run is full.
    await hold(2);
    assert.equal((await upcomingDepartures(tour))[0]!.seatsLeft, 0);

    // A closed day anywhere in the run leaves nothing to sell.
    await db.availability.updateMany({
      where: { serviceType: "TOUR", resourceId: tour.id, day: addDays(startsOn, 1) },
      data: { unitsBooked: 0, isBlocked: true },
    });
    assert.equal((await upcomingDepartures(tour))[0]!.seatsLeft, 0);

    // The edition reaches the public list with the same seat count.
    const edition = (await listEditions(200)).find((e) => e.tour.slug === tour.slug);
    assert.ok(edition, "an approved, published Tembera tour with a date is listed as an edition");
    assert.equal(edition.departure.seatsLeft, 0);
    assert.equal(edition.departure.note, "Check run");

    // An unapproved offer is never listed, whatever its dates.
    await db.tour.update({ where: { id: tour.id }, data: { offerApproval: null } });
    assert.equal((await listEditions(200)).some((e) => e.tour.slug === tour.slug), false);

  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
