import { db } from "@/lib/db";
import { documentDeadline } from "@/lib/document-access";
export async function purgeExpiredDocuments(apply = false, ids?: string[]) {
  if (apply && process.env.MAINTENANCE_DELETE_APPROVED !== "true")
    throw new Error("Scheduled deletion approval not enabled");
  const policy = await db.operationsPolicy.findUnique({ where: { id: 1 } });
  if (!policy?.documentsEnabled)
    return {
      scanned: 0,
      expired: 0,
      deleted: 0,
      blocked: "POLICY_NOT_ENABLED",
    };
  const docs = await db.bookingDocument.findMany({
    where: {
      ...(ids ? { id: { in: ids } } : {}),
      legalHoldReason: null,
      OR: [
        { expiresAt: { lt: new Date() } },
        {
          uploadedAt: {
            lt: new Date(Date.now() - policy.documentDays * 86400000),
          },
        },
      ],
    },
    select: { id: true, uploadedAt: true, expiresAt: true },
    orderBy: { uploadedAt: "asc" },
    take: 100,
  });
  let expired = 0,
    deleted = 0;
  for (const doc of docs) {
    if (
      documentDeadline(doc.uploadedAt, doc.expiresAt, policy.documentDays) >
      new Date()
    )
      continue;
    expired++;
    if (!apply) continue;
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM booking_documents WHERE id=${doc.id}::uuid FOR UPDATE`;
      const current = await tx.bookingDocument.findUnique({
          where: { id: doc.id },
          select: { uploadedAt: true, expiresAt: true, legalHoldReason: true },
        }),
        latestPolicy = await tx.operationsPolicy.findUnique({
          where: { id: 1 },
        });
      if (
        !current ||
        current.legalHoldReason ||
        !latestPolicy?.documentsEnabled ||
        documentDeadline(
          current.uploadedAt,
          current.expiresAt,
          latestPolicy.documentDays,
        ) > new Date()
      )
        return;
      await tx.bookingDocument.delete({ where: { id: doc.id } });
      await tx.operationsAudit.create({
        data: {
          actorId: "00000000-0000-0000-0000-000000000000",
          entityId: doc.id,
          action: "DOCUMENT_RETENTION_PURGE",
          evidence: "Approved scheduled expiry review; no legal hold",
          changes: {},
        },
      });
      deleted++;
    });
  }
  return { scanned: docs.length, expired, deleted };
}
