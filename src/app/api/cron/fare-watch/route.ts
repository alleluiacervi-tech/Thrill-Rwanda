import { runObservedWorker } from "@/lib/worker-health";
import { getFareSource, runFareWatch } from "@/lib/fare-watch";

// Daily fare check for the public fares board (src/lib/fare-watch.ts), from the
// source chosen in Admin → Fares. Called by the VPS scheduler with
// "Authorization: Bearer <CRON_SECRET>".

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const source = await getFareSource();
  if (source === "off" || source === "manual") return Response.json({ skipped: `Nothing to fetch: the price source is ${source}.` });

  const result = await runObservedWorker("fare-watch", () => runFareWatch(new Date(), source), (value) => value.saved);
  return Response.json(result);
}
