import { createHash, randomUUID } from "node:crypto";
import type { CollectionAttempt, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { lockFinance } from "@/lib/finance-registry";
import { canFinance, referenceKey } from "@/lib/finance-rules";
import { notifyPaymentReceived } from "@/lib/notifications";
import { lockBooking, providerTarget } from "./checkout";
import { CollectionError, OPEN_COLLECTIONS } from "./rules";
import { getUrubutoProvider } from "./urubuto";

const delay = (milliseconds: number) => new Date(Date.now() + milliseconds);
const monitored = OPEN_COLLECTIONS.filter((status) => status !== "DISPUTED");

export async function reconcileCollection(reference: string, early = false) {
  const gateway = getUrubutoProvider()?.provider;
  if (!gateway) return;
  const attempt = await db.collectionAttempt.findFirst({
    where: {
      merchantReference: reference, environment: gateway.environment, provider: gateway.id,
      merchantCode: gateway.merchantCode, serviceCode: gateway.serviceCode, status: { in: [...monitored, "FAILED"] },
    },
    include: { invoice: true },
  });
  if (!attempt) return;
  const claimed = await db.collectionAttempt.updateMany({
    where: { id: attempt.id, nextCheckAt: early ? attempt.nextCheckAt : { lte: new Date() }, status: attempt.status },
    data: { nextCheckAt: delay(30_000) },
  });
  if (!claimed.count) return;
  let observation;
  try {
    observation = await gateway.verifyPayment(providerTarget(attempt));
  } catch {
    await db.collectionAttempt.updateMany({
      where: { id: attempt.id, status: { in: monitored } },
      data: { nextCheckAt: delay(180_000), ...(attempt.expiresAt <= new Date() ? { status: "RECONCILIATION_REQUIRED" } : {}) },
    });
    return;
  }
  const receipt = await db.$transaction(async (tx) => {
    if (attempt.invoice.bookingId) await lockBooking(tx, attempt.invoice.bookingId);
    else await lockFinance(tx);
    const current = await tx.collectionAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    if (!monitored.includes(current.status) && current.status !== "FAILED") return null;
    const providerRef = "providerReference" in observation ? observation.providerReference : undefined;
    const duplicate = providerRef && await tx.collectionAttempt.findFirst({
      where: {
        provider: current.provider, environment: current.environment, merchantCode: current.merchantCode,
        providerReference: providerRef, id: { not: current.id },
      }, select: { id: true },
    });
    const mismatch = observation.state === "mismatch" || !!duplicate ||
      !!(providerRef && current.providerReference && providerRef !== current.providerReference);
    const stage = mismatch ? "mismatch" : observation.state;
    if (current.status === "FAILED" && stage !== "paid") return null;
    if (current.status === "CREATED" && (stage === "pending" || stage === "missing") && current.expiresAt > new Date()) return null;
    const status = current.status === "FAILED" ? "DISPUTED"
      : stage === "paid" ? "SUCCESSFUL"
      : stage === "failed" ? "FAILED"
      : mismatch || current.expiresAt <= new Date() ? "RECONCILIATION_REQUIRED"
      : current.hostedUrl ? "REQUIRES_ACTION" : "PENDING";
    await saveEvent(tx, current, "STATUS_CHECK", status, `${status}/${stage}`);
    await tx.collectionAttempt.update({
      where: { id: current.id },
      data: {
        status,
        ...(!mismatch && providerRef ? { providerReference: providerRef } : {}),
        ...(status === "SUCCESSFUL" ? { verifiedAt: new Date() } : {}),
        nextCheckAt: delay(status === "RECONCILIATION_REQUIRED" ? 900_000 : 45_000),
      },
    });
    if (status !== "SUCCESSFUL" || !attempt.invoice.bookingId) return null;
    return postBookingReceipt(tx, current, attempt.invoice.bookingId);
  });
  if (receipt) {
    await notifyPaymentReceived(receipt.bookingId, receipt.amountMinor, {
      paidMinor: receipt.paidMinor, totalMinor: receipt.totalMinor,
    });
  }
}

export async function saveEvent(
  tx: Prisma.TransactionClient, attempt: CollectionAttempt, kind: string, result: string, key: string,
) {
  return tx.collectionEvent.createMany({
    data: { attemptId: attempt.id, dedupeKey: createHash("sha256").update(`${attempt.id}/${kind}/${key}`).digest("hex"), kind, result },
    skipDuplicates: true,
  });
}

async function postBookingReceipt(tx: Prisma.TransactionClient, attempt: CollectionAttempt, bookingId: string) {
  const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const total = await tx.payment.aggregate({
    where: { bookingId, status: "SUCCEEDED", currency: booking.currency }, _sum: { amountMinor: true },
  });
  const paidMinor = (total._sum.amountMinor ?? 0) + attempt.amountMinor;
  await tx.payment.create({
    data: {
      bookingId, gateway: attempt.provider, idempotencyKey: attempt.merchantReference,
      transactionId: `UPG:${attempt.merchantReference}`, amountMinor: attempt.amountMinor,
      currency: attempt.currency, status: "SUCCEEDED", paidAt: new Date(),
      method: attempt.method === "MOMO" ? "MTN_MOMO" : attempt.method === "AIRTEL_MONEY" ? "AIRTEL_MONEY" : "CARD",
    },
  });
  if (booking.currency !== attempt.currency || paidMinor > booking.totalMinor || ["REJECTED", "CANCELLED", "COMPLETED"].includes(booking.status)) {
    await tx.collectionAttempt.update({ where: { id: attempt.id }, data: { settlementStatus: "REVIEW" } });
    await saveEvent(tx, attempt, "BOOKING_REVIEW", "Verify booking and payment allocation", booking.status);
    return null;
  }
  if (paidMinor === booking.totalMinor) {
    await tx.booking.updateMany({
      where: { id: bookingId, status: { in: ["PENDING", "AWAITING_PAYMENT"] } }, data: { status: "PAID" },
    });
  }
  return { bookingId, amountMinor: attempt.amountMinor, paidMinor, totalMinor: booking.totalMinor };
}

export async function reconcileDueCollections() {
  const provider = getUrubutoProvider()?.provider;
  if (!provider) return 0;
  const attempts = await db.collectionAttempt.findMany({
    where: {
      provider: provider.id, environment: provider.environment, merchantCode: provider.merchantCode,
      serviceCode: provider.serviceCode, status: { in: monitored }, nextCheckAt: { lte: new Date() },
    },
    orderBy: { nextCheckAt: "asc" },
    take: 18,
    select: { merchantReference: true },
  });
  for (let start = 0; start < attempts.length; start += 6) {
    const batch = attempts.slice(start, start + 6);
    const results = await Promise.allSettled(batch.map((attempt) => reconcileCollection(attempt.merchantReference)));
    for (const result of results) if (result.status === "rejected") console.warn("[collections] reconciliation write failed");
  }
  return attempts.length;
}

export async function recordCollectionSettlement(actorId: string, input: {
  attemptId: string; accountId: string; statementRef: string; netMinor: number; feeMinor: number; evidence: string; creditedAt: Date;
}) {
  await db.$transaction(async (tx) => {
    await lockFinance(tx);
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor || !canFinance(actor)) throw new CollectionError("Finance access is required.");
    const attempt = await tx.collectionAttempt.findUnique({
      where: { id: input.attemptId }, include: { invoice: { include: { financialCase: true } } },
    });
    const account = await tx.settlementAccount.findUnique({ where: { id: input.accountId } });
    if (!attempt || attempt.status !== "SUCCESSFUL" || !attempt.verifiedAt || attempt.settledAt || attempt.settlementStatus === "REVIEW") {
      throw new CollectionError("Choose an independently verified collection awaiting settlement.");
    }
    if (!account?.active || account.method !== "BANK_TRANSFER" || account.currency !== attempt.currency) {
      throw new CollectionError("Choose an active approved bank account in the payment currency.");
    }
    if (![input.netMinor, input.feeMinor].every((amount) => Number.isSafeInteger(amount) && amount >= 0) || !input.netMinor ||
      input.netMinor + input.feeMinor !== attempt.amountMinor || input.evidence.trim().length < 10) {
      throw new CollectionError("The statement credit plus the provider fee must equal the verified gross collection.");
    }
    const key = referenceKey(input.statementRef);
    if (await tx.settlementProof.count({ where: { accountId: account.id, referenceKey: key } })) {
      throw new CollectionError("This statement reference is already in the finance ledger.");
    }
    const financialCase = attempt.invoice.financialCase;
    if (financialCase) {
      const operation = await tx.financialOperation.create({
        data: {
          caseId: financialCase.id, actorId, intentKey: randomUUID(), inputHash: attempt.merchantReference,
          action: "GATEWAY_SETTLEMENT", evidence: input.evidence, changes: { reference: attempt.merchantReference, statementRef: key },
        },
      });
      const proof = await tx.settlementProof.create({
        data: {
          caseId: financialCase.id, accountId: account.id, referenceKey: key, externalRef: input.statementRef,
          amountMinor: input.netMinor, currency: attempt.currency, kind: "GATEWAY_SETTLEMENT", partyKey: attempt.id, occurredAt: input.creditedAt,
        },
      });
      const base = { caseId: financialCase.id, operationId: operation.id, proofId: proof.id };
      await tx.financialEntry.createMany({
        data: [
          { ...base, kind: "RECEIPT", amountMinor: attempt.amountMinor },
          ...(input.feeMinor ? [{ ...base, kind: "PAYMENT_CHARGE", amountMinor: input.feeMinor }] : []),
        ],
      });
      await tx.financialCase.update({ where: { id: financialCase.id }, data: { reviewed: false, reviewEvidence: null } });
      await tx.enquiry.update({ where: { id: financialCase.enquiryId }, data: { version: { increment: 1 } } });
    }
    const result = await tx.collectionAttempt.updateMany({
      where: { id: attempt.id, status: "SUCCESSFUL", settledAt: null },
      data: {
        settledAt: input.creditedAt, settledById: actorId, feeMinor: input.feeMinor, settlementStatus: "SETTLED",
        settlementReference: `${account.id}:${key}`, settlementEvidence: input.evidence,
      },
    });
    if (!result.count) throw new CollectionError("This collection changed. Refresh the register.");
    await saveEvent(tx, attempt, "FINANCE_RECONCILED", "SETTLED", key);
  });
}
