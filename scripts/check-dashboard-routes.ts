import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
import type { Role, StaffRole } from "../src/generated/prisma/enums";

const origin = "http://localhost:3000";
const providerRoutes = [
  "/provider", "/provider/profile", "/provider/listings", "/provider/listings/hotels/new",
  "/provider/availability", "/provider/bookings", "/provider/notifications",
];
const adminRoutes = [
  "/admin", "/admin/profile", "/admin/contacts", "/admin/enquiries", "/admin/enquiries/new",
  "/admin/bookings", "/admin/listings", "/admin/listings/new/hotels",
  "/admin/listings/new/tours", "/admin/listings/new/vehicles", "/admin/transfers",
  "/admin/transfers/new", "/admin/venues", "/admin/venues/new", "/admin/business-venues",
  "/admin/providers", "/admin/clients", "/admin/readiness", "/admin/launch",
  "/admin/support", "/admin/reports", "/admin/finance", "/admin/suppliers",
  "/admin/payments", "/admin/payments/routing", "/admin/payments?view=legacy", "/admin/reviews", "/admin/users", "/admin/activity",
  "/admin/activity/export", "/admin/emails", "/admin/legal", "/admin/settings",
  "/admin/notifications",
];
const staffRoutes = ["/staff/enquiries", "/staff/reports", "/staff/reports/export", "/staff/suppliers"];

function checkLocalDatabase() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "54329" || url.pathname !== "/thrill_rwanda" ||
    url.searchParams.has("host") || process.env.NODE_ENV === "production") {
    throw new Error("Use the project-local PostgreSQL database and local web server.");
  }
}

async function request(path: string, cookie?: string) {
  const response = await fetch(origin + path, {
    headers: cookie ? { Cookie: cookie } : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(90_000),
  });
  return { status: response.status, location: response.headers.get("location"), body: await response.text() };
}

async function pages(label: string, paths: string[], cookie: string) {
  for (let start = 0; start < paths.length; start += 3) {
    await Promise.all(paths.slice(start, start + 3).map(async (path) => {
      const result = await request(path, cookie);
      assert.equal(result.status, 200, `${label} cannot open ${path}`);
      assert.doesNotMatch(result.body, /NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK|BAILOUT_TO_CLIENT_SIDE_RENDERING;Server error/);
    }));
  }
  console.log(`PASS: ${label} opened ${paths.length} dashboard routes`);
}

async function blocked(path: string, cookie: string | undefined, destination: RegExp) {
  const { status, location, body } = await request(path, cookie);
  assert.ok(status >= 300 && status < 400 || status === 200 && body.includes("NEXT_REDIRECT"),
    `Expected an access redirect from ${path}, got ${status}`);
  assert.match(location ?? body, destination);
}

