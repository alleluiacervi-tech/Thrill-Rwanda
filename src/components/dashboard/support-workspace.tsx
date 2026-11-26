import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { isFinance, label } from "@/lib/enquiry-workflow";
import { notFound } from "next/navigation";
import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { Panel, StatGrid, StatTile, StatusPill, Toolbar } from "@/components/dashboard/dash-ui";
import {
  OperationsForm,
  type OperationsField,
} from "@/components/dashboard/operations-form";
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES } from "@/lib/launch-rules";
import { ChangeSummary } from "@/components/dashboard/change-summary";
export async function SupportWorkspace({ q = "" }: { q?: string }) {
  const actor = await requireEnquiryStaff();
  if (isFinance(actor)) notFound();
  const [rows, owners] = await Promise.all([
    db.supportCase.findMany({
      where: {
        ...(actor.role === "ADMIN" ? {} : { ownerId: actor.id }),
        ...(q
          ? { reference: { contains: q.slice(0, 80), mode: "insensitive" } }
          : {}),
      },
      include: {
        enquiry: { select: { reference: true } },
        booking: { select: { reference: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 20 },
      },
      orderBy: [{ status: "asc" }, { nextActionAt: "asc" }],
      take: 100,
    }),
    db.user.findMany({
      where: {
        isActive: true,
        ...(actor.role === "ADMIN"
          ? {
              OR: [
                { role: "ADMIN" },
                { staffRole: { in: ["SALES", "OPERATIONS"] } },
              ],
            }
          : { id: actor.id }),
      },
      select: { id: true, fullName: true },
    }),
  ]);
  const common = (r?: (typeof rows)[number]): OperationsField[] => [
    {
      name: "ownerId",
      label: "Responsible owner",
      value: r?.ownerId ?? actor.id,
      options: owners.map((o) => ({ value: o.id, label: o.fullName })),
    },
    {
      name: "category",
      label: "Category",
      value: r?.category,
      options: SUPPORT_CATEGORIES.map((value) => ({ value, label: value })),
    },
    {
      name: "priority",
      label: "Priority",
      value: r?.priority,
      options: ["NORMAL", "URGENT"].map((value) => ({ value, label: value })),
    },
    {
      name: "status",
      label: "Status",
      value: r?.status ?? "OPEN",
      options: SUPPORT_STATUSES.map((value) => ({ value, label: value })),
    },
    {
      name: "summary",
      label: "Issue and required action (no passport/card data)",
      type: "textarea",
      value: r?.summary,
      required: true,
    },
    {
      name: "nextActionAt",
      label: "Next action time (Kigali UTC+2)",
      type: "datetime-local",
      value: r
        ? new Date(r.nextActionAt.getTime() + 7200000)
            .toISOString()
            .slice(0, 16)
        : undefined,
      required: true,
    },
    {
      name: "outcome",
      label: "Resolution and customer handover (required to resolve)",
      type: "textarea",
      value: r?.outcome ?? "",
    },
    {
      name: "evidence",
      label: "Evidence and update reason",
      type: "textarea",
      required: true,
    },
  ];
  const newIntent = randomUUID();
  const now = new Date().getTime();
  const resolved = (r: (typeof rows)[number]) => r.status === "RESOLVED";
  const overdue = rows.filter((r) => !resolved(r) && r.nextActionAt.getTime() < now).length;
  const urgent = rows.filter((r) => !resolved(r) && r.priority === "URGENT").length;
  const open = rows.filter((r) => !resolved(r)).length;
  const when = (d: Date) =>
    d.toLocaleString("en-GB", { timeZone: "Africa/Kigali", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <>
      <DashboardHead
        title="Support"
        lede="After-booking cases, each with an owner and a next action."
      />
      <StatGrid cols={3}>
        <StatTile label="Open cases" value={open} />
        <StatTile label="Overdue" value={overdue} tone={overdue ? "alert" : "good"} note="next action passed" />
        <StatTile label="Urgent" value={urgent} tone={urgent ? "alert" : "default"} />
      </StatGrid>
      <Toolbar>
        <form role="search" className="flex flex-1 items-center gap-2">
          <input
            name="q"
            defaultValue={q}
            aria-label="Search support reference"
            placeholder="Search by case reference"
            className="h-10 w-full max-w-xs rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-3.5 text-sm outline-none focus-visible:border-lake-600"
          />
          <button className="h-10 rounded bg-forest-800 px-4 text-sm font-medium text-bone-50 hover:bg-forest-900">Search</button>
        </form>
      </Toolbar>
      <div className="mb-5">
        <OperationsForm
          key={newIntent}
          title="Open a support case"
          hidden={{ command: "SUPPORT", intentKey: newIntent }}
          fields={[
            { name: "enquiryRef", label: "Accepted/mature enquiry reference" },
            ...(actor.role === "ADMIN"
              ? [{ name: "bookingRef", label: "Or existing booking reference" }]
              : []),
            ...common(),
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyPanel title="No support cases" body="Cases opened after a booking appear here." />
      ) : (
        <div className="grid gap-4">
          {rows.map((r) => {
            const late = !resolved(r) && r.nextActionAt.getTime() < now;
            return (
              <Panel
                key={r.id}
                title={r.reference}
                description={`Linked to ${r.enquiry?.reference ?? r.booking?.reference ?? "—"}`}
                aside={
                  <div className="flex gap-2">
                    {r.priority === "URGENT" ? <StatusPill tone="alert">Urgent</StatusPill> : null}
                    <StatusPill tone={resolved(r) ? "good" : late ? "alert" : "info"}>
                      {resolved(r) ? "Resolved" : late ? "Overdue" : label(r.status)}
                    </StatusPill>
                  </div>
                }
              >
                <p className="break-words text-sm leading-relaxed">{r.summary}</p>
                <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Category</dt>
                    <dd className="mt-1">{label(r.category)}</dd>
                  </div>
                  <div>
                    <dt className="text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Next action</dt>
                    <dd className={late ? "mt-1 font-medium text-clay-700" : "mt-1"}>{when(r.nextActionAt)}</dd>
                  </div>
                  {r.outcome ? (
                    <div>
                      <dt className="text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Outcome</dt>
                      <dd className="mt-1">{r.outcome}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="mt-4">
                  <OperationsForm
                    key={`${r.id}-${r.version}`}
                    title="Update this case"
                    hidden={{ command: "SUPPORT", reference: r.reference, version: r.version, intentKey: randomUUID() }}
                    fields={common(r)}
                  />
                  <details className="group border-b border-[var(--line)] py-3 last:border-0 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                      Case history
                      <span aria-hidden className="text-lg leading-none text-[var(--ink-faint)] transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <ol className="mt-3 grid gap-2">
                      {r.activities.map((a) => (
                        <li key={a.id} className="text-xs text-[var(--ink-muted)]">
                          <span className="tnum font-medium text-[var(--ink)]">{when(a.createdAt)}</span>
                          <ChangeSummary changes={a.changes} className="text-xs" />
                        </li>
                      ))}
                    </ol>
                  </details>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
      {rows.length === 100 ? (
        <p className="mt-4 text-xs text-[var(--ink-faint)]">Showing the latest 100 cases. Search by reference for older ones.</p>
      ) : null}
    </>
  );
}
