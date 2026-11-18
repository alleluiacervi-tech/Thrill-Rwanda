import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { adapterFor } from "../src/lib/db-adapter";
import { tourExcludes, tourIncludes, tourItineraries } from "../src/lib/content";
import { photo } from "../src/lib/images";
import { randomUUID } from "node:crypto";

/**
 * LOCAL DEMO DATA ONLY.
 *
 * Files the sample tours under collections and marks them approved, so the
 * product pages (Tours & Experiences, the collection pages, the tours filter)
 * have something to show on a developer's machine. Also creates two sample
 * Tembera u Rwanda editions with dates, and three sample wedding venues.
 *
 *   npm run db:seed:products               editions shown, sold by request
 *   npm run db:seed:products -- --direct   also switches trips to direct booking
 *   npm run db:seed:products -- --activity adds 90 days of sample requests for the dashboard
 *
 * This bypasses the real approval in Admin → Launch, which checks each
 * offer's content and records who approved it. It therefore refuses to run
 * against anything but a local database, and it stamps every row it touches
 * so the approval can never be mistaken for a real one.
 */

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL / DATABASE_URL not set");

const host = new URL(connectionString).hostname;
// A hosted test database can opt in by naming its exact host, so a stray
// production URL is still refused: DEMO_DATABASE_HOST=ep-....neon.tech
const optedIn = !!process.env.DEMO_DATABASE_HOST && process.env.DEMO_DATABASE_HOST === host;
if (!["localhost", "127.0.0.1", "::1"].includes(host) && !optedIn) {
  console.error(
    `Refusing to run: ${host} is not a local database. This script writes demo approvals and must never touch a production database. For a test-only database, set DEMO_DATABASE_HOST=${host}.`,
  );
  process.exit(1);
}

const db = new PrismaClient({ adapter: adapterFor(connectionString) });

export const DEMO_STAMP = "LOCAL DEMO DATA: not a real approval (scripts/seed-product-demo.ts)";

/** Which collection each sample tour is filed under. */
const filing: Record<string, string> = {
  "gorilla-trekking-volcanoes-2-day": "SAFARI",
  "akagera-big-five-3-day": "SAFARI",
  "nyungwe-canopy-chimps-3-day": "SAFARI",
  "kigali-city-memorial-day": "CITY_TOUR",
  "lake-kivu-congo-nile-3-day": "HONEYMOON",
  "grand-rwanda-7-day": "PRIVATE_LUXURY",
};

/** Sample Tembera u Rwanda editions. Names, routes and prices are invented for local testing. */
const editions = [
  {
    slug: "tembera-nyungwe-kivu-weekend",
    name: "Nyungwe & Lake Kivu Weekend",
    destination: "Nyungwe National Park",
    durationDays: 2,
    maxParticipants: 24,
    // USD cents: citizen, resident, visitor.
    prices: [12000, 16000, 28000],
    description:
      "Sample edition. Two days out of Kigali: the canopy walkway above Nyungwe's rainforest, then an evening on the shore of Lake Kivu.",
    images: ["/media/photos/nyungwe-canopy-walk-2.jpeg", "/media/hero/kivu.webp"],
    // One day per line, as the tour form stores it.
    itinerary: [
      "Kigali to Nyungwe. Leave together in the morning, walk the canopy bridge after lunch, and reach the lake for dinner.",
      "Lake Kivu to Kigali. A slow morning on the water, lunch on the shore, and the road home.",
    ].join("\n"),
    activities: ["Canopy walk", "Lake Kivu", "Shared meals"],
    // First days, counted in weeks from the coming Saturday.
    weeksOut: [3, 7, 11],
    notes: ["", "School holiday edition", ""],
  },
  {
    slug: "tembera-akagera-day",
    name: "Akagera in a Day",
    destination: "Akagera National Park",
    durationDays: 1,
    maxParticipants: 30,
    prices: [6500, 9000, 15000],
    description:
      "Sample edition. An early start from Kigali for a full day's game drive across Akagera's savannah and lakes, back in the city by evening.",
    images: ["/media/photos/akagera-lioness.jpg"],
    itinerary:
      "Kigali to Akagera and back. A dawn departure, a game drive with a park guide, a packed lunch by the lake and the return to Kigali.",
    activities: ["Game drive", "Packed lunch", "Park guide"],
    weeksOut: [2, 5],
    notes: ["", ""],
  },
];

