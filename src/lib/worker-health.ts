import { db } from "@/lib/db";
export async function runObservedWorker<T>(
  name: string,
  work: () => Promise<T>,
  count: (value: T) => number,
) {
  await db.workerHeartbeat.upsert({
    where: { name },
    create: { name, startedAt: new Date() },
    update: { startedAt: new Date(), errorCode: null },
  });
  try {
    const result = await work();
    await db.workerHeartbeat.update({
      where: { name },
      data: {
        succeededAt: new Date(),
        processed: count(result),
        errorCode: null,
      },
    });
    return result;
  } catch {
    await db.workerHeartbeat.update({
      where: { name },
      data: { errorCode: "WORKER_FAILED" },
    });
    throw new Error(
      "Worker failed; inspect the protected operations workspace",
    );
  }
}
