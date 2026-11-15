import { runObservedWorker } from "@/lib/worker-health";
import { processNotificationBatch } from "@/lib/notification-worker";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return Response.json(
      { error: "Notification worker is not configured" },
      { status: 503 },
    );
  if (request.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const outcomes = await runObservedWorker("enquiry-notifications", () => processNotificationBatch(), value => value.length);
  return Response.json({ processed: outcomes.length });
}
