import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  approvalSchema,
  policySchema,
  supportSchema,
  OperationsError,
} from "@/lib/launch-rules";
import {
  canUseEnquiries,
  enquiryScope,
  followUpDate,
  isFinance,
} from "@/lib/enquiry-workflow";
export async function savePublication(actorId: string, raw: unknown) {
  const input = approvalSchema.parse(raw);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext('thrill-publication'))`;
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor?.isActive || actor.role !== "ADMIN")
      throw new OperationsError("Administrator access required");
    const old = await tx.servicePublication.findUnique({
      where: { service: input.service },
    });
    if ((old?.version ?? -1) !== input.version)
      throw new OperationsError("Publication changed. Reload before saving");
    await tx.servicePublication.upsert({
      where: { service: input.service },
      create: {
        service: input.service,
        mode: input.mode,
        evidence: input.evidence,
        approvedById: actorId,
      },
      update: {
        mode: input.mode,
        evidence: input.evidence,
        approvedById: actorId,
        version: { increment: 1 },
      },
    });
    await tx.operationsAudit.create({
      data: {
        actorId,
        entityId: input.service,
        action: "PUBLICATION",
        evidence: input.evidence,
        changes: { before: old?.mode ?? "ENQUIRY", after: input.mode },
      },
    });
  });
}
export async function savePolicy(actorId: string, raw: unknown) {
  const { version, ...input } = policySchema.parse(raw);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext('thrill-operations-policy'))`;
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor?.isActive || actor.role !== "ADMIN")
      throw new OperationsError("Administrator access required");
    const old = await tx.operationsPolicy.findUnique({ where: { id: 1 } });
    if ((old?.version ?? -1) !== version)
      throw new OperationsError("Policy changed. Reload before saving");
    await tx.operationsPolicy.upsert({
      where: { id: 1 },
      create: { id: 1, ...input },
      update: { ...input, version: { increment: 1 } },
    });
    await tx.operationsAudit.create({
      data: {
        actorId,
        entityId: "operations-policy",
        action: "POLICY",
        evidence: input.evidence,
        changes: JSON.parse(JSON.stringify({ before: old, after: input })),
      },
    });
  });
}
export async function saveSupportCase(actorId: string, raw: unknown) {
  const input = supportSchema.parse(raw),
    hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor || !canUseEnquiries(actor) || isFinance(actor))
      throw new OperationsError("Support access denied");
    const previous = await tx.supportActivity.findUnique({
      where: { intentKey: input.intentKey },
      include: { supportCase: true },
    });
    if (previous) {
      if (previous.actorId !== actorId || previous.inputHash !== hash)
        throw new OperationsError(
          "Request already used with different details",
        );
      if (actor.role !== "ADMIN" && previous.supportCase.ownerId !== actorId)
        throw new OperationsError("Support access denied");
      return previous.supportCase.reference;
    }
    const owner = await tx.user.findFirst({
      where: {
        id: input.ownerId,
        isActive: true,
        OR: [{ role: "ADMIN" }, { staffRole: { in: ["SALES", "OPERATIONS"] } }],
      },
    });
    if (!owner || (actor.role !== "ADMIN" && input.ownerId !== actorId))
      throw new OperationsError("Choose an active authorized support owner");
    const nextActionAt = followUpDate(input.nextActionAt);
    if (!nextActionAt) throw new OperationsError("Set the next action time");
    const old = input.reference
      ? await tx.supportCase.findFirst({
          where: {
            reference: input.reference,
            ...(actor.role === "ADMIN" ? {} : { ownerId: actorId }),
          },
        })
      : null;
    if (input.reference && !old) throw new OperationsError("Case not found");
    let enquiryId = old?.enquiryId ?? null,
      bookingId = old?.bookingId ?? null;
    if (!old) {
      if (input.enquiryRef) {
        const e = await tx.enquiry.findFirst({
          where: { reference: input.enquiryRef, ...enquiryScope(actor) },
        });
        if (
          !e ||
          ![
            "AWAITING_PAYMENT",
            "PARTNER_PROCESSING",
            "CONFIRMED",
            "COMPLETED",
            "CANCELLED",
            "REFUNDED",
          ].includes(e.status)
        )
          throw new OperationsError("Link a mature enquiry in your workspace");
        enquiryId = e.id;
      }
      if (input.bookingRef) {
        if (actor.role !== "ADMIN")
          throw new OperationsError(
            "Administrators must assign support for legacy bookings",
          );
        const b = await tx.booking.findUnique({
          where: { reference: input.bookingRef },
        });
        if (!b) throw new OperationsError("Booking not found");
        bookingId = b.id;
      }
    }
    const values = {
      ownerId: input.ownerId,
      category: input.category,
      priority: input.priority,
      status: input.status,
      summary: input.summary,
      nextActionAt,
      outcome: input.status === "RESOLVED" ? input.outcome : null,
    };
    let record;
    if (old) {
      const updated = await tx.supportCase.updateMany({
        where: { id: old.id, version: input.version },
        data: { ...values, version: { increment: 1 } },
      });
      if (!updated.count)
        throw new OperationsError("Case changed. Reload before saving");
      record = old;
    } else
      record = await tx.supportCase.create({
        data: {
          reference: `SUP-${randomUUID().slice(0, 12).toUpperCase()}`,
          enquiryId,
          bookingId,
          ...values,
        },
      });
    await tx.supportActivity.create({
      data: {
        caseId: record.id,
        actorId,
        intentKey: input.intentKey,
        inputHash: hash,
        changes: JSON.parse(
          JSON.stringify({
            before: old,
            after: values,
            evidence: input.evidence,
          }),
        ),
      },
    });
    return record.reference;
  });
}

