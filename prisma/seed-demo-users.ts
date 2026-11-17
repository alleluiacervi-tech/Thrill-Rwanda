import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { adapterFor } from "../src/lib/db-adapter";



/**
 * Demo sign-ins: a customer, a provider, an administrator and one account per
 * staff role. Re-running updates them; `--remove` deletes them.
 *
 * The password defaults to a known value for local use. On any database
 * other people can reach (a hosted test site), set DEMO_PASSWORD to something
 * private: otherwise anyone who reads this file can sign in as admin.
 */
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "thrill-demo-2026";
if (DEMO_PASSWORD.length < 10) throw new Error("DEMO_PASSWORD must be at least 10 characters.");

type Demo = {
  email: string;
  name: string;
  role: "CUSTOMER" | "PROVIDER" | "ADMIN";
  staffRole?: "SALES" | "OPERATIONS" | "FINANCE";
  phone: string;
};

const DEMO: Demo[] = [
  { email: "customer@thrillrwanda.test", name: "Amina Uwimana", role: "CUSTOMER", phone: "+250788000001" },
  { email: "provider@thrillrwanda.test", name: "Jean Claude Habimana", role: "PROVIDER", phone: "+250788000002" },
  { email: "admin@thrillrwanda.test", name: "Thrill Rwanda Admin", role: "ADMIN", phone: "+250788000003" },
  // Staff work the enquiry desk at /staff; each role sees and does different things.
  { email: "sales@thrillrwanda.test", name: "Grace Mukamana", role: "CUSTOMER", staffRole: "SALES", phone: "+250788000004" },
  { email: "operations@thrillrwanda.test", name: "Eric Niyonzima", role: "CUSTOMER", staffRole: "OPERATIONS", phone: "+250788000005" },
  { email: "finance@thrillrwanda.test", name: "Diane Uwase", role: "CUSTOMER", staffRole: "FINANCE", phone: "+250788000006" },
];

/** The seeded provider the demo provider account will own (from src/lib/content.ts). */
const PROVIDER_SLUG = "volcano-trails-rwanda";

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
      data: {
        role: d.role,
        staffRole: d.staffRole ?? null,
        phone: d.phone,
        emailVerified: true,
        isActive: true,
      },
    });
    // An existing account keeps its old password unless it is set again.
    if (existing) {
      const { hashPassword } = await import("better-auth/crypto");
      await db.account.updateMany({
        where: { userId: existing.id, providerId: "credential" },
        data: { password: await hashPassword(DEMO_PASSWORD) },
      });
    }

    console.log(`  ${d.email.padEnd(30)} ${d.staffRole ?? d.role}`);
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

  // createBooking reads cached site settings, which need the web server. Outside it, skip quietly.
  if (!existingBooking && provider) try {
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
  } catch {
    console.log("  demo booking skipped (needs the running app); book one from the site instead");
  }

  console.log(
    process.env.DEMO_PASSWORD
      ? "\n  password: the DEMO_PASSWORD you set"
      : `\n  password for every account: ${DEMO_PASSWORD}`,
  );
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
