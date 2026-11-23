/** Opens the ticketing screens against the running local app as each kind of user, then removes every fixture it created. */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
import type { Role, StaffRole } from "../src/generated/prisma/enums";

const origin = "http://localhost:3000";

function checkLocalDatabase() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "54329" || url.pathname !== "/thrill_rwanda" || process.env.NODE_ENV === "production")
    throw new Error("Use the project-local PostgreSQL database and local web server.");
}
async function get(path: string, cookie?: string) {
  const response = await fetch(origin + path, { headers: cookie ? { Cookie: cookie } : undefined, redirect: "manual", signal: AbortSignal.timeout(90_000) });
  return { status: response.status, location: response.headers.get("location"), type: response.headers.get("content-type") ?? "", body: await response.text() };
}

async function main() {
  checkLocalDatabase();
  assert.equal((await get("/api/health")).status, 200, "Start the local app before running this check");
  const T = await import("../src/lib/ticketing");
  // Remove fixtures a previous interrupted run may have left behind.
  const stale = (await db.user.findMany({ where: { email: { startsWith: "ticketing-", endsWith: "@example.test" } }, select: { id: true } })).map((u) => u.id);
  await db.session.deleteMany({ where: { userId: { in: stale } } });
  await db.account.deleteMany({ where: { userId: { in: stale } } });
  await db.user.deleteMany({ where: { id: { in: stale } } }).catch(() => undefined);
  const users: string[] = [];
  let enquiryId: string | undefined;
  async function session(role: Role, staffRole?: StaffRole) {
    const id = randomUUID(), password = randomUUID() + randomUUID();
    await db.user.create({
      data: {
        id, email: `ticketing-${id}@example.test`, emailVerified: true, fullName: `Fixture ${staffRole ?? role}`,
        accounts: { create: { accountId: id, issuer: "local:credential", providerId: "credential", password: await hashPassword(password) } },
      },
    });
    users.push(id);
    const signIn = await fetch(origin + "/api/auth/sign-in/email", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ email: `ticketing-${id}@example.test`, password }),
    });
    assert.equal(signIn.status, 200, "Could not sign in to the local app");
    await signIn.text();
    // Elevate after sign-in, as the dashboard checks do, so the sign-in does not ask for a second factor.
    await db.user.update({ where: { id }, data: { role, staffRole, isSuperAdmin: role === "ADMIN", twoFactorEnabled: role === "ADMIN" || !!staffRole } });
    return { id, cookie: signIn.headers.getSetCookie().map((v) => v.split(";")[0]).join("; ") };
  }

  try {
    const sales = await session("CUSTOMER", "SALES");
    const finance = await session("CUSTOMER", "FINANCE");
    const admin = await session("ADMIN");
    const client = await session("CUSTOMER");
    const stranger = await session("CUSTOMER");

    const enquiry = await db.enquiry.create({ data: {
      submissionKey: randomUUID(), fingerprint: randomUUID(), contactKey: randomUUID(), reference: `TRQ-${randomUUID()}`, service: "FLIGHT",
      name: "Fixture Traveller", phone: "+250788000111", email: "fixture@example.test", replyChannel: "EMAIL", consentVersion: "t", consentText: "t", privacyVersion: 1,
      status: "QUOTE_SENT", ownerId: sales.id, details: { adults: 1, children: 0, infants: 0, tripType: "ONE_WAY" },
    } });
    enquiryId = enquiry.id;
    const ref = enquiry.reference;
    await db.clientCaseAccess.create({ data: { enquiryId: enquiry.id, userId: client.id, canAccept: true } });

    // Before a file exists, the desk and the case page both load, and customers are kept out of staff pages.
    { const first = await get("/staff/ticketing", sales.cookie); assert.equal(first.status, 200, `Desk answered ${first.status} -> ${first.location}`); }
    assert.equal((await get(`/staff/ticketing/${ref}`, sales.cookie)).body.includes("No ticketing file yet"), true);
    assert.match((await get("/staff/ticketing", client.cookie)).location ?? "", /\/account\?denied=1/);
    assert.match((await get("/staff/ticketing")).location ?? "", /\/sign-in/);
    assert.match((await get("/admin/ticketing", sales.cookie)).location ?? "", /\/account|\/sign-in|\/admin/);

    await T.openTicketing(sales.id, ref);
    const segment = (extra = {}) => ({ airline: "WB", flightNumber: "700", origin: "KGL", destination: "NBO", departLocal: "2027-03-04T09:15", arriveLocal: "2027-03-04T10:40", cabin: "ECONOMY" as const, bookingClass: "Y", terminal: "1", ...extra });
    const valid = new Date(Date.now() + 5 * 3_600_000);
    await T.saveFareOptions(sales.id, { reference: ref, version: 0, options: [
      { label: "Best value", currency: "RWF", totalMinor: 100000, fareBasis: "YOW", baggage: "1 x 23kg", changeRule: "Fee applies", refundRule: "Non-refundable", validUntil: valid, segments: [segment()] },
      { label: "Flexible", currency: "RWF", totalMinor: 140000, fareBasis: "YFLEX", baggage: "2 x 23kg", changeRule: "Free changes", refundRule: "Refundable", validUntil: valid, segments: [segment({ flightNumber: "702" })] },
    ] });

    // The client cannot see options until they are shared.
    let trip = await get(`/account/enquiries/${ref}/trip`, client.cookie);
    assert.equal(trip.status, 200, trip.body.replace(/<[^>]+>/g, " ").replace(/s+/g, " ").slice(0, 600));
    assert.ok(trip.body.includes("Fare options are on their way") && !trip.body.includes("Best value"));
    await T.shareFareOptions(sales.id, ref, 1);
    trip = await get(`/account/enquiries/${ref}/trip`, client.cookie);
    assert.ok(trip.body.includes("Best value") && trip.body.includes("Flexible") && trip.body.includes("Choose this fare"));
    assert.equal((await get(`/account/enquiries/${ref}/trip`, stranger.cookie)).status, 404);

    // Staff screens show the file, the next step and the deadline.
    const desk = await get("/staff/ticketing", sales.cookie);
    assert.ok(desk.body.includes(ref) && desk.body.includes("Air ticketing desk"));
    const detail = await get(`/staff/ticketing/${ref}`, sales.cookie);
    assert.equal(detail.status, 200, (detail.body.match(/.{0,200}(Error:|error\":|Invariant|Cannot read|is not defined).{0,400}/) ?? [detail.body.slice(0, 300)])[0]);
    assert.ok(detail.body.includes("Fare options") && detail.body.includes("Next:") && detail.body.includes("Save fare options"));
    assert.equal((await get(`/admin/ticketing/${ref}`, admin.cookie)).status, 200);
    assert.ok((await get(`/staff/enquiries/${ref}`, sales.cookie)).body.includes("Air ticketing file"));

    // Move through to issued, with the funds gate satisfied.
    const option = (await db.flightOption.findMany({ where: { ticketing: { enquiryId: enquiry.id } }, orderBy: { position: "asc" } }))[0]!;
    await T.chooseFareOption(sales.id, { reference: ref, version: 2, optionId: option.id });
    await T.advanceTicketing(sales.id, { reference: ref, version: 3, move: { to: "AWAITING_PAYMENT" } });
    await T.saveTravellers(sales.id, { reference: ref, version: 4, passengers: [{ kind: "ADULT", title: "MR", givenNames: "Fixture", surname: "Traveller", dateOfBirth: "1985-04-10", nationality: "RW", documentNumber: "PC999888", documentExpiry: "2031-01-01" }] });
    const quote = await db.quoteVersion.create({ data: { enquiryId: enquiry.id, number: 1, intentKey: randomUUID(), inputHash: "x", contentHash: "x", snapshot: {}, totalMinor: 100000, currency: "RWF", expiresAt: valid, paymentDeadline: valid, createdById: admin.id } });
    const financialCase = await db.financialCase.create({ data: { enquiryId: enquiry.id, quoteId: quote.id, currency: "RWF", customerChargeMinor: 100000, serviceFeeMinor: 0, taxReserveMinor: 0, requiredFundingMinor: 100000 } });
    const operation = await db.financialOperation.create({ data: { caseId: financialCase.id, actorId: admin.id, intentKey: randomUUID(), inputHash: "x", action: "RECEIPT", evidence: "fixture", changes: {} } });
    await db.financialEntry.create({ data: { caseId: financialCase.id, operationId: operation.id, kind: "RECEIPT", amountMinor: 100000 } });
    await T.advanceTicketing(sales.id, { reference: ref, version: 5, move: { to: "READY_TO_TICKET" } });
    await T.advanceTicketing(sales.id, { reference: ref, version: 6, move: { to: "TICKETING", pnr: "XY12ZW", partner: "Fixture Partner", ticketTimeLimit: new Date(Date.now() + 3 * 3_600_000) } });
    const passenger = await db.flightPassenger.findFirstOrThrow({ where: { ticketing: { enquiryId: enquiry.id } } });

    const ticketing = await get(`/staff/ticketing/${ref}`, sales.cookie);
    assert.ok(ticketing.body.includes("Record issued tickets") && ticketing.body.includes("PNR XY12ZW"));
    assert.equal((await get(`/staff/ticketing/${ref}/itinerary`, sales.cookie)).status, 409, "No itinerary before tickets are issued");
    assert.equal((await get(`/account/enquiries/${ref}/trip/itinerary`, client.cookie)).status, 404);

    await T.issueTickets(sales.id, { reference: ref, version: 7, issue: { pnr: "XY12ZW", partner: "Fixture Partner", partnerReference: "", evidence: "Partner portal shows OK for the ticket.", tickets: [{ passengerId: passenger.id, ticketNumber: "1762345670001" }] } });

    // Issued: itinerary PDFs for staff and client, passport numbers only for the case team.
    for (const [who, path, cookie] of [["staff", `/staff/ticketing/${ref}/itinerary`, sales.cookie], ["admin", `/admin/ticketing/${ref}/itinerary`, admin.cookie], ["client", `/account/enquiries/${ref}/trip/itinerary`, client.cookie]] as const) {
      const pdf = await fetch(origin + path, { headers: { Cookie: cookie } });
      assert.equal(pdf.status, 200, `${who} cannot download the itinerary`);
      assert.equal(pdf.headers.get("content-type"), "application/pdf");
      assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
    }
    assert.equal((await fetch(origin + `/account/enquiries/${ref}/trip/itinerary`, { headers: { Cookie: stranger.cookie } })).status, 404);
    const salesView = await get(`/staff/ticketing/${ref}`, sales.cookie);
    assert.ok(salesView.body.includes("1762345670001") && salesView.body.includes("Download itinerary PDF") && salesView.body.includes("After-sales"));
    const clientTrip = await get(`/account/enquiries/${ref}/trip`, client.cookie);
    assert.ok(clientTrip.body.includes("176 2345670001") && clientTrip.body.includes("Download itinerary") && clientTrip.body.includes("Need a change"));
    assert.ok(!clientTrip.body.includes("PC999888"), "Passport numbers must never reach the client");
    // Finance only sees cases that have reached payment, exactly as in the enquiry list.
    assert.equal((await get(`/staff/ticketing/${ref}`, finance.cookie)).status, 404);
    await db.enquiry.update({ where: { id: enquiry.id }, data: { status: "PARTNER_PROCESSING" } });
    const financeView = await get(`/staff/ticketing/${ref}`, finance.cookie);
    assert.equal(financeView.status, 200);
    assert.ok(!financeView.body.includes("PC999888"), "Finance must not see passport numbers");
    const queue = await get("/staff/ticketing?view=issued", sales.cookie);
    assert.ok(queue.body.includes(ref));
    console.log("PASS: ticketing screens, access boundaries, itinerary downloads and passport privacy");
  } finally {
    if (enquiryId) {
      const file = await db.flightTicketing.findUnique({ where: { enquiryId }, select: { id: true } });
      if (file) {
        await db.flightServiceRequest.deleteMany({ where: { ticketingId: file.id } });
        await db.flightTicketing.delete({ where: { id: file.id } });
      }
      await db.financialEntry.deleteMany({ where: { financialCase: { enquiryId } } });
      await db.financialOperation.deleteMany({ where: { financialCase: { enquiryId } } });
      await db.financialCase.deleteMany({ where: { enquiryId } });
      await db.quoteVersion.deleteMany({ where: { enquiryId } });
      await db.clientCaseAccess.deleteMany({ where: { enquiryId } });
      await db.notificationJob.deleteMany({ where: { enquiryId } });
      await db.enquiryActivity.deleteMany({ where: { enquiryId } });
      await db.enquiry.delete({ where: { id: enquiryId } }).catch(() => undefined);
    }
    await db.notification.deleteMany({ where: { userId: { in: users } } });
    await db.session.deleteMany({ where: { userId: { in: users } } });
    await db.account.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } }).catch(() => console.warn("Some fixture users could not be removed"));
    await db.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
