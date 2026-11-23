import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { Pagination } from "@/components/ui/pagination";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { paginate } from "@/lib/pagination";
import { fileDeadline, selectedOption, ticketingQueue, type QueueFilter } from "@/lib/ticketing";
import { one, type Params } from "@/lib/table-query";
import { cn } from "@/lib/utils";
import { DeadlineChip, Stat, StatusPill } from "./ticketing-ui";

const VIEWS: { key: QueueFilter; label: string }[] = [
  { key: "open", label: "In progress" },
  { key: "expiring", label: "Expiring in 48 hours" },
  { key: "requests", label: "After-sales requests" },
  { key: "issued", label: "Issued" },
  { key: "all", label: "All files" },
];

export async function TicketingDesk({ params, base }: { params: Params; base: "/staff/ticketing" | "/admin/ticketing" }) {
  const actor = await requireEnquiryStaff();
  const requested = one(params.view) as QueueFilter;
  const view: QueueFilter = VIEWS.some((v) => v.key === requested) ? requested : "open";
  const probe = await ticketingQueue(actor.id, view, 0, 1);
  const page = paginate(params, probe.total, 12);
  const { rows, summary } = await ticketingQueue(actor.id, view, page.skip, page.take);
  const open = ["OPTIONS", "AWAITING_PAYMENT", "READY_TO_TICKET", "TICKETING"].reduce((n, s) => n + (summary.byStatus[s] ?? 0), 0);
  const now = new Date();
  return (
    <>
      <DashboardHead title="Air ticketing desk" lede="Every flight file from fare options to issued tickets, with the deadline each one is racing against." />
      <section aria-label="Desk summary" className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="In progress" value={open} hint="Files before issue" />
        <Stat label="Overdue" value={summary.overdue} hint="Past a fare or ticketing deadline" tone="alert" />
        <Stat label="Due soon" value={summary.critical} hint="Within 24 hours" tone="alert" />
        <Stat label="After-sales" value={summary.requests} hint="Open client requests" />
        <Stat label="Issued" value={(summary.byStatus.ISSUED ?? 0) + (summary.byStatus.CLOSED ?? 0)} hint="Tickets recorded" />
      </section>
      <nav aria-label="Ticketing views" className="mb-5 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link key={v.key} href={v.key === "open" ? base : `${base}?view=${v.key}`} aria-current={v.key === view ? "page" : undefined}
            className={cn("rounded-full border px-4 py-1.5 text-sm transition-colors", v.key === view ? "border-forest-800 bg-forest-800 text-bone-50" : "border-[var(--line-strong)] hover:border-forest-800")}>
            {v.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line-strong)] p-10 text-center">
          <p className="font-display text-2xl">Nothing here</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ink-muted)]">Open a ticketing file from any flight enquiry to start preparing fare options. Files appear here as soon as they exist.</p>
          <Link href={base.replace("ticketing", "enquiries")} className="mt-4 inline-flex items-center gap-2 underline">Go to enquiries <ArrowRight className="size-4" aria-hidden /></Link>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)]">
          {rows.map((row) => {
            const option = selectedOption(row) ?? row.options[0];
            const segments = option?.segments ?? [];
            const route = segments.length ? [segments[0]!.origin, ...segments.map((s) => s.destination)].join(" → ") : "No fare options yet";
            const openRequests = row.requests.filter((r) => ["REQUESTED", "QUOTED", "APPROVED"].includes(r.status)).length;
            return (
              <li key={row.id}>
                <Link href={`${base}/${row.enquiry.reference}`} className="grid gap-3 px-5 py-4 transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] md:grid-cols-[1.4fr_1.2fr_auto_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{row.enquiry.name}</p>
                    <p className="truncate text-sm text-[var(--ink-muted)]">{row.enquiry.reference} · {row.enquiry.owner?.fullName ?? "Unassigned"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium tabular-nums">{route}</p>
                    <p className="flex items-center gap-3 text-sm text-[var(--ink-muted)]">
                      {row.passengers.length > 0 && <span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden />{row.passengers.length}</span>}
                      {row.pnr && <span>PNR {row.pnr}</span>}
                      {openRequests > 0 && <span className="font-semibold text-clay-800">{openRequests} request{openRequests > 1 ? "s" : ""}</span>}
                    </p>
                  </div>
                  <StatusPill status={row.status} />
                  <DeadlineChip deadline={fileDeadline(row)} now={now} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} pathname={base} params={params} label="files" />
    </>
  );
}
