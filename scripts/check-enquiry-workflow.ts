import { removeEnquiryFixtures } from "./enquiry-test-cleanup";
import { issueQuote, recordQuoteAcceptance } from "../src/lib/quotes";
import { quoteInputSchema, acceptanceSchema } from "../src/lib/quote-rules";
/** Local-only Phase 2 database integration tests; removes only its own fixtures. */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { saveEnquiry } from "../src/lib/flight-enquiries";
import { updateEnquiry } from "../src/lib/enquiry-triage";
import { enquiryScope, triageSchema } from "../src/lib/enquiry-workflow";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "54329" ||
    url.pathname !== "/thrill_rwanda" ||
    process.env.NODE_ENV === "production"
  )
    throw new Error(
      "Only the project-local development database is permitted.",
    );
  const token = randomUUID();
  const userIds: string[] = [];
  const leadIds: string[] = [];
  const user = async (
    staffRole: "SALES" | "OPERATIONS" | "FINANCE" | null,
    role: "ADMIN" | "CUSTOMER" = "CUSTOMER",
  ) => {
    const row = await db.user.create({
      data: {
        email: `${randomUUID()}@example.invalid`,
        fullName: "Workflow integration fixture",
        staffRole,
        role,
      },
    });
    userIds.push(row.id);
    return row;
  };
  try {
    const admin = await user(null, "ADMIN"),
      sales = await user("SALES"),
      otherSales = await user("SALES"),
      finance = await user("FINANCE"),
      customer = await user(null);
    const paymentsBefore = await db.payment.count(),
      bookingsBefore = await db.booking.count();
    const saved = await saveEnquiry(
      {
        submissionKey: token,
        name: "Workflow guest",
        email: `${token}@example.invalid`,
        phone: "",
        replyChannel: "EMAIL",
        service: "GROUP",
        source: "PHONE",
        consentVersion: "staff-recorded-v1",
        consentText: "Customer gave permission during the phone call.",
        details: {
          organization: "Test group",
          message: "Travel planning request",
        },
      },
      admin.id,
    );
    const lead = await db.enquiry.findUniqueOrThrow({
      where: { reference: saved.reference },
    });
    leadIds.push(lead.id);
    assert.equal(
      await db.enquiryActivity.count({ where: { enquiryId: lead.id } }),
      1,
    );
    const update = async (
      actorId: string,
      patch: Record<string, unknown> = {},
    ) => {
      const row = await db.enquiry.findUniqueOrThrow({
        where: { id: lead.id },
      });
      return updateEnquiry(
        actorId,
        triageSchema.parse({
          reference: row.reference,
          version: row.version,
          status: row.status,
          ...patch,
        }),
      );
    };
    await assert.rejects(
      () => update(customer.id, { ownerId: customer.id }),
      /access/,
    );
    await update(sales.id, {
      ownerId: sales.id,
      status: "CONTACTED",
      note: "First contact completed",
    });
    assert.ok(
      (await db.enquiry.findUniqueOrThrow({ where: { id: lead.id } }))
        .firstResponseAt,
    );
    await assert.rejects(
      () => update(otherSales.id, { ownerId: otherSales.id }),
      /not found/,
    );
    assert.equal(
      await db.enquiry.count({
        where: { AND: [enquiryScope(otherSales), { id: lead.id }] },
      }),
      0,
    );
    const snapshot = await db.enquiry.findUniqueOrThrow({
      where: { id: lead.id },
    });
    const results = await Promise.allSettled(
      ["Note one", "Note two"].map((note) =>
        updateEnquiry(
          sales.id,
          triageSchema.parse({
            reference: snapshot.reference,
            version: snapshot.version,
            status: snapshot.status,
            ownerId: sales.id,
            note,
          }),
        ),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    await assert.rejects(
      () =>
        update(sales.id, { ownerId: sales.id, status: "NEEDS_INFORMATION" }),
      /follow-up/,
    );
    await update(sales.id, {
      ownerId: sales.id,
      status: "NEEDS_INFORMATION",
      followUp: "2028-01-01T10:30",
    });
    const quotationRow = await db.enquiry.findUniqueOrThrow({
      where: { id: lead.id },
    });
    const quoteId = await issueQuote(
      sales.id,
      quoteInputSchema.parse({
        reference: saved.reference,
        enquiryVersion: quotationRow.version,
        intentKey: randomUUID(),
        currency: "USD",
        serviceDescription: "External checked service quotation",
        travelSummary: "Travel plan in January 2028",
        supplierConditions: "Supplier conditions and baggage checked",
        taxTreatment: "Taxes included as stated",
        terms:
          "Customer must approve the checked supplier change and refund terms.",
        expiresAt: "2090-01-02T12:00",
        paymentDeadline: "2090-01-02T12:00",
        lines: [
          {
            kind: "SUPPLIER",
            description: "Supplier service",
            quantity: 1,
            unitPrice: "100",
          },
          {
            kind: "SERVICE_FEE",
            description: "Service fee",
            quantity: 1,
            unitPrice: "10",
          },
        ],
        internalNotes: "",
        checked: true,
        sendEmail: false,
      }),
      {
        name: "Test company",
        email: "test@example.invalid",
        phone: "",
        address: "Local test",
      },
    );
    const acceptRow = await db.enquiry.findUniqueOrThrow({
      where: { id: lead.id },
    });
    await recordQuoteAcceptance(
      sales.id,
      acceptanceSchema.parse({
        reference: saved.reference,
        quoteId,
        enquiryVersion: acceptRow.version,
        customerName: "Workflow guest",
        channel: "EMAIL",
        evidence: "Customer accepted exact written quotation version one",
        verified: true,
      }),
    );
    await assert.rejects(
      () =>
        update(sales.id, {
          ownerId: sales.id,
          status: "PARTNER_PROCESSING",
          evidence: "Invalid sales payment approval",
        }),
      /not permitted/,
    );
    await assert.rejects(
      () =>
        update(finance.id, {
          status: "PARTNER_PROCESSING",
          ownerId: sales.id,
          evidence: "Receipt reconciled externally",
        }),
      /Finance/,
    );
    await update(finance.id, {
      status: "PARTNER_PROCESSING",
      evidence: "Approved external reconciliation R-01 checked by finance",
    });
    await update(admin.id, {
      status: "CONFIRMED",
      evidence: "Supplier confirmation S-01 checked by operations",
    });
    await update(admin.id, {
      status: "COMPLETED",
      evidence: "Service delivered and completion checked with customer",
    });
    const countBefore = await db.enquiryActivity.count({
      where: { enquiryId: lead.id },
    });
    await db.user.update({
      where: { id: sales.id },
      data: { staffRole: null },
    });
    await assert.rejects(
      () => update(sales.id, { note: "Revoked access attempt" }),
      /access/,
    );
    assert.equal(
      await db.enquiryActivity.count({ where: { enquiryId: lead.id } }),
      countBefore,
    );
    assert.equal(await db.payment.count(), paymentsBefore);
    assert.equal(await db.booking.count(), bookingsBefore);
    console.log(
      "PASS: offline capture audit, permission scopes, claim/ownership, atomic concurrent edits, follow-up, milestone evidence, finance restrictions, access revocation, immutable prior activity and no booking/payment effects.",
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
