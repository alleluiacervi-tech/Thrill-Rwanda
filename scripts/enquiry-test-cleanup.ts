import "dotenv/config";
import { db } from "../src/lib/db";
/** Call only after the integration runner's local-database guard, with generated fixture IDs. */
export async function removeEnquiryFixtures(ids: string[]) {
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
