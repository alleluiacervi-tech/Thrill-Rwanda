/** Exercises air ticketing against a disposable local database: gates, concurrency, issuing, after-sales and retention. */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Pool } from "pg";

async function main() {
  const root = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(["127.0.0.1", "localhost"].includes(root.hostname) && root.port === "54329" &&
    root.pathname === "/thrill_rwanda" && process.env.NODE_ENV !== "production",
  "Start the project-local PostgreSQL instance before running this test.");
  const dbName = `thrill_ticketing_test_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: root.href });
  const local = new URL(root.href);
  local.pathname = `/${dbName}`;
  let created = false;
  let disconnect: (() => Promise<void>) | undefined;
  try {
    await adminPool.query(`CREATE DATABASE "${dbName}"`);
    created = true;
    Object.assign(process.env, { DATABASE_URL: local.href, DIRECT_URL: local.href, APP_ENV: "test", VERCEL_ENV: "", RESEND_API_KEY: "" });
    const migration = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { encoding: "utf8", env: process.env });
    assert.equal(migration.status, 0, migration.stderr || "Could not migrate the disposable database.");
    const { db } = await import("../src/lib/db");
    disconnect = () => db.$disconnect();
    const T = await import("../src/lib/ticketing");
    const { itineraryPdfResponse } = await import("../src/lib/ticketing-documents");

    const admin = await db.user.create({ data: { email: "admin@example.invalid", fullName: "Fixture Admin", role: "ADMIN" } });
    const sales = await db.user.create({ data: { email: "sales@example.invalid", fullName: "Fixture Sales", staffRole: "SALES" } });
    const guest = await db.user.create({ data: { email: "guest@example.invalid", fullName: "Fixture Guest" } });
    const stranger = await db.user.create({ data: { email: "stranger@example.invalid", fullName: "Other Guest" } });
    const enquiry = await db.enquiry.create({ data: {
      submissionKey: randomUUID(), fingerprint: "fixture", contactKey: "fixture", reference: `TRQ-${randomUUID()}`, service: "FLIGHT",
      name: "Jean Mugisha", phone: "+250788123456", email: "jean@example.invalid", replyChannel: "EMAIL", consentVersion: "v", consentText: "t",
      privacyVersion: 1, status: "QUOTE_SENT", ownerId: sales.id, details: { adults: 2, children: 0, infants: 0, tripType: "RETURN" },
    } });
    const ref = enquiry.reference;
    await db.clientCaseAccess.create({ data: { enquiryId: enquiry.id, userId: guest.id, canAccept: true } });
    const file = async () => db.flightTicketing.findUniqueOrThrow({ where: { enquiryId: enquiry.id }, include: { options: { include: { segments: { orderBy: { position: "asc" } } } }, passengers: true, requests: true } });

    // Access: customers cannot open ticketing; the owner and admins can; other sales staff cannot.
    await assert.rejects(T.openTicketing(guest.id, ref), /restricted to the case team/);
    const otherSales = await db.user.create({ data: { email: "sales2@example.invalid", fullName: "Other Sales", staffRole: "SALES" } });
    await assert.rejects(T.openTicketing(otherSales.id, ref), /owner|unavailable/);
    const id = await T.openTicketing(sales.id, ref);
    assert.equal(await T.openTicketing(admin.id, ref), id, "Opening twice must not duplicate the file");
    assert.equal(await db.flightTicketing.count(), 1);

    // Fare options.
    const segment = (extra = {}) => ({ airline: "WB", flightNumber: "700", origin: "KGL", destination: "NBO", departLocal: "2027-03-04T09:15", arriveLocal: "2027-03-04T10:40", cabin: "ECONOMY" as const, bookingClass: "Y", terminal: "", ...extra });
    const option = (label: string, totalMinor: number, validUntil: Date) => ({
      label, currency: "RWF", totalMinor, fareBasis: "YOW", baggage: "1 x 23kg", changeRule: "Fee applies", refundRule: "Non-refundable", validUntil,
      segments: [segment(), segment({ airline: "KQ", flightNumber: "501", origin: "NBO", destination: "KGL", departLocal: "2027-03-10T09:00", arriveLocal: "2027-03-10T10:25" })],
    });
    const future = new Date(Date.now() + 2 * 86_400_000);
    let version = (await file()).version;
    await assert.rejects(T.saveFareOptions(sales.id, { reference: ref, version, options: [option("Past", 100000, new Date(Date.now() - 1000))] }), /past its validity/);
    await assert.rejects(T.saveFareOptions(sales.id, { reference: ref, version, options: [option("Same", 100000, future), option("same", 90000, future)] }), /own name/);
    await T.saveFareOptions(sales.id, { reference: ref, version, options: [option("Best value", 100000, future), option("Fastest", 120000, future)] });
    await assert.rejects(T.saveFareOptions(sales.id, { reference: ref, version, options: [option("Stale", 100000, future)] }), /changed while you were editing/);
    version = (await file()).version;
    await assert.rejects(T.advanceTicketing(sales.id, { reference: ref, version, move: { to: "AWAITING_PAYMENT" } }), /Choose a fare/);

    // A customer cannot choose before options are shared, and cannot choose another customer's fare.
    const options = (await file()).options;
    await assert.rejects(T.clientChooseFareOption(guest.id, { reference: ref, optionId: options[0]!.id }), /not open/);
    await T.shareFareOptions(sales.id, ref, version);
    await assert.rejects(T.clientChooseFareOption(stranger.id, { reference: ref, optionId: options[0]!.id }), /unavailable/);
    await T.clientChooseFareOption(guest.id, { reference: ref, optionId: options.find((o) => o.label === "Best value")!.id });
    assert.equal((await file()).options.filter((o) => o.selected).length, 1);
    // The database allows only one selected option per file.
    await assert.rejects(db.flightOption.updateMany({ where: { ticketingId: id }, data: { selected: true } }));

    // Race: two staff members advance the same version; exactly one wins.
    version = (await file()).version;
    const results = await Promise.allSettled([
      T.advanceTicketing(sales.id, { reference: ref, version, move: { to: "AWAITING_PAYMENT" } }),
      T.advanceTicketing(admin.id, { reference: ref, version, move: { to: "AWAITING_PAYMENT" } }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, "Only one concurrent move may succeed");
    assert.equal((await file()).status, "AWAITING_PAYMENT");

    // Ticketing is blocked until the full quote is verified as paid.
    const traveller = (extra = {}) => ({ kind: "ADULT" as const, title: "MR" as const, givenNames: "Jean", surname: "Mugisha", dateOfBirth: "1985-04-10", nationality: "RW", documentNumber: "PC123456", documentExpiry: "2031-01-01", ...extra });
    version = (await file()).version;
    await assert.rejects(T.saveTravellers(sales.id, { reference: ref, version, passengers: [traveller(), traveller()] }), /duplicates/);
    await T.saveTravellers(sales.id, { reference: ref, version, passengers: [traveller(), traveller({ givenNames: "Marie", surname: "Uwase", title: "MS", dateOfBirth: "1990-02-02", documentNumber: "PC654321" })] });
    version = (await file()).version;
    await assert.rejects(T.advanceTicketing(sales.id, { reference: ref, version, move: { to: "READY_TO_TICKET" } }), /Verified funds/);

    const quote = await db.quoteVersion.create({ data: {
      enquiryId: enquiry.id, number: 1, intentKey: randomUUID(), inputHash: "x", contentHash: "x", snapshot: {}, totalMinor: 100000, currency: "RWF",
      expiresAt: future, paymentDeadline: future, createdById: admin.id,
    } });
    const financialCase = await db.financialCase.create({ data: {
      enquiryId: enquiry.id, quoteId: quote.id, currency: "RWF", customerChargeMinor: 100000, serviceFeeMinor: 10000, taxReserveMinor: 0, requiredFundingMinor: 100000,
    } });
    const operation = await db.financialOperation.create({ data: { caseId: financialCase.id, actorId: admin.id, intentKey: randomUUID(), inputHash: "x", action: "RECEIPT", evidence: "fixture", changes: {} } });
    await db.financialEntry.create({ data: { caseId: financialCase.id, operationId: operation.id, kind: "RECEIPT", amountMinor: 60000 } });
    await assert.rejects(T.advanceTicketing(sales.id, { reference: ref, version, move: { to: "READY_TO_TICKET" } }), /Verified funds/, "Part payment must not unlock ticketing");
    await db.financialEntry.create({ data: { caseId: financialCase.id, operationId: operation.id, kind: "RECEIPT", amountMinor: 40000 } });
    await assert.rejects(T.advanceTicketing(sales.id, { reference: ref, version, move: { to: "OPTIONS" } }), /Funds are already verified/);
    await T.advanceTicketing(sales.id, { reference: ref, version, move: { to: "READY_TO_TICKET" } });
    version = (await file()).version;

    // Partner hold needs a future time limit.
    await assert.rejects(T.advanceTicketing(sales.id, { reference: ref, version, move: { to: "TICKETING", pnr: "AB12CD", partner: "Partner Travel", ticketTimeLimit: new Date(Date.now() - 1000) } }), /already passed/);
    await T.advanceTicketing(sales.id, { reference: ref, version, move: { to: "TICKETING", pnr: "AB12CD", partner: "Partner Travel", ticketTimeLimit: new Date(Date.now() + 6 * 3_600_000) } });
    version = (await file()).version;

    // Issuing: every traveller, unique numbers, evidence.
    const [p1, p2] = (await file()).passengers.sort((a, b) => a.position - b.position);
    const issue = (tickets: { passengerId: string; ticketNumber: string }[]) => ({ pnr: "AB12CD", partner: "Partner Travel", partnerReference: "", evidence: "Partner portal shows OK for all tickets.", tickets });
    await assert.rejects(T.issueTickets(sales.id, { reference: ref, version, issue: issue([{ passengerId: p1!.id, ticketNumber: "1762345678901" }]) }), /Every traveller/);
    await assert.rejects(T.issueTickets(sales.id, { reference: ref, version, issue: issue([{ passengerId: p1!.id, ticketNumber: "1762345678901" }, { passengerId: p2!.id, ticketNumber: "1762345678901" }]) }), /twice/);
    await T.issueTickets(sales.id, { reference: ref, version, issue: issue([{ passengerId: p1!.id, ticketNumber: "1762345678901" }, { passengerId: p2!.id, ticketNumber: "1762345678902" }]) });
    let current = await file();
    assert.equal(current.status, "ISSUED");
    assert.deepEqual(current.passengers.map((p) => p.ticketNumber).sort(), ["1762345678901", "1762345678902"]);
    await assert.rejects(T.saveTravellers(sales.id, { reference: ref, version: current.version, passengers: [traveller()] }), /once tickets are issued/);

    // The itinerary exists only for issued files and never leaks document numbers.
    const trip = await T.readClientTrip(guest.id, ref);
    assert.ok(trip?.file && !JSON.stringify(trip).includes("PC123456"), "Client view must not include passport numbers");
    assert.equal(await T.readClientTrip(stranger.id, ref), null);
    const company = { name: "Thrill fixture", email: "desk@example.invalid", phone: "", address: "Kigali" };
    const pdf = await itineraryPdfResponse(current as never, ref, enquiry.name, company);
    assert.equal(pdf?.headers.get("content-type"), "application/pdf");
    assert.equal(await itineraryPdfResponse({ ...current, status: "ISSUED", issuedAt: null } as never, ref, "x", company), null);

    // Delivery by email queues one job and records it.
    const jobId = await T.deliverItinerary(sales.id, { reference: ref, version: current.version, channel: "EMAIL" });
    assert.ok(jobId);
    assert.equal(await db.notificationJob.count({ where: { enquiryId: enquiry.id, kind: "STAFF_EMAIL" } }), 1);
    current = await file();
    assert.ok(current.deliveredAt);

    // After-sales: the client raises, duplicates are blocked, staff complete a reissue and a refund.
    await assert.rejects(T.raiseServiceRequest(stranger.id, { reference: ref, kind: "CHANGE", description: "Move my flight please", passengerIds: [] }), /unavailable/);
    await T.raiseServiceRequest(guest.id, { reference: ref, kind: "REISSUE", description: "Move the return flight to 12 March", passengerIds: [p1!.id] });
    await assert.rejects(T.raiseServiceRequest(guest.id, { reference: ref, kind: "REISSUE", description: "Move it again please", passengerIds: [p1!.id] }), /already open/);
    current = await file();
    const reissue = current.requests[0]!;
    const base = { reference: ref, requestId: reissue.id, evidence: "", resolution: "", feeMinor: 7500, refundMinor: 0, tickets: [] as { passengerId: string; ticketNumber: string }[] };
    await T.updateServiceRequest(sales.id, { ...base, version: current.version, status: "APPROVED" });
    await assert.rejects(T.updateServiceRequest(sales.id, { ...base, version: (await file()).version, status: "COMPLETED", evidence: "Partner reissued the ticket." }), /new ticket number/);
    await T.updateServiceRequest(sales.id, { ...base, version: (await file()).version, status: "COMPLETED", evidence: "Partner reissued the ticket.", tickets: [{ passengerId: p1!.id, ticketNumber: "1762345678999" }] });
    current = await file();
    const reissued = current.passengers.find((p) => p.id === p1!.id)!;
    assert.equal(reissued.ticketNumber, "1762345678999");
    assert.deepEqual(reissued.previousTickets, ["1762345678901"]);

    await T.raiseServiceRequest(sales.id, { reference: ref, kind: "REFUND", description: "Client cancelled the second traveller", passengerIds: [p2!.id] }, "STAFF");
    current = await file();
    const refund = current.requests.find((r) => r.kind === "REFUND")!;
    const refundBase = { reference: ref, requestId: refund.id, evidence: "Partner confirmed the refund.", resolution: "", feeMinor: 0, refundMinor: 0, tickets: [] };
    await T.updateServiceRequest(sales.id, { ...refundBase, version: current.version, status: "APPROVED" });
    await assert.rejects(T.updateServiceRequest(sales.id, { ...refundBase, version: (await file()).version, status: "COMPLETED" }), /refund amount/);
    await T.updateServiceRequest(sales.id, { ...refundBase, version: (await file()).version, status: "COMPLETED", refundMinor: 30000 });
    current = await file();
    assert.equal(current.passengers.find((p) => p.id === p2!.id)!.status, "REFUNDED");
    assert.ok(await db.enquiryActivity.count({ where: { enquiryId: enquiry.id, kind: "TICKETING_REFUND_REVIEW" } }), "Finance must be told a refund is owed");

    // A file closes only after the last flight, then travel documents are cleared after 30 days.
    await assert.rejects(T.advanceTicketing(sales.id, { reference: ref, version: current.version, move: { to: "CLOSED" } }), /after the last flight/);
    const dry = await T.redactTicketingDocuments(false);
    assert.equal(dry.files, 0);
    await db.flightSegment.updateMany({ data: { departLocal: "2024-01-01T09:00", arriveLocal: "2024-01-01T10:00" } });
    assert.equal((await T.redactTicketingDocuments(false)).files, 1);
    assert.ok((await file()).passengers.every((p) => p.documentNumber), "A dry run must not change anything");
    await T.redactTicketingDocuments(true);
    current = await file();
    assert.ok(current.redactedAt && current.passengers.every((p) => !p.documentNumber && !p.dateOfBirth && p.ticketNumber));
    await T.advanceTicketing(sales.id, { reference: ref, version: current.version, move: { to: "CLOSED" } });
    assert.equal((await file()).status, "CLOSED");

    // Queue scoping: the owner sees the file, another sales member does not.
    assert.equal((await T.ticketingQueue(sales.id, "all", 0, 10)).total, 1);
    assert.equal((await T.ticketingQueue(otherSales.id, "all", 0, 10)).total, 0);
    console.log("PASS: air ticketing gates, concurrency, issuing, after-sales and retention");
  } finally {
    await disconnect?.();
    if (created) await adminPool.query(`DROP DATABASE "${dbName}" WITH (FORCE)`);
    await adminPool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