export function offerContentHash(tour: unknown) {
  return createHash("sha256").update(JSON.stringify(tour)).digest("hex");
}
export async function approveOffer(
  actorId: string,
  id: string,
  evidence: string,
  contentHash: string,
) {
  if (evidence.trim().length < 10)
    throw new OperationsError("Record actual offer approval evidence");
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor?.isActive || actor.role !== "ADMIN")
      throw new OperationsError("Administrator access required");
    await tx.$queryRaw`SELECT id FROM tours WHERE id = ${id}::uuid FOR UPDATE`;
    const tour = await tx.tour.findUnique({
      where: { id },
      include: { provider: { select: { status: true } } },
    });
    if (!tour || offerContentHash(tour) !== contentHash)
      throw new OperationsError(
        "Offer changed. Reload and review the latest details",
      );
    if (
      tour.provider.status !== "VERIFIED" ||
      !(await tx.provider.findFirst({
        where: { id: tour.providerId, user: { isActive: true } },
        select: { id: true },
      })) ||
      !tour.images.length ||
      (tour.description?.trim().length ?? 0) < 10 ||
      tour.itinerary.trim().length < 10 ||
      tour.suitability.trim().length < 10 ||
      !tour.inclusions.length ||
      !tour.exclusions.length
    )
      throw new OperationsError(
        "Review description, media, itinerary, suitability, inclusions, exclusions and active verified provider before approval",
      );
    await tx.tour.update({
      where: { id },
      data: { offerApproval: evidence, isPublished: true },
    });
    await tx.operationsAudit.create({
      data: {
        actorId,
        entityId: id,
        action: "OFFER_APPROVAL",
        evidence,
        changes: { contentHash, name: tour.name },
      },
    });
  });
}
export async function deleteRetainedDocument(
  actorId: string,
  id: string,
  evidence: string,
) {
  if (evidence.trim().length < 10)
    throw new OperationsError("Record deletion authority and reason");
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor?.isActive || actor.role !== "ADMIN")
      throw new OperationsError("Administrator access required");
    const doc = await tx.bookingDocument.findUnique({
      where: { id },
      select: { id: true, bookingId: true, kind: true },
    });
    if (!doc)
      throw new OperationsError("Document already deleted or not found");
    await tx.bookingDocument.delete({ where: { id } });
    await tx.operationsAudit.create({
      data: {
        actorId,
        entityId: id,
        action: "DOCUMENT_DELETE",
        evidence,
        changes: doc,
      },
    });
  });
}
