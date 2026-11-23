import { db } from "@/lib/db";
export const dynamic = "force-dynamic";

// The image tag this server runs (set by the Dockerfile), so a deploy can
// confirm the new release is the one answering. A commit hash, nothing secret.
const release = process.env.RELEASE || "dev";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok", release },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable", release },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
