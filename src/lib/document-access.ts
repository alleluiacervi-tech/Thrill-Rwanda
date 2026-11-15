import { db } from "@/lib/db";
import { canViewDocuments } from "@/lib/booking-documents";
/** Stored expiry is an upper bound; a shorter current policy can only shorten it. */
export function documentDeadline(
  uploadedAt: Date,
  expiresAt: Date | null,
  policyDays: number,
) {
  return new Date(
    Math.min(
      uploadedAt.getTime() + policyDays * 86400000,
      expiresAt?.getTime() ?? uploadedAt.getTime() + 30 * 86400000,
    ),
  );
}
export async function readPrivateDocument(actorId: string, id: string) {
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor?.isActive) return null;
    const [doc, policy] = await Promise.all([
      tx.bookingDocument.findUnique({
        where: { id },
        select: {
          id: true,
          uploadedAt: true,
          expiresAt: true,
          booking: {
            select: {
              customerId: true,
              provider: { select: { userId: true, status: true } },
            },
          },
        },
      }),
      tx.operationsPolicy.findUnique({ where: { id: 1 } }),
    ]);
    if (
      !doc ||
      !policy?.documentsEnabled ||
      documentDeadline(doc.uploadedAt, doc.expiresAt, policy.documentDays) <=
        new Date()
    )
      return null;
    const b = doc.booking;
    if (
      !canViewDocuments(actor, {
        customerId: b.customerId,
        providerUserId: b.provider.userId,
      }) ||
      (actor.id === b.provider.userId &&
        actor.role !== "ADMIN" &&
        b.provider.status !== "VERIFIED")
    )
      return null;
    await tx.operationsAudit.create({
      data: {
        actorId,
        entityId: id,
        action: "DOCUMENT_READ",
        evidence: "Authenticated, active, scoped and within approved retention",
        changes: {},
      },
    });
    return tx.bookingDocument.findUnique({
      where: { id },
      select: { data: true, contentType: true, fileName: true },
    });
  });
}
