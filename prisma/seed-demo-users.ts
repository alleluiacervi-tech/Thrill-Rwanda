import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { adapterFor } from "../src/lib/db-adapter";



const DEMO_PASSWORD = "thrill-demo-2026";

const DEMO = [
  { email: "customer@thrillrwanda.test", name: "Amina Uwimana", role: "CUSTOMER" as const, phone: "+250788000001" },
  { email: "provider@thrillrwanda.test", name: "Jean Claude Habimana", role: "PROVIDER" as const, phone: "+250788000002" },
  { email: "admin@thrillrwanda.test", name: "Thrill Rwanda Admin", role: "ADMIN" as const, phone: "+250788000003" },
];

/** The seeded provider the demo provider account will own. */
const PROVIDER_SLUG = "acacia-trails-kenya";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed demo accounts in production.");
  process.exit(1);
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL / DATABASE_URL not set");

const db = new PrismaClient({ adapter: adapterFor(connectionString) });

async function remove() {
  const emails = DEMO.map((d) => d.email);

  // Hand the provider record back to its placeholder owner so the catalogue
  // survives removing the demo login.
  const provider = await db.provider.findFirst({
    where: { slug: PROVIDER_SLUG },
    select: { id: true, businessName: true },
  });
  if (provider) {
    const fallback = await db.user.upsert({
      where: { email: `${PROVIDER_SLUG}@providers.thrillrwanda.test` },
      update: {},
      create: {
        email: `${PROVIDER_SLUG}@providers.thrillrwanda.test`,
        fullName: provider.businessName,
        role: "PROVIDER",
        emailVerified: true,
      },
    });
    await db.provider.update({
      where: { id: provider.id },
      data: { userId: fallback.id },
    });
  }

  await db.booking.deleteMany({ where: { customer: { email: { in: emails } } } });
  await db.availability.updateMany({
    where: { unitsBooked: { not: 0 } },
    data: { unitsBooked: 0 },
  });
  const gone = await db.user.deleteMany({ where: { email: { in: emails } } });
  console.log(`removed ${gone.count} demo account(s).`);
}

async function create() {
  // Imported lazily so `--remove` doesn't need the auth stack.
  const { auth } = await import("../src/lib/auth");

  for (const d of DEMO) {
    const existing = await db.user.findUnique({ where: { email: d.email } });

    if (!existing) {
      // Goes through Better Auth so the password is hashed its way.
      await auth.api.signUpEmail({
        body: {
          email: d.email,
          password: DEMO_PASSWORD,
          name: d.name,
        },
      });
    }

    // Roles can't be set at sign-up (`input: false`), so set them here —
    // the same path an admin promotion takes.
    await db.user.update({
      where: { email: d.email },
      data: { role: d.role, phone: d.phone, emailVerified: true, isActive: true },
    });

    console.log(`  ${d.email.padEnd(26)} ${d.role}`);
  }

  /* The provider account needs a Provider record to have a dashboard. Point
     the seeded Acacia Trails at it so there are real listings and bookings
     to work with, and clean up the placeholder owner it replaces. */
  const provider = await db.provider.findFirst({ where: { slug: PROVIDER_SLUG } });
  const providerUser = await db.user.findUniqueOrThrow({
    where: { email: "provider@thrillrwanda.test" },
  });

  if (provider && provider.userId !== providerUser.id) {
    const previousOwner = provider.userId;
    await db.provider.update({
      where: { id: provider.id },
      data: { userId: providerUser.id, status: "VERIFIED", verifiedAt: new Date() },
    });
    // deleteMany, not delete: the email filter is a guard, and `delete`
    // only accepts unique fields. This removes the placeholder owner and
    // nothing else — a real account with bookings is never matched.
    await db.user.deleteMany({
      where: {
        id: previousOwner,
        email: { endsWith: "@providers.thrillrwanda.test" },
      },
    });
    console.log(`  provider@thrillrwanda.test now owns ${provider.businessName}`);
  }

  /* One live booking so the provider and admin dashboards aren't empty. */
  const customer = await db.user.findUniqueOrThrow({
    where: { email: "customer@thrillrwanda.test" },
  });
  const existingBooking = await db.booking.findFirst({
    where: { customerId: customer.id },
  });

  if (!existingBooking && provider) {
    const tour = await db.tour.findFirst({ where: { providerId: provider.id } });
    if (tour) {
      const { createBooking } = await import("../src/lib/booking");
      const day = (n: number) => {
        const d = new Date();
        d.setUTCHours(0, 0, 0, 0);
        d.setUTCDate(d.getUTCDate() + n);
        return d;
      };
      const b = await createBooking({
        customerId: customer.id,
        serviceType: "TOUR",
        resourceId: tour.id,
        startDate: day(45),
        endDate: day(48),
        guests: 2,
      });
      console.log(`  demo booking ${b.reference} (${b.status}) on ${tour.name}`);
    }
  }

  console.log(`\n  password for all three: ${DEMO_PASSWORD}`);
}

const run = process.argv.includes("--remove") ? remove : create;

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
