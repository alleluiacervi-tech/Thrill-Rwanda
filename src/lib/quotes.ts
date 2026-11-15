import type { Prisma } from "@/generated/prisma/client";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import {
  enquiryScope,
  followUpDate,
  type EnquiryActor,
} from "@/lib/enquiry-workflow";
import {
  quoteTotals,
  quoteInputSchema,
  acceptanceSchema,
  type QuoteInput,
  type AcceptanceInput,
  type QuoteSnapshot,
} from "@/lib/quote-rules";
import { quoteContentHash } from "@/lib/quote-render";
export class QuoteError extends Error {}
export function canWriteQuotes(actor: EnquiryActor, ownerId: string | null) {
  return (
    actor.isActive &&
    (actor.role === "ADMIN" ||
      (actor.staffRole === "SALES" && ownerId === actor.id))
  );
}
async function requireActiveOwner(tx: Prisma.TransactionClient, ownerId: string | null) {
  const owner = ownerId ? await tx.user.findUnique({ where: { id: ownerId }, select: { isActive: true, role: true, staffRole: true } }) : null;
  if (!owner?.isActive || !(owner.role === "ADMIN" || ["SALES", "OPERATIONS"].includes(owner.staffRole ?? ""))) throw new QuoteError("Assign an active administrator, sales or operations owner before issuing or accepting a quote.");
}
export async function issueQuote(
  actorId: string,
  input: QuoteInput,
  company: QuoteSnapshot["company"],
  now = new Date(),
) {
  input = quoteInputSchema.parse(input);
  const inputHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor) throw new QuoteError("Quotation access denied.");
    const row = await tx.enquiry.findFirst({
      where: { reference: input.reference, ...enquiryScope(actor) },
    });
    if (!row || !canWriteQuotes(actor, row.ownerId))
      throw new QuoteError(
        "Only an administrator or the assigned sales owner can issue quotations.",
      );
    const previous = await tx.quoteVersion.findUnique({
      where: { intentKey: input.intentKey },
    });
    if (previous) {
      if (
        previous.enquiryId !== row.id ||
        previous.createdById !== actorId ||
        previous.inputHash !== inputHash
      )
        throw new QuoteError(
          "This form has already been used. Reload before issuing another quote.",
        );
      return previous.id;
    }
    await requireActiveOwner(tx, row.ownerId);
    if (!["CONTACTED", "NEEDS_INFORMATION", "QUOTE_SENT"].includes(row.status))
      throw new QuoteError(
        "Contact the customer before issuing, or resolve the existing workflow stage.",
      );
    if (await tx.quoteAcceptance.findUnique({ where: { enquiryId: row.id } }))
      throw new QuoteError(
        "An accepted quotation cannot be silently replaced. Resolve it through the approved change process.",
      );
    const expiresAt = followUpDate(input.expiresAt)!;
    const paymentDeadline = followUpDate(input.paymentDeadline)!;
    if (
      expiresAt <= now ||
      paymentDeadline <= now ||
      paymentDeadline > expiresAt
    )
      throw new QuoteError(
        "Validity and payment deadline must be future dates; payment must be due no later than expiry.",
      );
    if (input.sendEmail && (!row.email || row.replyChannel !== "EMAIL"))
      throw new QuoteError(
        "Email delivery requires a customer email and email as the preferred reply channel. Otherwise download and share through the approved channel.",
      );
    const changed = await tx.enquiry.updateMany({
      where: { id: row.id, version: input.enquiryVersion },
      data: { status: "QUOTE_SENT", version: { increment: 1 } },
    });
    if (changed.count !== 1)
      throw new QuoteError(
        "This enquiry changed. Reload before issuing a quote.",
      );
    const latest = await tx.quoteVersion.findFirst({
      where: { enquiryId: row.id },
      orderBy: { number: "desc" },
    });
    const totals = quoteTotals(input.lines, input.currency);
    const snapshot: QuoteSnapshot = {
      reference: row.reference,
      version: (latest?.number ?? 0) + 1,
      customerName: row.name,
      preparedBy: actor.fullName,
      company,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      paymentDeadline: paymentDeadline.toISOString(),
      currency: input.currency,
      serviceDescription: input.serviceDescription,
      travelSummary: input.travelSummary,
      supplierConditions: input.supplierConditions,
      taxTreatment: input.taxTreatment,
      terms: input.terms,
      ...totals,
    };
    const quote = await tx.quoteVersion.create({
      data: {
        enquiryId: row.id,
        number: snapshot.version,
        intentKey: input.intentKey,
        inputHash,
        contentHash: quoteContentHash(snapshot),
        snapshot,
        internalNotes: input.internalNotes,
        currency: input.currency,
        totalMinor: totals.totalMinor,
        issuedAt: now,
        expiresAt,
        paymentDeadline,
        createdById: actorId,
      },
    });
    if (input.sendEmail)
      await tx.notificationJob.create({
        data: {
          enquiryId: row.id,
          quoteId: quote.id,
          dedupeKey: `${quote.id}:issue`,
          kind: "QUOTE_ISSUED",
          channel: "EMAIL",
          toEmail: row.email,
        },
      });
    await tx.enquiryActivity.create({
      data: {
        enquiryId: row.id,
        actorId,
        kind: "QUOTE_ISSUED",
        changes: {
          quoteId: quote.id,
          version: quote.number,
          contentHash: quote.contentHash,
          beforeStatus: row.status,
          afterStatus: "QUOTE_SENT",
          emailQueued: input.sendEmail,
        },
      },
    });
    return quote.id;
  });
}
export async function recordQuoteAcceptance(
  actorId: string,
  input: AcceptanceInput,
  now = new Date(),
) {
  input = acceptanceSchema.parse(input);
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor) throw new QuoteError("Quotation access denied.");
    const row = await tx.enquiry.findFirst({
      where: { reference: input.reference, ...enquiryScope(actor) },
    });
    if (!row || !canWriteQuotes(actor, row.ownerId))
      throw new QuoteError(
        "Only an administrator or the assigned sales owner can record acceptance.",
      );
    const latest = await tx.quoteVersion.findFirst({
      where: { enquiryId: row.id },
      orderBy: { number: "desc" },
    });
    if (!latest || latest.id !== input.quoteId)
      throw new QuoteError(
        "Only the latest issued quote can be accepted. This version is missing or superseded.",
      );
    const existing = await tx.quoteAcceptance.findUnique({
      where: { enquiryId: row.id },
    });
    if (existing) {
      if (
        existing.quoteId === input.quoteId &&
        existing.customerName === input.customerName &&
        existing.channel === input.channel &&
        existing.evidence === input.evidence &&
        existing.actorId === actorId
      )
        return existing.id;
      throw new QuoteError("An acceptance already exists.");
    }
    await requireActiveOwner(tx, row.ownerId);
    if (
      row.status !== "QUOTE_SENT" ||
      latest.expiresAt <= now ||
      latest.paymentDeadline <= now
    )
      throw new QuoteError(
        "The quote is expired, past its payment deadline or no longer open for acceptance.",
      );
    if (
      quoteContentHash(latest.snapshot as QuoteSnapshot) !== latest.contentHash
    )
      throw new QuoteError(
        "Quote integrity check failed. Contact an administrator.",
      );
    const changed = await tx.enquiry.updateMany({
      where: { id: row.id, version: input.enquiryVersion },
      data: { status: "AWAITING_PAYMENT", version: { increment: 1 } },
    });
    if (changed.count !== 1)
      throw new QuoteError(
        "This enquiry changed. Reload before recording acceptance.",
      );
    const acceptance = await tx.quoteAcceptance.create({
      data: {
        enquiryId: row.id,
        quoteId: latest.id,
        customerName: input.customerName,
        channel: input.channel,
        evidence: input.evidence,
        actorId,
        acceptedAt: now,
      },
    });
    await tx.enquiryActivity.create({
      data: {
        enquiryId: row.id,
        actorId,
        kind: "QUOTE_ACCEPTED",
        changes: {
          quoteId: latest.id,
          version: latest.number,
          contentHash: latest.contentHash,
          channel: input.channel,
          acceptanceId: acceptance.id,
        },
        body: input.evidence,
      },
    });
    return acceptance.id;
  });
}
