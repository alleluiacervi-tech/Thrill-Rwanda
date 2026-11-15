/** Guarded project-local integration tests. No bank/gateway/supplier network calls. */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { saveEnquiry } from "../src/lib/flight-enquiries";
import { updateEnquiry } from "../src/lib/enquiry-triage";
import { triageSchema } from "../src/lib/enquiry-workflow";
import { issueQuote, recordQuoteAcceptance } from "../src/lib/quotes";
import { quoteInputSchema, acceptanceSchema } from "../src/lib/quote-rules";
import { executeFinanceCommand, financeInclude } from "../src/lib/finance";
import {
  createSettlementAccount,
  saveSupplier,
  changeAccountStatus,
} from "../src/lib/finance-registry";
import {
  financeCommandSchema,
  financialSummary,
  commitmentBalance,
  refundBalance,
  supplierSchema,
  type FinanceCommand,
} from "../src/lib/finance-rules";
import { removeEnquiryFixtures } from "./enquiry-test-cleanup";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "54329" ||
    url.pathname !== "/thrill_rwanda" ||
    process.env.NODE_ENV === "production"
  )
    throw new Error("Project-local database only.");
  const users: string[] = [],
    leads: string[] = [],
    accounts: string[] = [],
    suppliers: string[] = [],
    bookings: string[] = [],
    providers: string[] = [];
  const user = async (
    role: "ADMIN" | "CUSTOMER",
    staffRole: "SALES" | "OPERATIONS" | "FINANCE" | null = null,
  ) => {
    const u = await db.user.create({
      data: {
        email: `${randomUUID()}@example.invalid`,
        fullName: "Finance integration fixture",
        role,
        staffRole,
      },
    });
    users.push(u.id);
    return u;
  };
  try {
    const admin = await user("ADMIN"),
      finance = await user("CUSTOMER", "FINANCE"),
      ops = await user("CUSTOMER", "OPERATIONS"),
      sales = await user("CUSTOMER", "SALES"),
      customer = await user("CUSTOMER");
    const accountInput = (currency: string) => ({
      intentKey: randomUUID(),
      code: `LOCAL-${randomUUID()}`,
      name: "Local test company account",
      method: "BANK_TRANSFER",
      currency,
      instructions:
        "Approved fixture payment instructions; no real bank account",
      approvalEvidence: "Company approval test evidence only",
      verified: true,
    });
    await assert.rejects(
      () => createSettlementAccount(finance.id, accountInput("USD")),
      /administrators/,
    );
    const usd = await createSettlementAccount(admin.id, accountInput("USD"));
    accounts.push(usd);
    const rwf = await createSettlementAccount(admin.id, accountInput("RWF"));
    accounts.push(rwf);
    const supplierInput = supplierSchema.parse({
      intentKey: randomUUID(),
      name: "Local supplier fixture",
      category: "TOUR",
      contact: "desk@example.invalid",
      escalation: "urgent@example.invalid",
      serviceArea: "Rwanda test area",
      deliverables: "Checked tour fulfilment services",
      limitations: "Only approved fixture scope",
      commercialTerms:
        "Verified net supplier cost; separate external commissions are not already netted",
      currencies: ["USD", "RWF"],
      agreementEvidence: "Written authorization and contract fixture",
      status: "APPROVED",
      publicationAllowed: false,
      verified: true,
    });
    await assert.rejects(
      () => saveSupplier(ops.id, supplierInput),
      /administrators/,
    );
    const supplier = await saveSupplier(admin.id, supplierInput);
    suppliers.push(supplier);
    const providerUser = await user("CUSTOMER");
    const provider = await db.provider.create({
      data: {
        userId: providerUser.id,
        businessName: "Legacy fixture provider",
        slug: `finance-${randomUUID()}`,
        kind: "TOUR",
        status: "VERIFIED",
      },
    });
    providers.push(provider.id);
    for (const paid of [false, true]) {
      const b = await db.booking.create({
        data: {
          reference: `LOCAL-${randomUUID()}`,
          customerId: customer.id,
          providerId: provider.id,
          serviceType: "TOUR",
          resourceId: randomUUID(),
          startDate: new Date("2028-01-01"),
          endDate: new Date("2028-01-02"),
          subtotalMinor: 100000,
          totalMinor: 100000,
          status: "COMPLETED",
        },
      });
      bookings.push(b.id);
      if (paid)
        await db.payment.create({
          data: {
            bookingId: b.id,
            idempotencyKey: randomUUID(),
            amountMinor: 100000,
            currency: "USD",
            method: "CARD",
            status: "SUCCEEDED",
          },
        });
    }
    const baseline = {
      bookings: await db.booking.count(),
      payments: await db.payment.count(),
    };
    const lead = async (currency = "USD", ownerId = ops.id) => {
      const saved = await saveEnquiry({
        submissionKey: randomUUID(),
        name: "Finance case guest",
        phone: "",
        email: customer.email,
        replyChannel: "EMAIL",
        service: "TRIP",
        source: "WEBSITE",
        details: {
          location: "Private route should not reach finance",
          message: "Test trip request",
        },
      });
      const e = await db.enquiry.findUniqueOrThrow({
        where: { reference: saved.reference },
      });
      leads.push(e.id);
      await updateEnquiry(
        admin.id,
        triageSchema.parse({
          reference: e.reference,
          version: e.version,
          status: "CONTACTED",
          ownerId,
        }),
      );
      const current = await db.enquiry.findUniqueOrThrow({
        where: { id: e.id },
      });
      const quoteId = await issueQuote(
        admin.id,
        quoteInputSchema.parse({
          reference: e.reference,
          enquiryVersion: current.version,
          intentKey: randomUUID(),
          currency,
          serviceDescription: "Checked travel service quotation",
          travelSummary: "Rwanda trip January 2028",
          supplierConditions: "Approved supplier conditions and baggage rules",
          taxTreatment: "Supplier tax included as stated",
          terms:
            "Approved payment, change, cancellation and refund terms for fixture only.",
          expiresAt: "2038-01-01T12:00",
          paymentDeadline: "2038-01-01T10:00",
          lines: [
            {
              kind: "SUPPLIER",
              description: "Supplier service",
              quantity: 1,
              unitPrice: "900",
            },
            {
              kind: "SERVICE_FEE",
              description: "Service fee",
              quantity: 1,
              unitPrice: "100",
            },
          ],
          checked: true,
          sendEmail: false,
        }),
        {
          name: "Local test company",
          email: "desk@example.invalid",
          phone: "",
          address: "Rwanda local test",
        },
      );
      const v = await db.enquiry.findUniqueOrThrow({ where: { id: e.id } });
      await recordQuoteAcceptance(
        admin.id,
        acceptanceSchema.parse({
          reference: e.reference,
          enquiryVersion: v.version,
          quoteId,
          customerName: "Finance case guest",
          channel: "EMAIL",
          evidence: "Verified exact-version acceptance fixture",
          verified: true,
        }),
      );
      return e;
    };
    const make = async (
      e: { id: string; reference: string },
      action: FinanceCommand["action"],
      fields: Partial<FinanceCommand> = {},
    ) =>
      financeCommandSchema.parse({
        reference: e.reference,
        expectedVersion: (
          await db.enquiry.findUniqueOrThrow({ where: { id: e.id } })
        ).version,
        action,
        intentKey: randomUUID(),
        currency: "USD",
        evidence:
          "Verified supporting statement/contract and company approval fixture",
        verified: true,
        ...fields,
      });
    const run = async (
      actorId: string,
      e: { id: string; reference: string },
      action: FinanceCommand["action"],
      fields: Partial<FinanceCommand> = {},
    ) => executeFinanceCommand(actorId, await make(e, action, fields));
    const data = (e: { id: string }) =>
      db.financialCase.findUniqueOrThrow({
        where: { enquiryId: e.id },
        include: financeInclude,
      });
    const a = await lead(),
      b = await lead(),
      c = await lead("USD", sales.id),
      d = await lead();
    await assert.rejects(
      () => run(customer.id, a, "INSTRUCTIONS", { accountId: usd }),
      /access denied|not found/,
    );
    await assert.rejects(
      () =>
        run(ops.id, a, "RECORD_RECEIPT", {
          accountId: usd,
          externalRef: "BAD",
          amount: "10",
          payer: "Test payer",
        }),
      /role/,
    );
    await run(finance.id, a, "INSTRUCTIONS", { accountId: usd });
    const receiptCommand = await make(a, "RECORD_RECEIPT", {
      accountId: usd,
      externalRef: "SHARED-001",
      amount: "1000",
      secondaryAmount: "300",
      payer: "Bank statement payer",
    });
    await executeFinanceCommand(finance.id, receiptCommand);
    await executeFinanceCommand(finance.id, receiptCommand);
    assert.equal((await data(a)).entries.length, 0);
    await assert.rejects(
      () =>
        executeFinanceCommand(finance.id, { ...receiptCommand, amount: "999" }),
      /already used/,
    );
    const sharedProof = await db.settlementProof.findUniqueOrThrow({
      where: {
        accountId_referenceKey: { accountId: usd, referenceKey: "SHARED-001" },
      },
    });
    const receipt = await db.offsiteReceipt.findUniqueOrThrow({
      where: { proofId: sharedProof.id },
    });
    await run(finance.id, a, "RECONCILE_RECEIPT", { targetId: receipt.id });
    assert.equal(financialSummary(await data(a)).collections, 30000);
    await assert.rejects(
      () => run(finance.id, a, "RECONCILE_RECEIPT", { targetId: receipt.id }),
      /pending/,
    );
    await run(finance.id, b, "ALLOCATE_RECEIPT", {
      targetId: receipt.id,
      amount: "600",
    });
    assert.equal(financialSummary(await data(b)).collections, 60000);
    const race = await Promise.allSettled([
      make(c, "ALLOCATE_RECEIPT", { targetId: receipt.id, amount: "80" }).then(
        (input) => executeFinanceCommand(finance.id, input),
      ),
      make(d, "ALLOCATE_RECEIPT", { targetId: receipt.id, amount: "80" }).then(
        (input) => executeFinanceCommand(finance.id, input),
      ),
    ]);
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      (
        await db.receiptAllocation.aggregate({
          where: { receiptId: receipt.id, status: "ACTIVE" },
          _sum: { amountMinor: true },
        })
      )._sum.amountMinor,
      98000,
    );
    await run(finance.id, c, "INSTRUCTIONS", { accountId: usd });
    await assert.rejects(
      () => run(sales.id, c, "RECONCILE_RECEIPT", { targetId: receipt.id }),
      /role/,
    );
    await assert.rejects(
      () =>
        run(finance.id, c, "RECORD_RECEIPT", {
          accountId: usd,
          externalRef: " shared-001 ",
          amount: "5",
          payer: "Other payer",
        }),
      /already recorded/,
    );
    await run(finance.id, a, "COMMIT_SUPPLIER", {
      supplierId: supplier,
      label: "Complete tour service cost",
      externalRef: "SUP-COST-A",
      amount: "600",
    });
    const commitment = (await data(a)).commitments[0];
    await assert.rejects(
      () => run(finance.id, a, "RELEASE_PROCESSING"),
      /reviewed/,
    );
    await run(finance.id, a, "PAYMENT_CHARGE", {
      accountId: usd,
      externalRef: "BANK-FEE-A",
      amount: "10",
    });
    await run(finance.id, a, "COMMISSION", {
      accountId: usd,
      externalRef: "EXT-COMMISSION-A",
      amount: "20",
    });
    await run(finance.id, a, "REVIEW", {
      amount: "1000",
      feeAmount: "100",
      taxAmount: "0",
      thresholdAmount: "300",
    });
    assert.equal(financialSummary(await data(a)).contribution, 41000);
    await run(finance.id, a, "RELEASE_PROCESSING");
    await assert.rejects(
      () =>
        run(ops.id, a, "CONFIRM_SERVICE", {
          targetId: commitment.id,
          externalRef: "SUP-CONF-A",
        }),
      /every contracted/,
    );
    const oldSupplier = await db.supplier.findUniqueOrThrow({
      where: { id: supplier },
    });
    await saveSupplier(
      admin.id,
      supplierSchema.parse({
        ...oldSupplier,
        nextReviewAt: "",
        intentKey: randomUUID(),
        status: "SUSPENDED",
        verified: true,
      }),
    );
    await assert.rejects(
      () =>
        run(ops.id, a, "CONFIRM_SUPPLIER", {
          targetId: commitment.id,
          externalRef: "SUP-CONF-A",
        }),
      /approved/,
    );
    const suspended = await db.supplier.findUniqueOrThrow({
      where: { id: supplier },
    });
    await saveSupplier(
      admin.id,
      supplierSchema.parse({
        ...suspended,
        nextReviewAt: "",
        intentKey: randomUUID(),
        status: "APPROVED",
        verified: true,
      }),
    );
    await run(ops.id, a, "CONFIRM_SUPPLIER", {
      targetId: commitment.id,
      externalRef: "SUP-CONF-A",
    });
    await run(ops.id, a, "CONFIRM_SERVICE", {
      targetId: commitment.id,
      externalRef: "SUP-CONF-A",
    });
    await run(ops.id, a, "COMPLETE_SERVICE");
    await assert.rejects(
      async () =>
        run(admin.id, a, "LINK_BOOKING", {
          bookingRef: (
            await db.booking.findUniqueOrThrow({ where: { id: bookings[1] } })
          ).reference,
        }),
      /matching completed/,
    );
    await run(admin.id, a, "LINK_BOOKING", {
      bookingRef: (
        await db.booking.findUniqueOrThrow({ where: { id: bookings[0] } })
      ).reference,
    });
    await run(finance.id, a, "SUPPLIER_PAYMENT", {
      targetId: commitment.id,
      accountId: usd,
      externalRef: "SUP-PAID-A",
      amount: "600",
    });
    await assert.rejects(
      () =>
        run(finance.id, a, "SUPPLIER_PAYMENT", {
          targetId: commitment.id,
          accountId: usd,
          externalRef: "OVERPAY",
          amount: "1",
        }),
      /exceeds/,
    );
    await run(finance.id, a, "RECORD_RECEIPT", {
      accountId: usd,
      externalRef: "BALANCE-A",
      amount: "700",
      payer: "Bank statement payer",
    });
    const accountState = await db.settlementAccount.findUniqueOrThrow({
      where: { id: usd },
    });
    await changeAccountStatus(
      admin.id,
      usd,
      accountState.version,
      false,
      "Temporary approval suspension fixture",
    );
    await assert.rejects(
      () =>
        run(finance.id, a, "RECORD_RECEIPT", {
          accountId: usd,
          externalRef: "DISABLED",
          amount: "1",
          payer: "Test payer",
        }),
      /approved|active/,
    );
    await changeAccountStatus(
      admin.id,
      usd,
      accountState.version + 1,
      true,
      "Renewed account approval fixture",
    );
    const balanceProof = await db.settlementProof.findUniqueOrThrow({
      where: {
        accountId_referenceKey: { accountId: usd, referenceKey: "BALANCE-A" },
      },
    });
    const balanceReceipt = await db.offsiteReceipt.findUniqueOrThrow({
      where: { proofId: balanceProof.id },
    });
    await run(finance.id, a, "RECONCILE_RECEIPT", {
      targetId: balanceReceipt.id,
    });
    await run(finance.id, a, "REVIEW", {
      amount: "900",
      feeAmount: "80",
      taxAmount: "0",
      thresholdAmount: "0",
    });
    await run(finance.id, a, "APPROVE_REFUND", {
      externalRef: "REFUND-A",
      label: "Agreed service concession",
      amount: "100",
    });
    const refund = (await data(a)).refunds[0];
    await run(finance.id, a, "AMEND_REFUND", {
      targetId: refund.id,
      amount: "90",
      externalRef: "ADJUST-REFUND-A1",
    });
    assert.equal(financialSummary(await data(a)).refundDue, 9000);
    await run(finance.id, a, "AMEND_REFUND", {
      targetId: refund.id,
      amount: "100",
      externalRef: "ADJUST-REFUND-A2",
    });
    await run(finance.id, a, "SETTLE_REFUND", {
      targetId: refund.id,
      accountId: usd,
      externalRef: "REFUND-PAID-A1",
      amount: "40",
    });
    assert.equal(financialSummary(await data(a)).refundDue, 6000);
    await assert.rejects(
      () =>
        run(finance.id, a, "SETTLE_REFUND", {
          targetId: refund.id,
          accountId: usd,
          externalRef: "OVER-REFUND",
          amount: "61",
        }),
      /exceeds/,
    );
    await run(finance.id, a, "SETTLE_REFUND", {
      targetId: refund.id,
      accountId: usd,
      externalRef: "REFUND-PAID-A2",
      amount: "60",
    });
    const payout = (await data(a)).entries.find(
      (e) => e.kind === "REFUND_SETTLEMENT" && e.amountMinor === 4000,
    )!;
    await run(finance.id, a, "REVERSE_ENTRY", { targetId: payout.id });
    assert.equal(refundBalance(await data(a), refund.id).due, 4000);
    await run(finance.id, a, "SETTLE_REFUND", {
      targetId: refund.id,
      accountId: usd,
      externalRef: "REFUND-PAID-A1",
      amount: "40",
    });
    await run(finance.id, a, "SUPPLIER_CREDIT", {
      targetId: commitment.id,
      externalRef: "SUP-CREDIT-A",
      amount: "200",
    });
    assert.equal(
      commitmentBalance(await data(a), commitment.id).recoveryDue,
      20000,
    );
    await run(finance.id, a, "SUPPLIER_RECOVERY", {
      targetId: commitment.id,
      accountId: usd,
      externalRef: "SUP-RECOVER-A",
      amount: "200",
    });
    const charge = (await data(a)).entries.find(
      (e) => e.kind === "PAYMENT_CHARGE",
    )!;
    await run(finance.id, a, "REVERSE_ENTRY", { targetId: charge.id });
    await run(finance.id, a, "PAYMENT_CHARGE", {
      accountId: usd,
      externalRef: "BANK-FEE-A",
      amount: "8",
    });
    assert.equal(
      (await db.financialEntry.findUniqueOrThrow({ where: { id: charge.id } }))
        .amountMinor,
      1000,
    );
    await run(finance.id, a, "REVIEW", {
      amount: "900",
      feeAmount: "80",
      taxAmount: "0",
      thresholdAmount: "0",
    });
    assert.equal(financialSummary(await data(a)).contribution, 51200);
    await run(finance.id, b, "COMMIT_SUPPLIER", {
      supplierId: supplier,
      label: "Cancellation cost agreement",
      externalRef: "SUP-COST-B",
      amount: "0",
    });
    const beforeCancel = await db.enquiry.findUniqueOrThrow({
      where: { id: b.id },
    });
    await updateEnquiry(
      admin.id,
      triageSchema.parse({
        reference: b.reference,
        version: beforeCancel.version,
        status: "CANCELLED",
        reason: "Customer cancellation confirmed",
      }),
    );
    await run(finance.id, b, "REVIEW", {
      amount: "100",
      feeAmount: "100",
      taxAmount: "0",
      thresholdAmount: "0",
    });
    await run(finance.id, b, "APPROVE_REFUND", {
      externalRef: "REFUND-B",
      amount: "500",
      label: "Approved cancellation refund",
    });
    const refundB = (await data(b)).refunds[0];
    await run(finance.id, b, "SETTLE_REFUND", {
      targetId: refundB.id,
      accountId: usd,
      externalRef: "REFUND-B1",
      amount: "200",
    });
    assert.equal(
      (await db.enquiry.findUniqueOrThrow({ where: { id: b.id } })).status,
      "CANCELLED",
    );
    await run(finance.id, b, "SETTLE_REFUND", {
      targetId: refundB.id,
      accountId: usd,
      externalRef: "REFUND-B2",
      amount: "300",
    });
    assert.equal(
      (await db.enquiry.findUniqueOrThrow({ where: { id: b.id } })).status,
      "REFUNDED",
    );
    await run(finance.id, a, "RECORD_RECEIPT", {
      accountId: usd,
      externalRef: "LATE-SHARED",
      amount: "10",
      secondaryAmount: "0",
      payer: "Late bank payer",
    });
    const late = await db.offsiteReceipt.findFirstOrThrow({
      where: { proof: { accountId: usd, referenceKey: "LATE-SHARED" } },
    });
    await run(finance.id, b, "ALLOCATE_RECEIPT", {
      targetId: late.id,
      amount: "10",
    });
    assert.equal(
      (await db.enquiry.findUniqueOrThrow({ where: { id: b.id } })).status,
      "REFUNDED",
    );
    await run(finance.id, a, "RECONCILE_RECEIPT", { targetId: late.id });
    assert.equal(
      (await db.enquiry.findUniqueOrThrow({ where: { id: b.id } })).status,
      "CANCELLED",
    );
    const r = await lead("RWF");
    await run(finance.id, r, "INSTRUCTIONS", {
      currency: "RWF",
      accountId: rwf,
    });
    await assert.rejects(
      () =>
        run(finance.id, r, "ALLOCATE_RECEIPT", {
          currency: "RWF",
          targetId: receipt.id,
          amount: "1",
        }),
      /same currency/,
    );
    await run(finance.id, r, "RECORD_RECEIPT", {
      currency: "RWF",
      accountId: rwf,
      externalRef: "RWF-RECEIPT",
      amount: "1000",
      payer: "Local payer",
    });
    const rp = await db.settlementProof.findUniqueOrThrow({
      where: {
        accountId_referenceKey: { accountId: rwf, referenceKey: "RWF-RECEIPT" },
      },
    });
    const rr = await db.offsiteReceipt.findUniqueOrThrow({
      where: { proofId: rp.id },
    });
    await run(finance.id, r, "RECONCILE_RECEIPT", {
      currency: "RWF",
      targetId: rr.id,
    });
    assert.equal(financialSummary(await data(r)).collections, 1000);
    await db.user.update({
      where: { id: finance.id },
      data: { staffRole: null },
    });
    await assert.rejects(
      () =>
        run(finance.id, a, "PAYMENT_CHARGE", {
          accountId: usd,
          externalRef: "REVOKED",
          amount: "1",
        }),
      /access denied/,
    );
    assert.equal(await db.booking.count(), baseline.bookings);
    assert.equal(await db.payment.count(), baseline.payments);
    console.log(
      "PASS: approved accounts/suppliers; pending versus reconciled funds; split receipts and concurrent allocation caps; partial funding; all-supplier confirmation; legacy-link safeguards; supplier credits/recoveries; partial refunds and reversals; currency isolation; role revocation; no new bookings/gateway payments or external money movement.",
    );
  } finally {
    await removeEnquiryFixtures(leads);
    await db.payment.deleteMany({ where: { bookingId: { in: bookings } } });
    await db.booking.deleteMany({ where: { id: { in: bookings } } });
    await db.registryAudit.deleteMany({
      where: { entityId: { in: [...accounts, ...suppliers] } },
    });
    await db.supplier.deleteMany({ where: { id: { in: suppliers } } });
    await db.settlementAccount.deleteMany({ where: { id: { in: accounts } } });
    await db.provider.deleteMany({ where: { id: { in: providers } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
  }
}
main()
  .finally(() => db.$disconnect())
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
