import { enqueueOwnerNotification } from "@/lib/enquiry-outbox";
import { db } from "@/lib/db";
import {
  allowedEnquiryTransitions,
  canUseEnquiries,
  enquiryScope,
  followUpDate,
  isFinance,
  type TriageInput,
} from "@/lib/enquiry-workflow";

export class EnquiryWorkflowError extends Error {}

export async function updateEnquiry(actorId: string, input: TriageInput) {
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({
      where: { id: actorId },
      select: { id: true, role: true, staffRole: true, isActive: true },
    });
    if (!actor || !canUseEnquiries(actor))
      throw new EnquiryWorkflowError("You no longer have enquiry access.");
    const row = await tx.enquiry.findFirst({
      where: { reference: input.reference, ...enquiryScope(actor) },
    });
    if (!row)
      throw new EnquiryWorkflowError(
        "Enquiry not found or not assigned to your workspace.",
      );
    if (row.version !== input.version)
      throw new EnquiryWorkflowError(
        "Someone updated this enquiry. Reload before saving your changes.",
      );
    const changedStatus = input.status !== row.status;
    if (
      changedStatus &&
      ["QUOTE_SENT", "AWAITING_PAYMENT"].includes(input.status)
    )
      throw new EnquiryWorkflowError(
        "Use the quotation workspace to issue a version or record exact-version acceptance.",
      );
    if (
      changedStatus &&
      !allowedEnquiryTransitions(actor, row.status).includes(input.status)
    )
      throw new EnquiryWorkflowError(
        "That status transition is not permitted.",
      );
    if (
      isFinance(actor) &&
      (input.ownerId !== undefined ||
        input.followUp !== undefined ||
        input.note)
    )
      throw new EnquiryWorkflowError(
        "Finance can record financial milestone evidence only.",
      );
    const ownerId =
      input.ownerId === undefined ? row.ownerId : input.ownerId || null;
    if (actor.role !== "ADMIN" && !isFinance(actor) && ownerId !== actor.id)
      throw new EnquiryWorkflowError(
        "Claim this enquiry for yourself before updating it.",
      );
    if (ownerId) {
      const owner = await tx.user.findUnique({
        where: { id: ownerId },
        select: { isActive: true, role: true, staffRole: true },
      });
      if (
        !owner?.isActive ||
        !(
          owner.role === "ADMIN" ||
          ["SALES", "OPERATIONS"].includes(owner.staffRole ?? "")
        )
      )
        throw new EnquiryWorkflowError(
          "Choose an active administrator, sales or operations owner.",
        );
    }
    if (changedStatus && input.status !== "NEW" && !ownerId)
      throw new EnquiryWorkflowError("Assign an owner before changing status.");
    let nextFollowUp = row.nextFollowUp;
    try {
      if (input.followUp !== undefined)
        nextFollowUp = followUpDate(input.followUp);
    } catch {
      throw new EnquiryWorkflowError("Choose a real follow-up date and time.");
    }
    if (input.status === "NEEDS_INFORMATION" && !nextFollowUp)
      throw new EnquiryWorkflowError(
        "Set the next follow-up when more information is needed.",
      );
    if (
      changedStatus &&
      ["CANCELLED", "REFUNDED", "LOST"].includes(input.status) &&
      input.reason.length < 5
    )
      throw new EnquiryWorkflowError(
        "Record an outcome reason (at least 5 characters).",
      );
    if (
      changedStatus &&
      [
        "QUOTE_SENT",
        "AWAITING_PAYMENT",
        "PARTNER_PROCESSING",
        "CONFIRMED",
        "COMPLETED",
        "REFUNDED",
      ].includes(input.status) &&
      input.evidence.length < 10
    )
      throw new EnquiryWorkflowError(
        "Record supporting evidence: quote version/expiry, acceptance, reconciled receipt, supplier confirmation or outcome reference (at least 10 characters).",
      );
    const firstResponseAt =
      row.firstResponseAt ??
      (changedStatus &&
      ["CONTACTED", "NEEDS_INFORMATION"].includes(input.status)
        ? new Date()
        : null);
    const closed = ["COMPLETED", "CANCELLED", "REFUNDED", "LOST"].includes(
      input.status,
    );
    if (closed) nextFollowUp = null;
    const changes = {
      before: {
        status: row.status,
        ownerId: row.ownerId,
        followUp: row.nextFollowUp?.toISOString() ?? null,
      },
      after: {
        status: input.status,
        ownerId,
        followUp: nextFollowUp?.toISOString() ?? null,
      },
      reason: changedStatus ? input.reason : "",
      evidence: changedStatus ? input.evidence : "",
    };
    const changed =
      changedStatus ||
      row.ownerId !== ownerId ||
      row.nextFollowUp?.getTime() !== nextFollowUp?.getTime() ||
      !!input.note;
    if (!changed) throw new EnquiryWorkflowError("No changes to save.");
    const result = await tx.enquiry.updateMany({
      where: { id: row.id, version: input.version },
      data: {
        status: input.status,
        ownerId,
        nextFollowUp,
        firstResponseAt,
        ...(changedStatus && input.reason
          ? { outcomeReason: input.reason }
          : {}),
        version: { increment: 1 },
      },
    });
    if (result.count !== 1)
      throw new EnquiryWorkflowError(
        "Someone updated this enquiry. Reload before saving your changes.",
      );
    if (ownerId && row.ownerId !== ownerId)
      await enqueueOwnerNotification(tx, row.id, ownerId, input.version + 1);
    await tx.enquiryActivity.create({
      data: {
        enquiryId: row.id,
        actorId,
        kind: isFinance(actor) ? "FINANCE_MILESTONE" : "TRIAGE",
        body: input.note || null,
        changes,
      },
    });
    return row.reference;
  });
}
