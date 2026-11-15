/** Local-only integration checks. Transports are injected: no external messages are sent. */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { saveEnquiry } from "../src/lib/flight-enquiries";
import { updateEnquiry } from "../src/lib/enquiry-triage";
import { triageSchema } from "../src/lib/enquiry-workflow";
import { issueQuote, recordQuoteAcceptance } from "../src/lib/quotes";
import {
  quoteInputSchema,
  acceptanceSchema,
  type QuoteInput,
  type QuoteSnapshot,
} from "../src/lib/quote-rules";
import { quoteContentHash, renderQuoteHtml } from "../src/lib/quote-render";
import {
  NotificationDeliveryError,
  processNotificationBatch,
} from "../src/lib/notification-worker";
import { removeEnquiryFixtures } from "./enquiry-test-cleanup";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "54329" ||
    url.pathname !== "/thrill_rwanda" ||
    process.env.NODE_ENV === "production"
  )
    throw new Error("Only the project-local database is permitted.");
  const userIds: string[] = [],
    leadIds: string[] = [];
  const company = {
    name: "Test company",
    email: "desk@example.invalid",
    phone: "",
    address: "Kigali test",
  };
  const user = async (
    role: "ADMIN" | "CUSTOMER",
    staffRole: "SALES" | "FINANCE" | null = null,
  ) => {
    const row = await db.user.create({
      data: {
        email: `${randomUUID()}@example.invalid`,
        fullName: "Quote integration fixture",
        role,
        staffRole,
      },
    });
    userIds.push(row.id);
    return row;
  };
  try {
    const admin = await user("ADMIN"),
      sales = await user("CUSTOMER", "SALES"),
      finance = await user("CUSTOMER", "FINANCE");
    const before = {
      bookings: await db.booking.count(),
      payments: await db.payment.count(),
    };
    const lead = async () => {
      const saved = await saveEnquiry({
        submissionKey: randomUUID(),
        name: "Quote guest",
        phone: "",
        email: `${randomUUID()}@example.invalid`,
        replyChannel: "EMAIL",
        service: "TRIP",
        source: "WEBSITE",
        details: {
          location: "Private route detail",
          message: "Travel enquiry",
        },
      });
      const row = await db.enquiry.findUniqueOrThrow({
        where: { reference: saved.reference },
      });
      leadIds.push(row.id);
      await updateEnquiry(
        admin.id,
        triageSchema.parse({
          reference: row.reference,
          version: row.version,
          status: "CONTACTED",
          ownerId: sales.id,
        }),
      );
      return db.enquiry.findUniqueOrThrow({ where: { id: row.id } });
    };
    const input = (
      row: { reference: string; version: number },
      changes: Partial<QuoteInput> = {},
    ) =>
      quoteInputSchema.parse({
        reference: row.reference,
        enquiryVersion: row.version,
        intentKey: randomUUID(),
        currency: "USD",
        serviceDescription: "Checked travel assistance",
        travelSummary: "Private route detail, January 2028",
        supplierConditions: "Verified supplier baggage and change conditions",
        taxTreatment: "Applicable supplier taxes included",
        terms:
          "Pay only after accepting these checked change, cancellation and refund terms.",
        expiresAt: "2038-01-02T12:00",
        paymentDeadline: "2038-01-02T10:00",
        lines: [
          {
            kind: "SUPPLIER",
            description: "Supplier fare",
            quantity: 2,
            unitPrice: "100.01",
          },
          {
            kind: "SERVICE_FEE",
            description: "Service fee",
            quantity: 1,
            unitPrice: "10",
          },
        ],
        internalNotes: "INTERNAL_TEST_SECRET",
        checked: true,
        sendEmail: true,
        ...changes,
      });
    const first = await lead();
    const draft = input(first);
    await assert.rejects(
      () => issueQuote(finance.id, draft, company),
      /administrator|assigned/,
    );
    await db.user.update({ where: { id: sales.id }, data: { isActive: false } });
    await assert.rejects(() => issueQuote(admin.id, draft, company), /active administrator/);
    await db.user.update({ where: { id: sales.id }, data: { isActive: true } });
    const id1 = await issueQuote(sales.id, draft, company);
    assert.equal(await issueQuote(sales.id, draft, company), id1);
    await assert.rejects(
      () =>
        issueQuote(
          sales.id,
          { ...draft, terms: "Different sufficiently long quotation terms" },
          company,
        ),
      /already been used/,
    );
    const v1 = await db.quoteVersion.findUniqueOrThrow({ where: { id: id1 } });
    const snapshot1 = JSON.stringify(v1.snapshot);
    assert.equal(v1.totalMinor, 21002);
    assert.equal(
      renderQuoteHtml(v1.snapshot as QuoteSnapshot).includes(
        "INTERNAL_TEST_SECRET",
      ),
      false,
    );
    const fresh = await db.enquiry.findUniqueOrThrow({
      where: { id: first.id },
    });
    const id2 = await issueQuote(
      sales.id,
      input(fresh, { serviceDescription: "Revised checked travel assistance" }),
      { ...company, name: "Updated test company" },
    );
    assert.equal(
      JSON.stringify(
        (await db.quoteVersion.findUniqueOrThrow({ where: { id: id1 } }))
          .snapshot,
      ),
      snapshot1,
    );
    const current = await db.enquiry.findUniqueOrThrow({
      where: { id: first.id },
    });
    const accept = (id: string) =>
      acceptanceSchema.parse({
        reference: first.reference,
        quoteId: id,
        enquiryVersion: current.version,
        customerName: "Quote guest",
        channel: "EMAIL",
        evidence: "Verified written customer acceptance of this exact version",
        verified: true,
      });
    await assert.rejects(
      () => recordQuoteAcceptance(sales.id, accept(id1)),
      /superseded/,
    );
    await assert.rejects(
      () =>
        recordQuoteAcceptance(
          sales.id,
          accept(id2),
          new Date("2038-01-03T00:00:00Z"),
        ),
      /expired/,
    );
    const raced = await Promise.allSettled([
      recordQuoteAcceptance(sales.id, accept(id2)),
      recordQuoteAcceptance(sales.id, accept(id2)),
    ]);
    assert.equal(
      raced.some((result) => result.status === "fulfilled"),
      true,
    );
    assert.equal(
      await db.quoteAcceptance.count({ where: { enquiryId: first.id } }),
      1,
    );
    const recorded = await recordQuoteAcceptance(sales.id, accept(id2));
    assert.equal(
      (
        await db.quoteAcceptance.findUniqueOrThrow({
          where: { enquiryId: first.id },
        })
      ).id,
      recorded,
    );
    await assert.rejects(
      () =>
        recordQuoteAcceptance(sales.id, {
          ...accept(id2),
          customerName: "Different person",
        }),
      /already exists/,
    );
    await assert.rejects(async () =>
      issueQuote(
        sales.id,
        input(await db.enquiry.findUniqueOrThrow({ where: { id: first.id } })),
        company,
      ),
    );
    const ack = await db.notificationJob.findUniqueOrThrow({
      where: { dedupeKey: `${first.id}:ack` },
    });
    const fakeKeys: string[] = [];
    let externalCalls = 0;
    await processNotificationBatch({
      ids: [ack.id],
      send: async (_to, email, key) => {
        externalCalls++;
        fakeKeys.push(key);
        assert.equal(email.html.includes("Private route detail"), false);
        throw new NotificationDeliveryError("PROVIDER_TEMPORARY", true);
      },
    });
    assert.equal(
      (await db.notificationJob.findUniqueOrThrow({ where: { id: ack.id } }))
        .status,
      "FAILED",
    );
    const later = new Date(Date.now() + 120000);
    await processNotificationBatch({
      ids: [ack.id],
      now: later,
      send: async (_to, _email, key) => {
        externalCalls++;
        fakeKeys.push(key);
        return { providerId: "mock-ack" };
      },
    });
    assert.equal(
      (await db.notificationJob.findUniqueOrThrow({ where: { id: ack.id } }))
        .status,
      "SENT",
    );
    assert.equal(externalCalls, 2);
    assert.equal(fakeKeys[0], fakeKeys[1]);
    assert.equal(
      await db.notificationAttempt.count({ where: { jobId: ack.id } }),
      2,
    );
    const staffJob = await db.notificationJob.findFirstOrThrow({
      where: {
        enquiryId: first.id,
        recipientId: admin.id,
        kind: "STAFF_ALERT",
      },
    });
    await Promise.all([
      processNotificationBatch({ ids: [staffJob.id] }),
      processNotificationBatch({ ids: [staffJob.id] }),
    ]);
    assert.equal(
      await db.notification.count({ where: { id: staffJob.id } }),
      1,
    );
    const oldDelivery = await db.notificationJob.findFirstOrThrow({
      where: { quoteId: id1 },
    });
    await processNotificationBatch({
      ids: [oldDelivery.id],
      send: async () => {
        throw new Error("Superseded quotes must never be sent");
      },
    });
    assert.equal(
      (
        await db.notificationJob.findUniqueOrThrow({
          where: { id: oldDelivery.id },
        })
      ).status,
      "CANCELLED",
    );
    const latestDelivery = await db.notificationJob.findFirstOrThrow({
      where: { quoteId: id2 },
    });
    await processNotificationBatch({
      ids: [latestDelivery.id],
      send: async (_to, email) => {
        assert.equal(email.html.includes("INTERNAL_TEST_SECRET"), false);
        assert.equal(email.html.includes("Updated test company"), true);
        return { providerId: "mock-quote" };
      },
    });
    assert.equal(
      (
        await db.notificationJob.findUniqueOrThrow({
          where: { id: latestDelivery.id },
        })
      ).status,
      "SENT",
    );
    const raceLead = await lead();
    const issued = await Promise.allSettled([
      issueQuote(sales.id, input(raceLead, { sendEmail: false }), company),
      issueQuote(sales.id, input(raceLead, { sendEmail: false }), company),
    ]);
    assert.equal(
      issued.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      await db.quoteVersion.count({ where: { enquiryId: raceLead.id } }),
      1,
    );
    const blocked = await db.notificationJob.findUniqueOrThrow({
      where: { dedupeKey: `${raceLead.id}:ack` },
    });
    await processNotificationBatch({
      ids: [blocked.id],
      emailConfigured: false,
      send: async () => {
        throw new Error("No send with absent configuration");
      },
    });
    const configBlocked = await db.notificationJob.findUniqueOrThrow({
      where: { id: blocked.id },
    });
    assert.equal(configBlocked.status, "BLOCKED");
    assert.equal(configBlocked.lastError, "EMAIL_CONFIGURATION_MISSING");
    assert.equal(configBlocked.firstAttemptAt, null);
    await db.notificationJob.update({
      where: { id: blocked.id },
      data: {
        status: "SENDING",
        leaseUntil: new Date(0),
        firstAttemptAt: new Date(Date.now() - 24 * 3600000),
      },
    });
    await processNotificationBatch({
      ids: [blocked.id],
      send: async () => {
        throw new Error(
          "Do not blindly retry uncertain delivery after idempotency window",
        );
      },
    });
    assert.equal(
      (
        await db.notificationJob.findUniqueOrThrow({
          where: { id: blocked.id },
        })
      ).lastError,
      "DELIVERY_REVIEW_REQUIRED",
    );
    const ownerJob = await db.notificationJob.findFirstOrThrow({
      where: { enquiryId: raceLead.id, recipientId: sales.id },
    });
    await db.user.update({
      where: { id: sales.id },
      data: { staffRole: null },
    });
    await processNotificationBatch({ ids: [ownerJob.id] });
    assert.equal(
      (
        await db.notificationJob.findUniqueOrThrow({
          where: { id: ownerJob.id },
        })
      ).status,
      "CANCELLED",
    );
    assert.equal(
      quoteContentHash(v1.snapshot as QuoteSnapshot),
      v1.contentHash,
    );
    assert.equal(await db.booking.count(), before.bookings);
    assert.equal(await db.payment.count(), before.payments);
    console.log(
      "PASS: immutable quote revisions, exact-version acceptance, expiry/supersession, concurrent issuance, delivery retries/idempotency, per-recipient attempts, worker leases, configuration blocks, uncertain-delivery review, revocation and no booking/payment effects. All email transports were mocked.",
    );
  } finally {
    await removeEnquiryFixtures(leadIds);
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  }
}
main()
  .finally(() => db.$disconnect())
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
