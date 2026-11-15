import "dotenv/config";
import { db } from "../src/lib/db";
/** Call only after the integration runner's local-database guard, with generated fixture IDs. */
export async function removeEnquiryFixtures(ids: string[]) {
  const cases = await db.financialCase.findMany({
    where: { enquiryId: { in: ids } },
    select: { id: true },
  });
  const caseIds = cases.map((row) => row.id);
  await db.enquiryFulfilment.deleteMany({ where: { caseId: { in: caseIds } } });
  await db.financialEntry.deleteMany({
    where: { caseId: { in: caseIds }, reversesId: { not: null } },
  });
  await db.financialEntry.deleteMany({ where: { caseId: { in: caseIds } } });
  await db.receiptAllocation.deleteMany({ where: { caseId: { in: caseIds } } });
  await db.offsiteReceipt.deleteMany({ where: { caseId: { in: caseIds } } });
  await db.settlementProof.deleteMany({ where: { caseId: { in: caseIds } } });
  await db.customerRefund.deleteMany({ where: { caseId: { in: caseIds } } });
  await db.supplierCommitment.deleteMany({
    where: { caseId: { in: caseIds } },
  });
  await db.financialOperation.deleteMany({
    where: { caseId: { in: caseIds } },
  });
  await db.financialCase.deleteMany({ where: { id: { in: caseIds } } });
  const jobs = await db.notificationJob.findMany({
    where: { enquiryId: { in: ids } },
    select: { id: true },
  });
  const jobIds = jobs.map((job) => job.id);
  await db.notification.deleteMany({ where: { id: { in: jobIds } } });
  await db.notificationAttempt.deleteMany({ where: { jobId: { in: jobIds } } });
  await db.notificationJob.deleteMany({ where: { id: { in: jobIds } } });
  await db.quoteAcceptance.deleteMany({ where: { enquiryId: { in: ids } } });
  await db.quoteVersion.deleteMany({ where: { enquiryId: { in: ids } } });
  await db.enquiryActivity.deleteMany({ where: { enquiryId: { in: ids } } });
  await db.enquiry.deleteMany({ where: { id: { in: ids } } });
}