const DAY_MS = 86_400_000;
const today = () => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");

/** The Saturday `weeks` weeks after the coming one. */
function saturday(weeks: number) {
  const base = today();
  const untilSaturday = (6 - base.getUTCDay() + 7) % 7 || 7;
  return new Date(base.getTime() + (untilSaturday + weeks * 7) * DAY_MS);
}

async function seedEditions() {
  const provider = await db.provider.findFirst({
    where: { businessName: "Thrill Rwanda In-House" },
    select: { id: true },
  });
  if (!provider) {
    console.warn("  skipped editions: provider “Thrill Rwanda In-House” not found (run npm run db:seed first)");
    return;
  }

  let dates = 0;
  for (const e of editions) {
    const [priceMinor, priceResidentMinor, priceNonResidentMinor] = e.prices;
    const content = {
      name: e.name,
      destination: e.destination,
      description: e.description,
      durationDays: e.durationDays,
      maxParticipants: e.maxParticipants,
      priceMinor: priceMinor!,
      priceResidentMinor: priceResidentMinor!,
      priceNonResidentMinor: priceNonResidentMinor!,
      activities: e.activities,
      images: e.images,
      itinerary: e.itinerary,
      suitability:
        "Sample text. Open to all ages; children travel with an adult. Expect some walking on uneven ground.",
      inclusions: [
        "Return transport from Kigali",
        "All meals on the journey",
        ...(e.durationDays > 1 ? ["Accommodation"] : []),
        "A guide throughout",
        "Park and activity entries on the plan",
      ],
      exclusions: ["Drinks beyond those served with meals", "Tips and personal spending", "Travel insurance"],
      collection: "TEMBERA",
      fixedDepartures: true,
      enquiryOnly: false,
      offerApproval: DEMO_STAMP,
      isPublished: true,
      providerId: provider.id,
    };
    const tour = await db.tour.upsert({
      where: { slug: e.slug },
      update: content,
      create: { slug: e.slug, ...content },
    });

    // A year of calendar, one seat per traveller, as the tour form opens it.
    await db.availability.createMany({
      data: Array.from({ length: 365 }, (_, i) => ({
        serviceType: "TOUR" as const,
        resourceId: tour.id,
        day: new Date(today().getTime() + i * DAY_MS),
        unitsTotal: e.maxParticipants,
      })),
      skipDuplicates: true,
    });

    for (const [i, weeks] of e.weeksOut.entries()) {
      const startsOn = saturday(weeks);
      await db.tourDeparture.upsert({
        where: { tourId_startsOn: { tourId: tour.id, startsOn } },
        update: { note: e.notes[i] || null },
        create: { tourId: tour.id, startsOn, note: e.notes[i] || null },
      });
      dates += 1;
    }
  }
  console.log(`  Tembera sample editions: ${editions.length} tours, ${dates} dates`);

  // Private and honeymoon samples are sold by quote even once trips can be booked.
  const quoteOnly = await db.tour.updateMany({
    where: { collection: { in: ["PRIVATE_LUXURY", "HONEYMOON"] } },
    data: { enquiryOnly: true },
  });
  console.log(`  quote-only sample tours: ${quoteOnly.count}`);
}

/**
 * Switches trips to direct booking, so an edition can be booked and paid for
 * locally. The real switch is Admin → Launch, with approval evidence.
 */
async function openTripBooking() {
  const admin = await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) {
    console.warn("  trips left request-only: no admin user to record the switch against");
    return;
  }
  await db.servicePublication.upsert({
    where: { service: "TRIP" },
    update: { mode: "DIRECT", evidence: DEMO_STAMP, approvedById: admin.id, version: { increment: 1 } },
    create: { service: "TRIP", mode: "DIRECT", evidence: DEMO_STAMP, approvedById: admin.id },
  });
  console.log("  trips switched to direct booking (demo)");
}

