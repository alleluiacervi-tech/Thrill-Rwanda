import { reconcileDueCollections } from "@/lib/collections/reconcile";
import { matchSecret } from "@/lib/collections/webhooks";
import { runObservedWorker } from "@/lib/worker-health";

export const maxDuration = 45;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const token = request.headers.get("authorization") ?? "";
  if (!secret || secret.length < 32 || !matchSecret(token, `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const checked = await runObservedWorker("reconcile-payments", reconcileDueCollections, (count) => count);
    return Response.json({ checked }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Reconciliation unavailable" }, { status: 503 });
  }
}
