import { db } from "@/lib/db";
import { releaseRecordSchema, environmentName } from "@/lib/release-rules";
import { OperationsError } from "@/lib/launch-rules";
import {
  followUpDate,
  canUseEnquiries,
  enquiryScope,
} from "@/lib/enquiry-workflow";
import { toQuoteMinor } from "@/lib/quote-rules";
import { z } from "zod";
import { createHash } from "node:crypto";
export async function saveReleaseRecord(actorId: string, raw: unknown) {
  const input = releaseRecordSchema.parse(raw),
    environment = environmentName(),
    reviewAt = followUpDate(input.reviewAt)!;
  if (reviewAt <= new Date())
    throw new OperationsError("Choose a future evidence review date");
  if (input.cost && !input.currency)
    throw new OperationsError("Choose the cost currency");
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor?.isActive || actor.role !== "ADMIN")
      throw new OperationsError("Administrator access required");
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext('thrill-release-evidence'))`;
    const old = await tx.releaseRecord.findUnique({
      where: { environment_key: { environment, key: input.key } },
    });
    if ((old?.version ?? -1) !== input.version)
      throw new OperationsError(
        "Release evidence changed. Reload before saving",
      );
    const data = {
      owner: input.owner,
      state: input.state,
      evidence: input.evidence,
      reviewAt,
      costMinor: input.cost ? toQuoteMinor(input.cost, input.currency) : null,
      currency: input.currency || null,
      renewalAt: input.renewalAt ? followUpDate(input.renewalAt) : null,
    };
    await tx.releaseRecord.upsert({
      where: { environment_key: { environment, key: input.key } },
      create: { environment, key: input.key, ...data },
      update: { ...data, version: { increment: 1 } },
    });
    await tx.operationsAudit.create({
      data: {
        actorId,
        entityId: input.key,
        action: "RELEASE_EVIDENCE",
        evidence: input.evidence,
        changes: JSON.parse(
          JSON.stringify({ environment, before: old, after: data }),
        ),
      },
    });
  });
}
export async function setDocumentHold(actorId: string, raw: unknown) {
  const input = z
    .object({
      id: z.string().uuid(),
      mode: z.enum(["HOLD", "RELEASE"]),
      evidence: z.string().trim().min(20).max(2000),
    })
    .parse(raw);
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor?.isActive || actor.role !== "ADMIN")
      throw new OperationsError("Administrator access required");
    await tx.bookingDocument.update({
      where: { id: input.id },
      data: { legalHoldReason: input.mode === "HOLD" ? input.evidence : null },
    });
    await tx.operationsAudit.create({
      data: {
        actorId,
        entityId: input.id,
        action: `DOCUMENT_${input.mode}`,
        evidence: input.evidence,
        changes: {},
      },
    });
  });
}
export async function recordSupplierReview(actorId: string, raw: unknown) {
  const input = z
      .object({
        reference: z.string().min(4).max(80),
        supplierId: z.string().uuid(),
        intentKey: z.string().uuid(),
        score: z.coerce.number().int().min(1).max(5),
        outcome: z.enum([
          "DELIVERED",
          "DELAY",
          "CANCELLED",
          "ISSUE_RESOLVED",
          "FOLLOW_UP",
        ]),
        action: z.string().trim().min(10).max(2000),
        evidence: z.string().trim().min(20).max(2000),
        reviewAt: z.string().min(1).max(30),
      })
      .parse(raw),
    inputHash = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (
      !actor ||
      !canUseEnquiries(actor) ||
      !(actor.role === "ADMIN" || actor.staffRole === "OPERATIONS")
    )
      throw new OperationsError("Operational review access denied");
    const e = await tx.enquiry.findFirst({
      where: {
        reference: input.reference,
        ...enquiryScope(actor),
        financialCase: {
          commitments: { some: { supplierId: input.supplierId } },
        },
      },
    });
    if (!e)
      throw new OperationsError("Link a supplier commitment in your own case");
    const old = await tx.supplierReview.findUnique({
      where: { intentKey: input.intentKey },
    });
    if (old) {
      if (old.actorId !== actorId || old.inputHash !== inputHash)
        throw new OperationsError("Review key already used");
      return old.id;
    }
    const review = await tx.supplierReview.create({
      data: {
        supplierId: input.supplierId,
        enquiryId: e.id,
        actorId,
        intentKey: input.intentKey,
        inputHash,
        score: input.score,
        outcome: input.outcome,
        action: input.action,
        evidence: input.evidence,
        reviewAt: followUpDate(input.reviewAt)!,
      },
    });
    await tx.operationsAudit.create({
      data: {
        actorId,
        entityId: review.id,
        action: "SUPPLIER_REVIEW",
        evidence: input.evidence,
        changes: {
          supplierId: input.supplierId,
          enquiryId: e.id,
          score: input.score,
          outcome: input.outcome,
        },
      },
    });
    return review.id;
  });
}
