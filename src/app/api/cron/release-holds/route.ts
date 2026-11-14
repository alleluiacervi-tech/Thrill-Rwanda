import { releaseStaleHolds } from "@/lib/booking";

// Daily sweep of dates held at step one and never confirmed. New bookings also
// release stale holds on their own listing, so this only tidies the rest.
// Vercel Cron calls it with "Authorization: Bearer <CRON_SECRET>".

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const released = await releaseStaleHolds();
  return Response.json({ released });
}
