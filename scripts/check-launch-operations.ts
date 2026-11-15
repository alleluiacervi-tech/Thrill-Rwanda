import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import {
  savePublication,
  savePolicy,
  saveSupportCase,
  approveOffer,
  offerContentHash,
  deleteRetainedDocument,
} from "../src/lib/operations";
import { saveEnquiry } from "../src/lib/flight-enquiries";
import { readPrivateDocument } from "../src/lib/document-access";
import { operationsReport, reportCsv } from "../src/lib/operations-report";
import { removeEnquiryFixtures } from "./enquiry-test-cleanup";
async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "54329" ||
    url.pathname !== "/thrill_rwanda" ||
    process.env.NODE_ENV === "production"
  )
    throw new Error("Project-local nonproduction database only");
  const users: string[] = [],
    leads: string[] = [],
    cases: string[] = [],
    bookings: string[] = [],
    providers: string[] = [],
    tours: string[] = [];
  const oldPublication = await db.servicePublication.findUnique({
      where: { service: "FLIGHT" },
    }),
    oldPolicy = await db.operationsPolicy.findUnique({ where: { id: 1 } });
  const user = async (
    role: "ADMIN" | "CUSTOMER" | "PROVIDER",
    staffRole: "SALES" | "OPERATIONS" | "FINANCE" | null = null,
  ) => {
    const u = await db.user.create({
      data: {
        fullName: "Launch fixture",
        email: `${randomUUID()}@example.invalid`,
        role,
        staffRole,
      },
    });
    users.push(u.id);
    return u;
  };
  try {
    const admin = await user("ADMIN"),
      ops = await user("CUSTOMER", "OPERATIONS"),
      sales = await user("CUSTOMER", "SALES"),
      finance = await user("CUSTOMER", "FINANCE"),
      customer = await user("CUSTOMER"),
      outsider = await user("CUSTOMER"),
      providerUser = await user("PROVIDER");
    const publication = {
      service: "FLIGHT",
      mode: "HIDDEN",
      version: oldPublication?.version ?? -1,
      evidence: "Local fixture approved hidden service scope",
    };
    await assert.rejects(
      () => savePublication(ops.id, publication),
      /Administrator/,
    );
    const lead = async (ownerId: string) => {
      const e = await db.enquiry.create({
        data: {
          submissionKey: randomUUID(),
          fingerprint: randomUUID(),
          contactKey: randomUUID(),
          reference: `LOCAL-${randomUUID()}`,
          name: "Private traveller fixture",
          phone: "+250788000000",
          email: customer.email,
          replyChannel: "EMAIL",
          service: "TRIP",
          source: "WEBSITE",
          details: { location: "Private itinerary fixture" },
          consentVersion: "fixture",
          consentText: "Fixture customer permission",
          privacyVersion: 0,
          status: "CONFIRMED",
          ownerId,
        },
      });
      leads.push(e.id);
      return e;
    };
    const a = await lead(ops.id),
      b = await lead(sales.id);
    await savePublication(admin.id, publication);
    await assert.rejects(
      () => savePublication(admin.id, publication),
      /changed/,
    );
    await assert.rejects(
      () =>
        saveEnquiry({
          submissionKey: randomUUID(),
          name: "Blocked request",
          phone: "",
          email: customer.email,
          replyChannel: "EMAIL",
          service: "FLIGHT",
          source: "WEBSITE",
          details: {},
        }),
      /not accepting/,
    );
    const support = {
      intentKey: randomUUID(),
      enquiryRef: a.reference,
      ownerId: ops.id,
      category: "SERVICE",
      priority: "URGENT",
      status: "OPEN",
      summary: "Supplier pickup review required for fixture",
      nextActionAt: "2028-01-01T10:00",
      evidence: "Verified support issue and responsible owner",
    };
    await assert.rejects(() => saveSupportCase(finance.id, support), /denied/);
    await assert.rejects(
      () =>
        saveSupportCase(sales.id, {
          ...support,
          intentKey: randomUUID(),
          ownerId: sales.id,
        }),
      /workspace/,
    );
    const ref = await saveSupportCase(ops.id, support);
    assert.equal(await saveSupportCase(ops.id, support), ref);
    const c = await db.supportCase.findUniqueOrThrow({
      where: { reference: ref },
    });
    cases.push(c.id);
    const update = {
      ...support,
      reference: ref,
      version: c.version,
      intentKey: randomUUID(),
      status: "WAITING_SUPPLIER",
    };
    const race = await Promise.allSettled([
      saveSupportCase(ops.id, update),
      saveSupportCase(ops.id, { ...update, intentKey: randomUUID() }),
    ]);
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    await assert.rejects(() =>
      saveSupportCase(ops.id, {
        ...update,
        intentKey: randomUUID(),
        status: "RESOLVED",
        outcome: "",
      }),
    );
    const latest = await db.supportCase.findUniqueOrThrow({
      where: { id: c.id },
    });
    await saveSupportCase(ops.id, {
      ...update,
      version: latest.version,
      intentKey: randomUUID(),
      status: "RESOLVED",
      outcome:
        "Supplier confirmed pickup; customer informed and handover complete",
    });
    assert.equal(
      (await db.supportCase.findUniqueOrThrow({ where: { id: c.id } })).status,
      "RESOLVED",
    );
    await db.user.update({ where: { id: ops.id }, data: { staffRole: null } });
    await assert.rejects(
      () => saveSupportCase(ops.id, { ...update, intentKey: randomUUID() }),
      /denied/,
    );
    await db.user.update({
      where: { id: ops.id },
      data: { staffRole: "OPERATIONS" },
    });
    const provider = await db.provider.create({
      data: {
        userId: providerUser.id,
        businessName: "Launch local provider",
        slug: `launch-${randomUUID()}`,
        kind: "CAR",
        kinds: ["CAR", "TOUR"],
        status: "VERIFIED",
      },
    });
    providers.push(provider.id);
    const tour = await db.tour.create({
      data: {
        providerId: provider.id,
        name: "Launch reviewed itinerary",
        description: "A checked local fixture itinerary for operational testing",
        images: ["/media/photos/volcanoes-trek.jpeg"],
        slug: `launch-${randomUUID()}`,
        destination: "Rwanda",
        durationDays: 1,
        maxParticipants: 4,
        priceMinor: 10000,
        itinerary: "Day one local route and approved supplier arrangement",
        suitability:
          "Suitable only after reviewing mobility and travel preferences",
        inclusions: ["Agreed guided service"],
        exclusions: ["Any item outside the agreed scope"],
      },
    });
    tours.push(tour.id);
    const full = await db.tour.findUniqueOrThrow({
      where: { id: tour.id },
      include: { provider: { select: { status: true } } },
    });
    await assert.rejects(
      () =>
        approveOffer(
          sales.id,
          tour.id,
          "Fixture reviewed offer authority",
          offerContentHash(full),
        ),
      /Administrator/,
    );
    await assert.rejects(
      () =>
        approveOffer(
          admin.id,
          tour.id,
          "Fixture reviewed offer authority",
          "stale",
        ),
      /changed/,
    );
    await approveOffer(
      admin.id,
      tour.id,
      "Fixture approved scope, rates, supplier and media rights",
      offerContentHash(full),
    );
    assert.equal(
      (await db.tour.findUniqueOrThrow({ where: { id: tour.id } })).isPublished,
      true,
    );
    const booking = await db.booking.create({
      data: {
        reference: `LOCAL-${randomUUID()}`,
        customerId: customer.id,
        providerId: provider.id,
        serviceType: "VEHICLE",
        resourceId: randomUUID(),
        startDate: new Date("2028-01-01"),
        endDate: new Date("2028-01-02"),
        subtotalMinor: 10000,
        totalMinor: 10000,
        status: "COMPLETED",
      },
    });
    bookings.push(booking.id);
    const policy = {
      version: oldPolicy?.version ?? -1,
      supportHours: "Local fixture weekday hours Kigali UTC+2",
      escalation: "Local fixture use the approved support contact",
      emergencyNotice:
        "Local fixture contact local emergency assistance for immediate danger",
      documentPurpose: "Local fixture necessary licence verification only",
      documentDays: 7,
      documentsEnabled: true,
      evidence: "Local fixture retention and necessity approval",
    };
    await assert.rejects(() => savePolicy(sales.id, policy), /Administrator/);
    await savePolicy(admin.id, policy);
    const document = await db.bookingDocument.create({
      data: {
        bookingId: booking.id,
        kind: "DRIVING_LICENCE",
        contentType: "application/pdf",
        fileName: "fixture.pdf",
        size: 8,
        data: Buffer.from("%PDF-1.7"),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    assert.ok(await readPrivateDocument(customer.id, document.id));
    assert.ok(await readPrivateDocument(providerUser.id, document.id));
    assert.ok(await readPrivateDocument(admin.id, document.id));
    assert.equal(await readPrivateDocument(outsider.id, document.id), null);
    await db.user.update({
      where: { id: providerUser.id },
      data: { role: "CUSTOMER" },
    });
    assert.equal(await readPrivateDocument(providerUser.id, document.id), null);
    await db.user.update({
      where: { id: customer.id },
      data: { isActive: false },
    });
    assert.equal(await readPrivateDocument(customer.id, document.id), null);
    await db.user.update({
      where: { id: customer.id },
      data: { isActive: true },
    });
    await db.bookingDocument.update({
      where: { id: document.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    assert.equal(await readPrivateDocument(admin.id, document.id), null);
    assert.equal(
      await db.operationsAudit.count({
        where: { entityId: document.id, action: "DOCUMENT_READ" },
      }),
      3,
    );
    await deleteRetainedDocument(
      admin.id,
      document.id,
      "Expired fixture deletion under approved retention",
    );
    assert.equal(
      await db.bookingDocument.count({ where: { id: document.id } }),
      0,
    );
    const report = await operationsReport(ops);
    assert.equal(
      report.rows.some((r) => r.id === a.id),
      true,
    );
    assert.equal(
      report.rows.some((r) => r.id === b.id),
      false,
    );
    const output = await reportCsv(ops, "operations");
    assert.ok(output.includes(a.reference));
    assert.ok(!output.includes(b.reference));
    assert.ok(!output.includes(customer.email));
    assert.ok(!output.includes("Private itinerary"));
    await assert.rejects(() => reportCsv(sales, "finance"), /denied/);
    await db.user.update({
      where: { id: finance.id },
      data: { staffRole: "SALES" },
    });
    await assert.rejects(() => reportCsv(finance, "finance"), /denied/);
    console.log(
      "PASS: service approval and hidden-capture enforcement; support ownership, concurrency, idempotency, resolution and revocation; stale offer approval; scoped document access, expiry, audit and deletion; fresh scoped reports and contact-free exports. No messages or money moved.",
    );
  } finally {
    await db.supportActivity.deleteMany({ where: { caseId: { in: cases } } });
    await db.supportCase.deleteMany({ where: { id: { in: cases } } });
    await removeEnquiryFixtures(leads);
    await db.bookingDocument.deleteMany({
      where: { bookingId: { in: bookings } },
    });
    await db.booking.deleteMany({ where: { id: { in: bookings } } });
    await db.tour.deleteMany({ where: { id: { in: tours } } });
    await db.provider.deleteMany({ where: { id: { in: providers } } });
    await db.operationsAudit.deleteMany({ where: { actorId: { in: users } } });
    if (oldPublication)
      await db.servicePublication.upsert({
        where: { service: "FLIGHT" },
        create: oldPublication,
        update: oldPublication,
      });
    else
      await db.servicePublication.deleteMany({ where: { service: "FLIGHT" } });
    if (oldPolicy)
      await db.operationsPolicy.upsert({
        where: { id: 1 },
        create: oldPolicy,
        update: oldPolicy,
      });
    else await db.operationsPolicy.deleteMany({ where: { id: 1 } });
    await db.user.deleteMany({ where: { id: { in: users } } });
  }
}
main()
  .finally(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
