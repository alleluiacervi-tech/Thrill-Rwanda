import Link from "next/link";
import { Download, ShieldCheck } from "lucide-react";
import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/pagination";
import {
  ACTIVITY_AREAS,
  activityWhere,
  kigaliTime,
  readActivityFilters,
} from "@/lib/activity-query";
import { db } from "@/lib/db";
import { paginate } from "@/lib/pagination";
import { requireSuperAdmin } from "@/lib/session";
import { ChangeSummary } from "@/components/dashboard/change-summary";

export const metadata = {
  title: "Activity log",
  robots: { index: false, follow: false },
};

const fieldCls =
  "h-10 w-full min-w-0 rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-3 text-sm";

/**
 * Who did what, and when. Super admins only. Entries cannot be edited or
 * deleted (a database trigger refuses it), so this is the record to settle
 * "who changed this?" fairly.
 */
export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin("/admin/activity");
  const params = await searchParams;
  const filters = readActivityFilters(params);
  const where = activityWhere(filters);

  const [total, people] = await Promise.all([
    db.activityLog.count({ where }),
    // Everyone who has ever acted, for the person filter, including removed accounts.
    db.activityLog.groupBy({
      by: ["actorId", "actorName", "actorEmail"],
      _count: { _all: true },
      orderBy: { actorName: "asc" },
    }),
  ]);
  const page = paginate(params, total, 50);
  const rows = await db.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: page.skip,
    take: page.take,
  });

  // One option per person, even if their name changed over time.
  const options = [...new Map(people.filter((p) => p.actorId).map((p) => [p.actorId!, p])).values()];
  const exportQuery = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][],
  ).toString();
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      <DashboardHead
        title="Activity log"
        lede="Every change made by administrators, staff and providers, and every team sign-in. Entries are permanent: nobody, including a super admin, can edit or delete them."
        action={
          <Button href={`/admin/activity/export${exportQuery ? `?${exportQuery}` : ""}`} variant="quiet">
            <Download className="size-4" aria-hidden />
            Export
          </Button>
        }
      />

      <form method="get" className="mb-5 grid grid-cols-1 gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto_auto_auto] lg:items-end">
        <label className="flex min-w-0 flex-col gap-1 text-2xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
          Search
          <input name="q" defaultValue={filters.q} placeholder="Name, email, booking, listing…" className={fieldCls} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-2xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
          Person
          <select name="actor" defaultValue={filters.actor} className={fieldCls}>
            <option value="">Everyone</option>
            {options.map((p) => (
              <option key={p.actorId} value={p.actorId!}>
                {p.actorName} ({p.actorEmail})
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-2xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
          Area
          <select name="area" defaultValue={filters.area} className={fieldCls}>
            <option value="">All areas</option>
            {ACTIVITY_AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-2xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
          From
          <input type="date" name="from" defaultValue={filters.from} className={fieldCls} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-2xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
          To
          <input type="date" name="to" defaultValue={filters.to} className={fieldCls} />
        </label>
        <div className="flex gap-2">
          {filters.target ? <input type="hidden" name="target" value={filters.target} /> : null}
          <Button type="submit" variant="primary">
            Filter
          </Button>
          {filtered ? (
            <Button href="/admin/activity" variant="ghost">
              Clear
            </Button>
          ) : null}
        </div>
      </form>

      {filters.target ? (
        <p className="mb-4 text-sm text-[var(--ink-muted)]">
          Showing only changes made to one account or record.{" "}
          <Link href="/admin/activity" className="underline">
            Show everything
          </Link>
        </p>
      ) : null}

      {rows.length === 0 ? (
        <EmptyPanel
          title={filtered ? "Nothing matches those filters" : "No activity yet"}
          body={
            filtered
              ? "Try a wider date range or another person."
              : "Changes appear here as soon as anyone on the team makes one."
          }
        />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>When (Kigali)</Th>
              <Th>Who</Th>
              <Th>Area</Th>
              <Th>What happened</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const changes = r.changes && typeof r.changes === "object" && Object.keys(r.changes).length ? r.changes : null;
              return (
                <Tr key={r.id}>
                  <Td className="tnum whitespace-nowrap text-2xs text-[var(--ink-muted)]">{kigaliTime(r.createdAt)}</Td>
                  <Td>
                    {r.actorId ? (
                      <Link href={`/admin/activity?actor=${r.actorId}`} className="block font-medium hover:underline">
                        {r.actorName}
                      </Link>
                    ) : (
                      <span className="block font-medium">{r.actorName}</span>
                    )}
                    <span className="block text-2xs text-[var(--ink-faint)]">
                      {r.actorRole}
                      {r.ip ? ` · ${r.ip}` : ""}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={r.area === "Access" ? "sun" : r.area === "Sign-in" ? "outline" : "neutral"}>
                      {r.area}
                    </Badge>
                  </Td>
                  <Td>
                    <span className="block">{r.summary}</span>
                    {changes ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-2xs text-[var(--ink-faint)]">Details</summary>
                        <ChangeSummary changes={changes} className="max-w-xl text-xs" />
                      </details>
                    ) : null}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </TableShell>
      )}

      <Pagination page={page} pathname="/admin/activity" params={params} label="entries" />

      <p className="mt-6 flex items-start gap-2 text-2xs leading-relaxed text-[var(--ink-faint)]">
        <ShieldCheck className="mt-px size-4 shrink-0 text-forest-700" aria-hidden />
        Each entry stores the person&rsquo;s name, email and access as they were at the time, so the record stays true
        even if the account is later renamed, demoted or removed.
      </p>
    </>
  );
}
