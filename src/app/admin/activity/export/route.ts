import { logActivity } from "@/lib/activity";
import { activityWhere, kigaliTime, readActivityFilters } from "@/lib/activity-query";
import { db } from "@/lib/db";
import { csv } from "@/lib/launch-rules";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The activity log as a spreadsheet, with the page's filters. Super admins only; the export itself is logged. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Access denied", { status: 403 });
  const me = await db.user.findUnique({ where: { id: user.id }, select: { isSuperAdmin: true } });
  if (!me?.isSuperAdmin) return new Response("Access denied", { status: 403 });

  const filters = readActivityFilters(Object.fromEntries(new URL(request.url).searchParams));
  const rows = await db.activityLog.findMany({
    where: activityWhere(filters),
    orderBy: { createdAt: "desc" },
    take: 20000,
  });

  await logActivity(user.id, {
    action: "activity.export",
    area: "Access",
    summary: `Exported ${rows.length} activity log ${rows.length === 1 ? "entry" : "entries"}`,
    changes: filters as never,
  });

  const body = csv([
    ["When (Kigali)", "Person", "Email", "Access at the time", "Area", "Action", "Target", "What happened", "Details", "IP address"],
    ...rows.map((r) => [
      kigaliTime(r.createdAt),
      r.actorName,
      r.actorEmail,
      r.actorRole,
      r.area,
      r.action,
      r.target ?? "",
      r.summary,
      r.changes && Object.keys(r.changes as object).length ? JSON.stringify(r.changes) : "",
      r.ip ?? "",
    ]),
  ]);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=thrill-activity-log-${new Date().toISOString().slice(0, 10)}.csv`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
