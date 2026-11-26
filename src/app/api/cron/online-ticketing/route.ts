import { matchSecret } from "@/lib/collections/webhooks";
import { runOnlineTicketing } from "@/lib/flight-autoticket";
import { runObservedWorker } from "@/lib/worker-health";

// Booking with an airline can take two minutes; a few files may run in one pass.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const token = request.headers.get("authorization") ?? "";
  if (!secret || secret.length < 32 || !matchSecret(token, `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runObservedWorker("online-ticketing", runOnlineTicketing, (value) => value.ticketed + value.delivered);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Online ticketing unavailable" }, { status: 503 });
  }
}