async function main() {
  checkLocalDatabase();
  assert.equal((await request("/api/health")).status, 200, "Start the local app before running dashboard checks");
  const ids: string[] = [];
  const contactCases: string[] = [];
  async function session(role: Role, staffRole?: StaffRole) {
    const id = randomUUID(), password = randomUUID() + randomUUID();
    const email = `dashboard-${id}@example.test`;
    await db.user.create({
      data: {
        id, email, emailVerified: true, fullName: "Temporary dashboard check",
        accounts: { create: { accountId: id, issuer: "local:credential", providerId: "credential", password: await hashPassword(password) } },
      },
    });
    ids.push(id);
    const signIn = await fetch(origin + "/api/auth/sign-in/email", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(20_000),
    });
    assert.equal(signIn.status, 200, "Could not sign in to the local app");
    await signIn.text();
    const cookie = signIn.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    assert.ok(cookie);
    await db.user.update({ where: { id }, data: { role, staffRole, isSuperAdmin: role === "ADMIN" } });
    if (role === "ADMIN" || staffRole) {
      await blocked(role === "ADMIN" ? "/admin" : "/staff/enquiries", cookie, /\/account\/security/);
      // Set the enrollment flag on the isolated fixture after verifying the setup redirect.
      // The fixture has already signed in as a customer to avoid using a real authenticator.
      await db.user.update({ where: { id }, data: { twoFactorEnabled: true } });
    }
    if (role === "PROVIDER") await db.provider.create({
      data: { userId: id, businessName: "Temporary audit hotel", slug: `audit-${id}`, kind: "HOTEL", status: "VERIFIED" },
    });
    return cookie;
  }

  try {
    await blocked("/admin", undefined, /\/sign-in/);
    assert.equal((await request("/api/documents/" + randomUUID())).status, 401);
    for (const job of ["release-holds", "enquiry-notifications", "maintenance"]) {
      const { status } = await request(`/api/cron/${job}`);
      assert.ok(status === 401 || status === 503, `Unauthenticated job accepted: ${job}`);
    }
    const upload = await fetch(origin + "/api/uploads", { method: "POST", signal: AbortSignal.timeout(20_000) });
    assert.equal(upload.status, 401);
    await upload.text();
    console.log("PASS: private documents, scheduled jobs and uploads reject unauthenticated requests");
    const admin = await session("ADMIN");
    const sales = await session("CUSTOMER", "SALES");
    const operations = await session("CUSTOMER", "OPERATIONS");
    const finance = await session("CUSTOMER", "FINANCE");
    const provider = await session("PROVIDER");
    const contactName = `Directory fixture ${randomUUID()}`;
    const contactEmail = `${randomUUID()}@example.test`;
    for (const ownerId of [ids[1], ids[2]]) {
      const reference = randomUUID();
      await db.enquiry.create({ data: {
        reference, submissionKey: randomUUID(), fingerprint: reference, contactKey: contactEmail,
        ownerId, name: contactName, email: contactEmail, phone: "", replyChannel: "EMAIL",
        consentVersion: "test", consentText: "test", privacyVersion: 1, details: {},
      } });
      contactCases.push(reference);
    }
    const directory = await request("/staff/contacts?q=" + encodeURIComponent(contactName), sales);
    assert.ok(directory.body.includes(contactCases[0]) && !directory.body.includes(contactCases[1]));
    const history = await request("/staff/contacts?contact=" + contactCases[0], sales);
    assert.ok(history.body.includes("/staff/enquiries/" + contactCases[0]));
    assert.ok(!history.body.includes(contactCases[1]));
    const adminHistory = await request("/admin/contacts?contact=" + contactCases[0], admin);
    for (const reference of contactCases) assert.ok(adminHistory.body.includes("/admin/enquiries/" + reference));
    const detail = await request("/staff/enquiries/" + contactCases[0], sales);
    assert.ok(detail.body.includes("Email the client"));
    await pages("Administrator", adminRoutes, admin);
    await pages("Sales", [...staffRoutes, "/staff/contacts", "/staff/enquiries/new", "/staff/support"], sales);
    await pages("Operations", [...staffRoutes, "/staff/contacts", "/staff/enquiries/new", "/staff/support"], operations);
    await pages("Finance", [...staffRoutes, "/staff/finance", "/staff/finance/collections"], finance);
    await pages("Approved hotel provider", providerRoutes, provider);
    await blocked("/staff", sales, /\/staff\/enquiries/);
    await blocked("/admin/business-venues", operations, /\/account\?denied=1/);
    await blocked("/staff/finance", sales, /\/staff\/enquiries/);
    await blocked("/staff/finance/collections", sales, /\/staff\/enquiries/);
    await blocked("/staff/enquiries/new", finance, /\/staff\/enquiries/);
    await blocked("/staff/contacts", finance, /\/staff\/enquiries/);
    await blocked("/provider/listings/vehicles/new", provider, /\/provider/);
    await blocked("/admin/listings/new/hotels", provider, /\/account\?denied=1/);
    console.log("PASS: sign-in, two-step enrollment and role/category boundaries");
  } finally {
    await db.enquiry.deleteMany({ where: { reference: { in: contactCases } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