/** Sample venues. Invented for local testing: they are not real places Thrill Rwanda reserves. */
const venues = [
  {
    slug: "sample-lakeshore-garden",
    name: "Sample: Lakeshore Garden",
    kind: "Garden or lakeshore",
    location: "Rubavu, Lake Kivu",
    capacity: 220,
    description:
      "Sample venue. A lawn that runs down to the water, with a covered terrace behind it for the evening.",
    features: ["On-site catering", "Parking", "Rooms on site"],
    images: [photo("photo-1514548383638-cef9251a73ec")],
  },
  {
    slug: "sample-hilltop-lodge",
    name: "Sample: Hilltop Lodge",
    kind: "Lodge or hilltop",
    location: "Musanze",
    capacity: 80,
    description:
      "Sample venue. A whole lodge to yourselves in the Virunga foothills, with rooms for the people closest to you.",
    features: ["Exclusive use", "Rooms for 30 guests", "Fire-lit terrace"],
    images: [photo("photo-1781039869379-5561fe260d26")],
  },
  {
    slug: "sample-garden-pavilion",
    name: "Sample: Garden Pavilion",
    kind: "Hall or ballroom",
    location: "Kigali",
    capacity: 600,
    description:
      "Sample venue. A covered pavilion with open sides and a full kitchen, close to the airport for guests flying in.",
    features: ["Covered", "Full kitchen", "Parking for 150 cars", "Sound and lighting"],
    images: [photo("photo-1779216175784-a67b6da108bb")],
  },
];

async function seedVenues() {
  for (const venue of venues) {
    await db.venue.upsert({
      where: { slug: venue.slug },
      update: { ...venue, isPublished: true },
      create: { ...venue, isPublished: true },
    });
  }
  console.log(`  sample wedding venues: ${venues.length}`);
}

/**
 * Ninety days of sample requests and button presses, so the dashboard has a
 * history to show. Every request is named "Sample …" and carries
 * details.demo = true; re-running replaces them rather than adding more.
 */
