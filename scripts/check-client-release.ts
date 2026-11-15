import { quoteContentHash } from "../src/lib/quote-render";
import type { QuoteSnapshot } from "../src/lib/quote-rules";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { saveEnquiry } from "../src/lib/flight-enquiries";
import { updateEnquiry } from "../src/lib/enquiry-triage";
import { triageSchema } from "../src/lib/enquiry-workflow";
import { issueQuote } from "../src/lib/quotes";
import { quoteInputSchema } from "../src/lib/quote-rules";
import {
  linkClient,
  clientCases,
  clientQuoteHistory,
  readClientQuote,
  readClientCase,
  acceptClientQuote,
  requestClientSupport,
  saveCorporateAccess,
} from "../src/lib/client-portal";
import {
  saveWhatsAppConsent,
  enqueueWhatsAppStatus,
} from "../src/lib/whatsapp";
import { processNotificationBatch } from "../src/lib/notification-worker";
import {
  saveReleaseRecord,
  setDocumentHold,
  recordSupplierReview,
} from "../src/lib/release-operations";
import { savePolicy } from "../src/lib/operations";
import { purgeExpiredDocuments } from "../src/lib/maintenance";
import { removeEnquiryFixtures } from "./enquiry-test-cleanup";
async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "54329" ||
    url.pathname !== "/thrill_rwanda" ||
    process.env.NODE_ENV === "production"
  )
    throw new Error("Project-local nonproduction DB only");
  const users: string[] = [],
    leads: string[] = [],
    companies: string[] = [],
    providers: string[] = [],
    bookings: string[] = [],
    suppliers: string[] = [],
    docs: string[] = [];
  const oldPolicy = await db.operationsPolicy.findUnique({ where: { id: 1 } });
  const previousEnv = process.env.APP_ENV,
    previousDelete = process.env.MAINTENANCE_DELETE_APPROVED;
  process.env.APP_ENV = "test";
  const oldRecord = await db.releaseRecord.findUnique({
    where: { environment_key: { environment: "test", key: "FOUNDER_SIGNOFF" } },
  });
  const user = async (
    role: "ADMIN" | "CUSTOMER" | "PROVIDER",
    staffRole: "SALES" | "OPERATIONS" | "FINANCE" | null = null,
  ) => {
    const u = await db.user.create({
      data: {
        email: `${randomUUID()}@example.invalid`,
        fullName: "Client release fixture",
        role,
        staffRole,
      },
    });
    users.push(u.id);
    return u;
  };
  try {
    const admin = await user("ADMIN"),
      sales = await user("CUSTOMER", "SALES"),
      ops = await user("CUSTOMER", "OPERATIONS"),
      finance = await user("CUSTOMER", "FINANCE"),
      customer = await user("CUSTOMER"),
      member = await user("CUSTOMER"),
      outsider = await user("CUSTOMER"),
      providerUser = await user("PROVIDER");
    const saved = await saveEnquiry({
      submissionKey: randomUUID(),
      name: "Client release traveller",
      phone: "+250788000000",
      email: customer.email,
      replyChannel: "PHONE",
      service: "TRIP",
      source: "WEBSITE",
      details: { location: "Private customer itinerary fixture" },
    });
    const lead = await db.enquiry.findUniqueOrThrow({
      where: { reference: saved.reference },
    });
    leads.push(lead.id);
    await updateEnquiry(
      admin.id,
      triageSchema.parse({
        reference: lead.reference,
        version: lead.version,
        status: "CONTACTED",
        ownerId: sales.id,
      }),
    );
    assert.equal(
      (await clientCases(customer.id)).length,
      0,
      "Matching email must not auto-link cases",
    );
    const grant = {
      reference: lead.reference,
      email: customer.email,
      active: true,
      canAccept: false,
      version: -1,
      evidence:
        "Verified identity, established contact channel and explicit portal consent fixture",
    };
    await assert.rejects(() => linkClient(finance.id, grant), /denied/);
    await linkClient(sales.id, grant);
    assert.ok(await readClientCase(customer.id, lead.reference));
    assert.equal(await readClientCase(outsider.id, lead.reference), null);
    const consent = {
      reference: lead.reference,
      version: -1,
      phone: lead.phone,
      active: true,
      evidence:
        "Verified customer opted into reference/status WhatsApp templates at test time",
    };
    await saveWhatsAppConsent(sales.id, consent);
    const e = await db.enquiry.findUniqueOrThrow({ where: { id: lead.id } });
    const quoteId = await issueQuote(
      admin.id,
      quoteInputSchema.parse({
        reference: lead.reference,
        enquiryVersion: e.version,
        intentKey: randomUUID(),
        currency: "USD",
        serviceDescription: "Checked local test travel service",
        travelSummary: "Rwanda itinerary fixture",
        supplierConditions: "Verified supplier conditions and limitations",
        taxTreatment: "Tax treatment stated in fixture",
        terms:
          "Approved local test payment, change, cancellation and refund conditions",
        expiresAt: "2038-01-01T12:00",
        paymentDeadline: "2038-01-01T10:00",
        lines: [
          {
            kind: "SUPPLIER",
            description: "Checked supplier service",
            quantity: 1,
            unitPrice: "90",
          },
          {
            kind: "SERVICE_FEE",
            description: "Travel desk service fee",
            quantity: 1,
            unitPrice: "10",
          },
        ],
        internalNotes: "Private supplier net cost secret",
        checked: true,
        sendEmail: false,
      }),
      {
        name: "Fixture business",
        email: "desk@example.invalid",
        phone: "",
        address: "Rwanda",
      },
    );
    const q = await db.quoteVersion.findUniqueOrThrow({
      where: { id: quoteId },
    });
    const caseBefore = await db.enquiry.findUniqueOrThrow({
      where: { id: lead.id },
    });
    const acceptance = {
      reference: lead.reference,
      quoteId,
      contentHash: q.contentHash,
      expectedVersion: caseBefore.version,
      signedName: "Client release traveller",
      checked: true,
    };
    await assert.rejects(
      () => acceptClientQuote(customer.id, acceptance),
      /denied/,
    );
    await linkClient(sales.id, { ...grant, version: 0, canAccept: true });
    assert.ok(
      !JSON.stringify(
        await readClientCase(customer.id, lead.reference),
      ).includes("Private supplier net cost secret"),
    );
    const wa = await db.notificationJob.findFirstOrThrow({
      where: { enquiryId: lead.id, channel: "WHATSAPP" },
    });
    let sends = 0;
    const send = async () => {
      sends++;
      return { providerId: "mock-wa" };
    };
    await processNotificationBatch({
      ids: [wa.id],
      limit: 1,
      whatsappConfigured: false,
      sendWhatsApp: send,
    });
    assert.equal(sends, 0);
    assert.equal(
      (await db.notificationJob.findUniqueOrThrow({ where: { id: wa.id } }))
        .status,
      "BLOCKED",
    );
    await db.notificationJob.update({
      where: { id: wa.id },
      data: { status: "PENDING", nextAttemptAt: new Date(0) },
    });
    await processNotificationBatch({
      ids: [wa.id],
      limit: 1,
      whatsappConfigured: true,
      sendWhatsApp: send,
    });
    assert.equal(sends, 1);
    const accepted = await Promise.all([
      acceptClientQuote(customer.id, acceptance),
      acceptClientQuote(customer.id, acceptance),
    ]);
    assert.equal(accepted[0], accepted[1]);
    assert.equal(
      await db.quoteAcceptance.count({ where: { enquiryId: lead.id } }),
      1,
    );
    await assert.rejects(
      () =>
        acceptClientQuote(customer.id, {
          ...acceptance,
          signedName: "Changed signature",
        }),
      /already/,
    );
    const pending = await db.notificationJob.findFirstOrThrow({
      where: { enquiryId: lead.id, channel: "WHATSAPP", status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    await processNotificationBatch({
      ids: [pending.id],
      limit: 1,
      whatsappConfigured: true,
      sendWhatsApp: async () => {
        sends++;
        throw new Error("uncertain network");
      },
    });
    await db.notificationJob.update({
      where: { id: pending.id },
      data: { status: "PENDING", nextAttemptAt: new Date(0) },
    });
    await processNotificationBatch({
      ids: [pending.id],
      limit: 1,
      whatsappConfigured: true,
      sendWhatsApp: send,
    });
    assert.equal(
      sends,
      2,
      "Uncertain WhatsApp send cannot be retried automatically",
    );
    const support = {
      reference: lead.reference,
      intentKey: randomUUID(),
      category: "CHANGE",
      message: "Please review a checked change request fixture",
    };
    const supportRef = await requestClientSupport(customer.id, support);
    assert.equal(await requestClientSupport(customer.id, support), supportRef);
    const companyId = randomUUID();
    companies.push(companyId);
    const corporate = {
      kind: "ACCOUNT",
      id: companyId,
      version: -1,
      name: "Verified fixture company",
      active: true,
      evidence: "Verified company owner and permitted sharing consent fixture",
    };
    await saveCorporateAccess(admin.id, corporate);
    await saveCorporateAccess(admin.id, {
      ...corporate,
      kind: "MEMBER",
      email: member.email,
    });
    await saveCorporateAccess(admin.id, {
      ...corporate,
      kind: "CASE",
      reference: lead.reference,
    });
    assert.ok(await readClientCase(member.id, lead.reference));
    await assert.rejects(
      () => acceptClientQuote(member.id, acceptance),
      /denied/,
    );
    await saveCorporateAccess(admin.id, {
      ...corporate,
      kind: "MEMBER",
      email: member.email,
      version: 0,
      active: false,
    });
    assert.equal(await readClientCase(member.id, lead.reference), null);
    await linkClient(sales.id, { ...grant, version: 1, active: false });
    assert.equal(await readClientCase(customer.id, lead.reference), null);
    await assert.rejects(
      () =>
        requestClientSupport(customer.id, {
          ...support,
          intentKey: randomUUID(),
        }),
      /unavailable/,
    );
    await saveWhatsAppConsent(sales.id, {
      ...consent,
      version: 0,
      active: false,
    });
    await db.$transaction((tx) => enqueueWhatsAppStatus(tx, lead.id));
    assert.equal(
      await db.notificationJob.count({
        where: { enquiryId: lead.id, channel: "WHATSAPP", status: "PENDING" },
      }),
      0,
    );
    const supplier = await db.supplier.create({
      data: {
        name: "Review fixture supplier",
        category: "TOUR",
        contact: "Fixture contact",
        escalation: "Fixture escalation",
        agreementEvidence: "Fixture supplier agreement authority",
        serviceArea: "Rwanda",
        deliverables: "Checked service",
        limitations: "Written scope",
        commercialTerms: "Private rates",
        currencies: ["USD"],
        status: "APPROVED",
      },
    });
    suppliers.push(supplier.id);
    const fin = await db.financialCase.create({
      data: {
        enquiryId: lead.id,
        quoteId,
        currency: "USD",
        customerChargeMinor: 10000,
        serviceFeeMinor: 1000,
        taxReserveMinor: 0,
        requiredFundingMinor: 10000,
      },
    });
    await db.supplierCommitment.create({
      data: {
        caseId: fin.id,
        supplierId: supplier.id,
        label: "Checked service",
        referenceKey: "FIXTURE-COMMIT",
        contractRef: "Fixture contract",
        costMinor: 9000,
        evidence: "Verified fixture supplier commitment",
      },
    });
    const review = {
      reference: lead.reference,
      supplierId: supplier.id,
      intentKey: randomUUID(),
      score: 4,
      outcome: "DELIVERED",
      action: "Review documented service performance and next steps",
      evidence:
        "Verified supplier delivery evidence and performance review fixture",
      reviewAt: "2038-01-01T10:00",
    };
    await assert.rejects(
      () => recordSupplierReview(finance.id, review),
      /denied/,
    );
    await assert.rejects(
      () => recordSupplierReview(ops.id, review),
      /own case/,
    );
    assert.equal(
      await recordSupplierReview(admin.id, review),
      await recordSupplierReview(admin.id, review),
    );
    const provider = await db.provider.create({
      data: {
        userId: providerUser.id,
        businessName: "Retention fixture provider",
        slug: `release-${randomUUID()}`,
        kind: "CAR",
        status: "VERIFIED",
      },
    });
    providers.push(provider.id);
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
    await savePolicy(admin.id, {
      version: oldPolicy?.version ?? -1,
      supportHours: "Fixture hours Kigali UTC+2",
      escalation: "Fixture escalation process and contact",
      emergencyNotice: "Fixture emergency support guidance",
      documentPurpose: "Necessary licence verification fixture",
      documentDays: 7,
      documentsEnabled: true,
      evidence: "Approved local test retention policy fixture",
    });
    for (const kind of ["DRIVING_LICENCE", "ID_DOCUMENT"] as const) {
      const d = await db.bookingDocument.create({
        data: {
          bookingId: booking.id,
          kind,
          fileName: "fixture.pdf",
          contentType: "application/pdf",
          size: 8,
          data: Buffer.from("%PDF-1.7"),
          expiresAt: new Date(0),
        },
      });
      docs.push(d.id);
    }
    await setDocumentHold(admin.id, {
      id: docs[1],
      mode: "HOLD",
      evidence: "Verified local legal hold authority fixture",
    });
    assert.equal((await purgeExpiredDocuments(false, docs)).expired, 1);
    process.env.MAINTENANCE_DELETE_APPROVED = "true";
    assert.equal((await purgeExpiredDocuments(true, docs)).deleted, 1);
    assert.equal(await db.bookingDocument.count({ where: { id: docs[1] } }), 1);
    await setDocumentHold(admin.id, {
      id: docs[1],
      mode: "RELEASE",
      evidence: "Verified local release of legal hold authority fixture",
    });
    assert.equal((await purgeExpiredDocuments(true, docs)).deleted, 1);
    await saveReleaseRecord(admin.id, {
      key: "FOUNDER_SIGNOFF",
      version: oldRecord?.version ?? -1,
      owner: "Local test owner",
      state: "PENDING",
      evidence: "Fixture only; no business approval established",
      reviewAt: "2038-01-01T10:00",
      cost: "10",
      currency: "USD",
      renewalAt: "2038-01-01T10:00",
    });
    await assert.rejects(
      () =>
        saveReleaseRecord(sales.id, {
          key: "FOUNDER_SIGNOFF",
          version: 0,
          owner: "Unauthorized owner",
          state: "VERIFIED",
          evidence: "Unauthorized fixture approval attempt",
          reviewAt: "2038-01-01T10:00",
        }),
      /Administrator/,
    );
    const historySaved = await saveEnquiry({
      submissionKey: randomUUID(),
      name: "History fixture traveller",
      phone: "+250788000088",
      email: customer.email,
      replyChannel: "PHONE",
      service: "TRIP",
      source: "WEBSITE",
      details: { location: "History fixture" },
    });
    const historyLead = await db.enquiry.findUniqueOrThrow({
      where: { reference: historySaved.reference },
    });
    leads.push(historyLead.id);
    await db.enquiry.update({
      where: { id: historyLead.id },
      data: { status: "QUOTE_SENT", ownerId: sales.id },
    });
    for (let number = 1; number <= 11; number++) {
      const snapshot = {
        ...(q.snapshot as unknown as QuoteSnapshot),
        reference: historyLead.reference,
        version: number,
      };
      await db.quoteVersion.create({
        data: {
          enquiryId: historyLead.id,
          number,
          intentKey: randomUUID(),
          inputHash: q.inputHash,
          contentHash: quoteContentHash(snapshot),
          snapshot,
          currency: q.currency,
          totalMinor: q.totalMinor,
          expiresAt: q.expiresAt,
          paymentDeadline: q.paymentDeadline,
          createdById: admin.id,
        },
      });
    }
    await linkClient(admin.id, {
      ...grant,
      reference: historyLead.reference,
      version: -1,
      active: true,
      canAccept: false,
    });
    assert.equal(
      (await clientQuoteHistory(customer.id, historyLead.reference, 0, 10))
        .length,
      10,
    );
    const historical = (
      await clientQuoteHistory(customer.id, historyLead.reference, 10, 10)
    )[0];
    assert.equal(historical.number, 1);
    assert.ok(
      await readClientQuote(customer.id, historyLead.reference, historical.id),
    );
    assert.equal(
      await readClientQuote(outsider.id, historyLead.reference, historical.id),
      null,
    );
    console.log(
      "PASS: explicit client/corporate grants, no email auto-link, exact-version concurrent acceptance, private-cost redaction, support retries, revocation, approved-only mocked WhatsApp and uncertain-send blocking, supplier reviews, legal holds, scoped retention and release evidence. No external messages or money moved.",
    );
  } finally {
    await removeEnquiryFixtures(leads);
    await db.corporateMember.deleteMany({
      where: { accountId: { in: companies } },
    });
    await db.corporateCaseAccess.deleteMany({
      where: { accountId: { in: companies } },
    });
    await db.corporateAccount.deleteMany({ where: { id: { in: companies } } });
    await db.bookingDocument.deleteMany({
      where: { bookingId: { in: bookings } },
    });
    await db.booking.deleteMany({ where: { id: { in: bookings } } });
    await db.provider.deleteMany({ where: { id: { in: providers } } });
    await db.supplier.deleteMany({ where: { id: { in: suppliers } } });
    await db.operationsAudit.deleteMany({
      where: { OR: [{ actorId: { in: users } }, { entityId: { in: docs } }] },
    });
    if (oldPolicy)
      await db.operationsPolicy.upsert({
        where: { id: 1 },
        create: oldPolicy,
        update: oldPolicy,
      });
    else await db.operationsPolicy.deleteMany({ where: { id: 1 } });
    if (oldRecord)
      await db.releaseRecord.upsert({
        where: {
          environment_key: { environment: "test", key: "FOUNDER_SIGNOFF" },
        },
        create: oldRecord,
        update: oldRecord,
      });
    else
      await db.releaseRecord.deleteMany({
        where: { environment: "test", key: "FOUNDER_SIGNOFF" },
      });
    await db.user.deleteMany({ where: { id: { in: users } } });
    if (previousEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = previousEnv;
    if (previousDelete === undefined)
      delete process.env.MAINTENANCE_DELETE_APPROVED;
    else process.env.MAINTENANCE_DELETE_APPROVED = previousDelete;
  }
}
main()
  .finally(() => db.$disconnect())
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
