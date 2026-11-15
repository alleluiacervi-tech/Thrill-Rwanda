import { purgeExpiredDocuments } from "@/lib/maintenance";
import { runObservedWorker } from "@/lib/worker-health";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return Response.json({ error: "Not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await runObservedWorker(
      "document-retention",
      () =>
        purgeExpiredDocuments(
          process.env.MAINTENANCE_DELETE_APPROVED === "true",
        ),
      (r) => r.deleted,
    );
    return Response.json(result);
  } catch {
    return Response.json({ error: "Maintenance failed" }, { status: 503 });
  }
}
