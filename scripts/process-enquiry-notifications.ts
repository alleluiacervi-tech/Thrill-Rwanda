import "dotenv/config";
import { processNotificationBatch } from "../src/lib/notification-worker";
import { runObservedWorker } from "../src/lib/worker-health";
import { db } from "../src/lib/db";
async function main() {
  if (process.argv.includes("--dry-run")) {
    const queued = await db.notificationJob.count({
      where: { status: { in: ["PENDING", "FAILED", "BLOCKED", "SENDING"] } },
    });
    console.log(
      `${queued} outstanding notification jobs. Dry run: no messages sent or records changed.`,
    );
    return;
  }
  const outcomes = await runObservedWorker(
    "enquiry-notifications",
    () => processNotificationBatch(),
    (value) => value.length,
  );
  console.log(`Processed ${outcomes.length} notification jobs.`);
}
main()
  .finally(() => db.$disconnect())
  .catch(() => {
    console.error(
      "Notification worker failed; inspect delivery states in the staff workspace.",
    );
    process.exitCode = 1;
  });
