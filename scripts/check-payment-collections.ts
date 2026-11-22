/** Exercises the real Prisma transactions and route handlers against a disposable local database. */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Pool } from "pg";
import type { QuoteSnapshot } from "../src/lib/quote-rules";

async function main() {
  const root = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(["127.0.0.1", "localhost"].includes(root.hostname) && root.port === "54329" &&
    root.pathname === "/thrill_rwanda" && !root.searchParams.has("host") && process.env.NODE_ENV !== "production",
  "Start the project-local PostgreSQL instance before running this test.");
  const dbName = `thrill_payment_test_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: root.href });
  const local = new URL(root.href);
  local.pathname = `/${dbName}`;
  let created = false;
  let disconnect: (() => Promise<void>) | undefined;
  try {
    await adminPool.query(`CREATE DATABASE "${dbName}"`);
    created = true;
    Object.assign(process.env, {
      DATABASE_URL: local.href, DIRECT_URL: local.href, APP_ENV: "test", VERCEL_ENV: "",
      PAYMENT_PUBLIC_ORIGIN: "https://payments.example.invalid", RESEND_API_KEY: "",
      URUBUTOPAY_ENABLED: "true", URUBUTOPAY_ENVIRONMENT: "staging",
      URUBUTOPAY_API_KEY: "upg:test_fixture", URUBUTOPAY_MERCHANT_CODE: "merchant", URUBUTOPAY_SERVICE_CODE: "service",
      URUBUTOPAY_APPROVED_METHODS: "MOMO,AIRTEL_MONEY,CARD", URUBUTOPAY_MIN_RWF: "5", URUBUTOPAY_MAX_RWF: "1000000",
      URUBUTOPAY_WEBHOOK_USERNAME: "fixture", URUBUTOPAY_WEBHOOK_PASSWORD: "fixture-independent-password",
      URUBUTOPAY_WEBHOOK_SECRET: "fixture-callback-signing-key-and-test-only",
    });
    const migration = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { encoding: "utf8", env: process.env });
    assert.equal(migration.status, 0, migration.stderr || "Could not migrate the disposable database.");
    const { db } = await import("../src/lib/db");
    disconnect = () => db.$disconnect();
    const { beginCollection, collectionCheckout, issuePaymentLink, revokePaymentLink, prepareBookingInvoice } = await import("../src/lib/collections/checkout");
    const { reconcileCollection, recordCollectionSettlement } = await import("../src/lib/collections/reconcile");
    const { paymentPdfResponse } = await import("../src/lib/collections/documents");
    const { saveEnquiry } = await import("../src/lib/flight-enquiries");
    const { quoteContentHash } = await import("../src/lib/quote-render");
    const { cancelBooking } = await import("../src/lib/booking");
    const { POST: authenticate } = await import("../src/app/api/payments/urubutopay/auth/route");
    const { POST: callback } = await import("../src/app/api/payments/urubutopay/callback/route");

    const requests = new Map<string, { amount: number; method: string; outcome: string }>();
    let failNext = false;
    globalThis.fetch = async (resource, init) => {
      const url = new URL(String(resource));
      assert.equal(url.origin, "https://staging.urubutopay.rw", "Unexpected outbound request");
      assert.equal(new Headers(init?.headers).get("authorization"), "upg:test_fixture");
      const input = JSON.parse(String(init?.body));
      const merchantReference = input.transaction_id as string;
      if (url.pathname.endsWith("/payment/initiate")) {
        if (failNext) { failNext = false; throw new Error("Fixture timeout"); }
        assert.ok(!requests.has(merchantReference), "Attempt initiated twice");
        requests.set(merchantReference, { amount: input.amount, method: input.channel_name, outcome: "PENDING" });
        return Response.json({ status: 200, data: {
          internal_transaction_ref_number: `fixture-${merchantReference}`, external_transaction_ref_number: merchantReference, currency: "RWF",
          card_processing_url: `https://staging.urubutopay.rw/card/process/${merchantReference}`,
        } });
      }
      assert.ok(url.pathname.endsWith("/transaction/status"));
      const sent = requests.get(merchantReference);
      if (!sent) return new Response(null, { status: 404 });
      return Response.json({ status: 200, data: {
        transaction_status: sent.outcome, transaction_id: merchantReference, payer_code: merchantReference,
        internal_transaction_id: `fixture-${merchantReference}`, merchant_code: "merchant", service_code: "service",
        currency: "RWF", amount: sent.amount, payment_channel: sent.method === "CARD" ? "CARD" : "WALLET", payment_channel_name: sent.method,
      } });
    };

    await db.paymentRoutingPolicy.create({ data: {
      environment: "staging", enabled: true, methods: ["MOMO", "AIRTEL_MONEY", "CARD"],
      minMinor: 5, maxMinor: 1000000, evidence: "Isolated integration fixture", feeTerms: "",
    } });
    const finance = await db.user.create({ data: { email: "finance@example.invalid", fullName: "Fixture Finance", staffRole: "FINANCE" } });
    const guest = await db.user.create({ data: { email: "guest@example.invalid", fullName: "Fixture Guest" } });
    const bank = await db.settlementAccount.create({ data: {
      code: "RWF-BANK", name: "Fixture Bank", currency: "RWF", method: "BANK_TRANSFER",
      instructions: "Fixture account instructions", approvalEvidence: "Isolated integration fixture",
    } });
    const makeQuote = async () => {
      const saved = await saveEnquiry({
        submissionKey: randomUUID(), name: "Guest booking", phone: "", email: `${randomUUID()}@example.invalid`,
        replyChannel: "EMAIL", service: "EVENT", source: "WEBSITE", details: {},
      });
      const row = await db.enquiry.update({ where: { reference: saved.reference }, data: { status: "AWAITING_PAYMENT" } });
      const deadline = new Date(Date.now() + 86400000);
      const snapshot: QuoteSnapshot = {
        reference: row.reference, version: 1, customerName: row.name, preparedBy: finance.fullName,
        company: { name: "Thrill fixture", email: "desk@example.invalid", phone: "", address: "Kigali" },
        issuedAt: new Date().toISOString(), expiresAt: deadline.toISOString(), paymentDeadline: deadline.toISOString(),
        serviceDescription: "Meeting package", travelSummary: "Kigali meeting room",
        supplierConditions: "Subject to desk confirmation", taxTreatment: "Included where applicable", terms: "Fixture terms",
        items: [
          { kind: "SUPPLIER", description: "Venue hire", quantity: 1, unitMinor: 84000, totalMinor: 84000 },
          { kind: "SERVICE_FEE", description: "Coordination", quantity: 1, unitMinor: 16000, totalMinor: 16000 },
        ], totalMinor: 100000, currency: "RWF",
      };
      const quote = await db.quoteVersion.create({ data: {
        enquiryId: row.id, number: 1, intentKey: randomUUID(), inputHash: "fixture", contentHash: quoteContentHash(snapshot),
        snapshot, totalMinor: 100000, currency: "RWF", expiresAt: deadline, paymentDeadline: deadline, createdById: finance.id,
      } });
      await db.quoteAcceptance.create({ data: {
        enquiryId: row.id, quoteId: quote.id, customerName: row.name, channel: "EMAIL", evidence: "Verified fixture acceptance", actorId: finance.id,
      } });
      return row;
    };
    const payment = { email: "payer@example.invalid", phone: "0788123456" };
    const quote = await makeQuote();
    await assert.rejects(issuePaymentLink(guest.id, quote.reference, 2, 30000), /Finance access/);
    const first = new URL(await issuePaymentLink(finance.id, quote.reference, 2, 30000)).pathname.split("/").at(-1)!;
    const token = new URL(await issuePaymentLink(finance.id, quote.reference, 2)).pathname.split("/").at(-1)!;
    assert.equal(await collectionCheckout({ token: first }), null);
    assert.equal((await collectionCheckout({ token }))?.amountMinor, 30000);
    await assert.rejects(beginCollection({ token }, { ...payment, method: "MOMO", expectedMinor: 1 }), /amount due changed/);
    await Promise.all(Array.from({ length: 5 }, () => beginCollection({ token }, { ...payment, method: "MOMO", expectedMinor: 30000 })));
    assert.equal(requests.size, 1);
    assert.equal(await db.collectionAttempt.count(), 1);
    const deposit = (await collectionCheckout({ token }))!.attempt!;
    assert.equal(deposit.status, "REQUIRES_ACTION");

    const endpoint = "https://payments.example.invalid/api/payments/urubutopay/";
    const request = (path: string, payload: object, authorization?: string) => new Request(endpoint + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: authorization } : {}) },
      body: JSON.stringify(payload),
    });
    const auth = await authenticate(request("auth", { user_name: "fixture", password: process.env.URUBUTOPAY_WEBHOOK_PASSWORD }));
    assert.equal(auth.status, 200);
    const jwt = (await auth.json()).data.token;
    const provider = requests.get(deposit.reference)!;
    const event = {
      callback_type: "PAYMENT", merchant_code: "merchant", transaction_id: deposit.reference, payer_code: deposit.reference,
      internal_transaction_id: `fixture-${deposit.reference}`, transaction_status: "SUCCESSFUL",
    };
    assert.equal((await callback(request("callback", event))).status, 401);
    provider.outcome = "PENDING";
    assert.equal((await callback(request("callback", event, jwt))).status, 200);
    assert.equal((await callback(request("callback", event, jwt))).status, 200);
    assert.equal((await collectionCheckout({ token }))!.paidMinor, 0);
    provider.outcome = "VALID";
    provider.amount = 30001;
    await reconcileCollection(deposit.reference, true);
    assert.equal((await collectionCheckout({ token }))!.attempt!.status, "RECONCILIATION_REQUIRED");
    provider.amount = 30000;
    await Promise.all(Array.from({ length: 3 }, () => reconcileCollection(deposit.reference, true)));
    const verified = (await collectionCheckout({ token }))!;
    assert.equal(verified.paidMinor, 30000);
    assert.equal(verified.amountMinor, 70000);
    assert.equal(await db.collectionEvent.count({ where: { kind: "WEBHOOK" } }), 1);
    assert.equal(await db.collectionEvent.count({ where: { kind: "STATUS_CHECK", result: "SUCCESSFUL" } }), 1);
    provider.outcome = "FAILED";
    assert.equal((await callback(request("callback", { ...event, transaction_status: "FAILED" }, jwt))).status, 200);
    assert.equal((await collectionCheckout({ token }))!.paidMinor, 30000);
    assert.equal((await db.enquiry.findUniqueOrThrow({ where: { id: quote.id } })).status, "AWAITING_PAYMENT");
    const issuer = { name: "Thrill test fixture", email: "desk@example.invalid" };
    const receipt = await paymentPdfResponse({ token }, issuer, deposit.reference);
    assert.equal(receipt.headers.get("Content-Type"), "application/pdf");
    assert.equal(Buffer.from(await receipt.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
    const saved = await db.collectionAttempt.findUniqueOrThrow({ where: { merchantReference: deposit.reference } });
    const settlement = {
      attemptId: saved.id, accountId: bank.id, statementRef: "KGL-FIXTURE-01", feeMinor: 200, netMinor: 29800,
      creditedAt: new Date(), evidence: "Matched independent fixture statement",
    };
    await assert.rejects(recordCollectionSettlement(finance.id, { ...settlement, feeMinor: 201 }), /must equal/);
    await recordCollectionSettlement(finance.id, settlement);
    await assert.rejects(recordCollectionSettlement(finance.id, settlement), /awaiting settlement/);
    assert.equal((await collectionCheckout({ token }))!.paidMinor, 30000);
    assert.equal((await db.financialEntry.aggregate({ where: { kind: "RECEIPT" }, _sum: { amountMinor: true } }))._sum.amountMinor, 30000);
    console.log("PASS: accepted quote, finance scope, rotated links, concurrent deposit, authenticated callback, mismatch, receipt and settlement");

    failNext = true;
    await beginCollection({ token }, { ...payment, method: "CARD", expectedMinor: 70000 });
    const uncertain = (await collectionCheckout({ token }))!.attempt!;
    await db.collectionAttempt.update({ where: { merchantReference: uncertain.reference }, data: { expiresAt: new Date(0) } });
    await reconcileCollection(uncertain.reference, true);
    assert.equal((await collectionCheckout({ token }))!.attempt!.status, "RECONCILIATION_REQUIRED");
    await beginCollection({ token }, { ...payment, method: "MOMO", expectedMinor: 70000 });
    assert.equal(await db.collectionAttempt.count(), 2);
    await revokePaymentLink(finance.id, quote.reference);
    assert.equal((await paymentPdfResponse({ token }, issuer, deposit.reference)).status, 404);
    console.log("PASS: expired ambiguous card blocks a replacement and revocation disables guest access");

    const offsite = await makeQuote();
    const bankToken = new URL(await issuePaymentLink(finance.id, offsite.reference, 2)).pathname.split("/").at(-1)!;
    await db.financialCase.update({ where: { enquiryId: offsite.id }, data: { instructions: "[RWF-BANK] Use the approved bank transfer instructions" } });
    const bankOnly = (await collectionCheckout({ token: bankToken }))!;
    assert.equal(bankOnly.bank?.name, bank.name);
    assert.deepEqual(bankOnly.methods, []);
    await assert.rejects(beginCollection({ token: bankToken }, { ...payment, method: "MOMO", expectedMinor: 100000 }), /off-site/);

    const operator = await db.provider.create({ data: { userId: finance.id, businessName: "Test operator", slug: "test-operator", status: "VERIFIED" } });
    const booking = await db.booking.create({ data: {
      reference: "TOUR-FIXTURE", customerId: guest.id, providerId: operator.id, serviceType: "TOUR",
      resourceId: randomUUID(), startDate: new Date(Date.now() + 8 * 86400000), endDate: new Date(Date.now() + 9 * 86400000),
      currency: "RWF", subtotalMinor: 20000, totalMinor: 20000, status: "AWAITING_PAYMENT",
      details: { depositPercent: 50, terms: { acceptedAt: new Date().toISOString() } },
    } });
    assert.equal(await prepareBookingInvoice(booking.reference, finance.id), false);
    assert.equal(await prepareBookingInvoice(booking.reference, guest.id), true);
    const access = { bookingReference: booking.reference, customerId: guest.id };
    await beginCollection(access, { ...payment, method: "AIRTEL_MONEY", expectedMinor: 10000 });
    await assert.rejects(cancelBooking({ reference: booking.reference, customerId: guest.id }), /still being checked/);
    const bookingAttempt = (await collectionCheckout(access))!.attempt!;
    requests.get(bookingAttempt.reference)!.outcome = "PENDING_SETTLEMENT";
    await reconcileCollection(bookingAttempt.reference, true);
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status, "AWAITING_PAYMENT");
    await assert.rejects(cancelBooking({ reference: booking.reference, customerId: guest.id }), /payment is already recorded/);
    await beginCollection(access, { ...payment, method: "CARD", expectedMinor: 10000 });
    const balance = (await collectionCheckout(access))!.attempt!;
    assert.match(balance.hostedUrl ?? "", /^https:\/\/staging\.urubutopay\.rw\/card\/process\//);
    requests.get(balance.reference)!.outcome = "VALID";
    await reconcileCollection(balance.reference, true);
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status, "PAID");
    assert.equal(await db.payment.count({ where: { bookingId: booking.id, gateway: "URUBUTOPAY", status: "SUCCEEDED" } }), 2);
    assert.equal(await collectionCheckout({ ...access, customerId: finance.id }), null);
    console.log("PASS: direct booking ownership, inventory cancellation guard and verified payment without supplier confirmation");
  } finally {
    await disconnect?.();
    if (created) await adminPool.query(`DROP DATABASE "${dbName}" WITH (FORCE)`);
    await adminPool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