async function seedDemoActivity() {
  const old = await db.enquiry.findMany({ where: { details: { path: ["demo"], equals: true } }, select: { id: true } });
  if (old.length) {
    const { removeEnquiryFixtures } = await import("./enquiry-test-cleanup");
    await removeEnquiryFixtures(old.map((e) => e.id));
  }
  const staff = await db.user.findMany({ where: { staffRole: { in: ["SALES", "OPERATIONS"] } }, select: { id: true } });

  // A fixed sequence, so every run draws the same picture.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const pick = <T,>(items: [T, number][]) => {
    let r = rand() * items.reduce((n, [, w]) => n + w, 0);
    for (const [v, w] of items) if ((r -= w) <= 0) return v;
    return items[0]![0];
  };

  const doors: [{ service: string; journey?: string }, number][] = [
    [{ service: "FLIGHT" }, 34],
    [{ service: "TRIP", journey: "SAFARI" }, 14],
    [{ service: "TRIP", journey: "PRIVATE_LUXURY" }, 7],
    [{ service: "TRIP", journey: "HONEYMOON" }, 6],
    [{ service: "TRIP", journey: "CITY_TOUR" }, 6],
    [{ service: "TRIP", journey: "TEMBERA" }, 9],
    [{ service: "EVENT", journey: "WEDDING" }, 7],
    [{ service: "GROUP", journey: "SCHOOL" }, 5],
    [{ service: "GROUP", journey: "GROUP" }, 4],
    [{ service: "STAY" }, 4],
    [{ service: "TRANSPORT" }, 4],
  ];
  const sources: [string, number][] = [["WEBSITE", 58], ["WHATSAPP", 22], ["PHONE", 8], ["REFERRAL", 6], ["SOCIAL", 4], ["CAMPAIGN", 2]];
  const statuses: [string, number][] = [
    ["NEW", 10], ["CONTACTED", 14], ["NEEDS_INFORMATION", 6], ["QUOTE_SENT", 18], ["AWAITING_PAYMENT", 6],
    ["PARTNER_PROCESSING", 4], ["CONFIRMED", 10], ["COMPLETED", 14], ["LOST", 12], ["CANCELLED", 3],
  ];
  const names = ["Uwase", "Mugisha", "Ishimwe", "Habimana", "Nshuti", "Keza", "Ingabire", "Mutesi", "Okafor", "Schmidt", "Dubois", "Kamau"];

  const now = Date.now();
  let made = 0;
  for (let day = 89; day >= 0; day--) {
    // Demand rises over the period, with quieter weekends.
    const date = new Date(now - day * DAY_MS);
    const weekend = [0, 6].includes(date.getUTCDay());
    const count = Math.round((1.5 + (89 - day) / 30 + rand() * 2.5) * (weekend ? 0.6 : 1));
    for (let k = 0; k < count; k++) {
      const door = pick(doors);
      const createdAt = new Date(date.getTime() - Math.floor(rand() * 10 * 3600_000));
      let status = day < 2 ? "NEW" : pick(statuses);
      if (day < 6 && ["COMPLETED", "CONFIRMED"].includes(status)) status = "QUOTE_SENT";
      const answered = status !== "NEW";
      const replyHours = 0.3 + rand() * rand() * 30;
      const open = !["COMPLETED", "LOST", "CANCELLED", "REFUNDED"].includes(status);
      const key = randomUUID();
      await db.enquiry.create({
        data: {
          reference: `TRQ-SAMPLE-${key.slice(0, 8)}`,
          submissionKey: key,
          fingerprint: `demo-${key}`,
          contactKey: `demo-${key}`,
          service: door.service,
          source: pick(sources),
          status: status as never,
          name: `Sample ${names[Math.floor(rand() * names.length)]}`,
          phone: "+250700000000",
          email: null,
          replyChannel: "WHATSAPP",
          consentVersion: "demo",
          consentText: "Sample data for the local dashboard; not a real person.",
          privacyVersion: 0,
          ownerId: answered && staff.length ? staff[Math.floor(rand() * staff.length)]!.id : null,
          firstResponseAt: answered ? new Date(createdAt.getTime() + replyHours * 3600_000) : null,
          nextFollowUp: open && answered ? new Date(now + (rand() * 10 - 3) * DAY_MS) : null,
          createdAt,
          details: { demo: true, service: door.service, ...(door.journey ? { journey: door.journey } : {}), message: "Sample request." },
        },
      });
      made += 1;
    }
  }

  // Anonymous button presses, by day, service and place.
  const services = ["FLIGHT", "TRIP", "EVENT", "GROUP", "STAY", "TRANSPORT"];
  const placements = ["HOME_HERO", "HOME_SERVICES", "SERVICE_REQUEST"];
  for (let day = 89; day >= 0; day--) {
    const d = new Date(new Date(now - day * DAY_MS).toISOString().slice(0, 10) + "T00:00:00Z");
    for (const service of services)
      for (const placement of placements) {
        if (placement === "HOME_HERO" && service !== "FLIGHT") continue;
        const clicks = Math.round(rand() * (service === "FLIGHT" ? 14 : 6) * (1 + (89 - day) / 90));
        if (!clicks) continue;
        await db.interactionDaily.upsert({
          where: { day_service_placement: { day: d, service, placement } },
          update: { clicks },
          create: { day: d, service, placement, clicks },
        });
      }
  }
  console.log(`  sample requests for the dashboard: ${made} over 90 days, with button presses`);
}

async function main() {
  let filed = 0;
  for (const [slug, collection] of Object.entries(filing)) {
    const tour = await db.tour.findUnique({ where: { slug } });
    if (!tour) {
      console.warn(`  skipped ${slug}: not in this database (run npm run db:seed first)`);
      continue;
    }
    const days = tourItineraries[slug];
    await db.tour.update({
      where: { slug },
      data: {
        collection,
        // Approval needs complete content; fill only what the sample is missing.
        itinerary:
          tour.itinerary ||
          (days?.map((d) => `${d.title}. ${d.body}`).join("\n") ??
            Array.from({ length: tour.durationDays }, (_, i) => `Day ${i + 1} of the sample itinerary.`).join("\n")),
        suitability:
          tour.suitability ||
          "Sample text. Suitable for most travellers in good general health; ask about age limits and fitness for trekking days.",
        inclusions: tour.inclusions.length ? tour.inclusions : [...tourIncludes],
        exclusions: tour.exclusions.length ? tour.exclusions : [...tourExcludes],
        offerApproval: DEMO_STAMP,
        isPublished: true,
      },
    });
    filed += 1;
  }
  console.log(`  tours filed and marked approved (demo): ${filed}`);

  await seedEditions();
  await seedVenues();
  if (process.argv.includes("--activity")) await seedDemoActivity();
  if (process.argv.includes("--direct")) await openTripBooking();
  else console.log("  trips stay request-only (pass --direct to switch on booking and payment locally)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
