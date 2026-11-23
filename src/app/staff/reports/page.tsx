import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { operationsReport } from "@/lib/operations-report";
import { OperationsError } from "@/lib/launch-rules";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { BarList, Panel, StatGrid, StatTile } from "@/components/dashboard/dash-ui";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { financialSummary } from "@/lib/finance-rules";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const actor = await requireEnquiryStaff(),
    params = await searchParams;
  let report;
  try {
    report = await operationsReport(actor, params.from, params.to);
  } catch (e) {
    if (e instanceof OperationsError)
      return (
        <>
          <DashboardHead title="Reports" />
          <p role="alert">{e.message}</p>
          <a href="/staff/reports" className="underline">
            Reset date range
          </a>
        </>
      );
    throw e;
  }
  const internal = actor.role === "ADMIN" || actor.staffRole === "FINANCE";
  const currencies = new Map<
    string,
    {
      collections: number;
      refunds: number;
      due: number;
      contribution: number;
      reviewed: number;
      cases: number;
    }
  >();
  if (internal)
    for (const row of report.rows) {
      const c = row.financialCase;
      if (!c) continue;
      const s = financialSummary(c),
        g = currencies.get(c.currency) ?? {
          collections: 0,
          refunds: 0,
          due: 0,
          contribution: 0,
          reviewed: 0,
          cases: 0,
        };
      g.collections += s.collections;
      g.refunds += s.customerRefunds;
      g.due += s.supplierDue;
      g.cases++;
      if (s.contribution !== null) {
        g.contribution += s.contribution;
        g.reviewed++;
      }
      currencies.set(c.currency, g);
    }
  const query = new URLSearchParams({
    from: report.range.from,
    to: report.range.to,
  });
  const rate = report.quoted ? `${((100 * report.accepted) / report.quoted).toFixed(0)}%` : "—";
  const days = (d: Date | null | undefined) => d?.toISOString().slice(0, 10) ?? "—";
  return (
    <>
      <DashboardHead
        title="Reports"
        lede="Weekly operations for enquiries created in the selected period. Dates are Kigali time."
        action={
          <div className="flex flex-wrap gap-2">
            <Button href={`/staff/reports/export?kind=operations&${query}`} variant="outline">
              <Download className="size-4" />
              Operations CSV
            </Button>
            {internal && (
              <Button href={`/staff/reports/export?kind=finance&${query}`} variant="outline">
                <Download className="size-4" />
                Finance CSV
              </Button>
            )}
          </div>
        }
      />
      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-3 text-xs font-medium text-[var(--ink-muted)]">
        <label>
          From
          <input name="from" type="date" defaultValue={report.range.from} className="mt-1 block h-9 rounded border border-[var(--line-strong)] bg-[var(--paper-raised)] px-3 text-sm text-[var(--ink)]" />
        </label>
        <label>
          Through
          <input name="to" type="date" defaultValue={report.range.to} className="mt-1 block h-9 rounded border border-[var(--line-strong)] bg-[var(--paper-raised)] px-3 text-sm text-[var(--ink)]" />
        </label>
        <button className="h-9 rounded bg-forest-800 px-4 text-sm font-medium text-bone-50 transition-colors hover:bg-forest-900">Apply</button>
      </form>

      <StatGrid>
        <StatTile label="Enquiries" value={report.rows.length} note="in this period" />
        <StatTile label="Responded" value={report.responded} note={`${report.rows.length - report.responded} waiting`} tone="good" />
        <StatTile label="Median response" value={report.median === null || report.median === undefined ? "—" : `${report.median.toFixed(1)}h`} note="elapsed, incl. nights" />
        <StatTile label="Quote acceptance" value={rate} note={`${report.accepted} of ${report.quoted} quoted`} />
      </StatGrid>
      <StatGrid cols={3}>
        <StatTile label="Unresolved now" value={report.unresolved} note="all dates" />
        <StatTile label="Overdue follow-up" value={report.overdue} note="all dates" tone={report.overdue ? "alert" : "good"} />
        <StatTile label="Suppliers confirmed" value={`${report.confirmedSuppliers}/${report.committedSuppliers}`} note="of commitments made" />
      </StatGrid>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Panel title="Where enquiries come from">
          <BarList rows={Array.from(report.sources, ([name, value]) => ({ label: titleCase(name), value }))} />
        </Panel>
        <Panel title="Where they stand now" description="Includes lost cases.">
          <BarList rows={Array.from(report.stages, ([name, value]) => ({ label: titleCase(name), value }))} />
        </Panel>
      </div>

      {internal && currencies.size > 0 && (
        <Panel
          title="Off-site balances"
          description="Per currency, in minor units. Contribution is an operating estimate, not statutory profit."
          className="mb-6"
          flush
        >
          <TableShell className="rounded-none border-0" dense>
            <thead>
              <tr><Th>Currency</Th><Th>Collected</Th><Th>Refunded</Th><Th>Supplier payable</Th><Th>Contribution</Th><Th>Reviewed</Th></tr>
            </thead>
            <tbody>
              {Array.from(currencies, ([currency, g]) => (
                <Tr key={currency}>
                  <Td className="font-medium">{currency}</Td>
                  <Td className="tnum">{g.collections.toLocaleString("en-US")}</Td>
                  <Td className="tnum">{g.refunds.toLocaleString("en-US")}</Td>
                  <Td className="tnum">{g.due.toLocaleString("en-US")}</Td>
                  <Td className="tnum">{g.contribution.toLocaleString("en-US")}</Td>
                  <Td className="tnum">{g.reviewed}/{g.cases}</Td>
                </Tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      )}

      {report.supplierMetrics.size > 0 && (
        <Panel
          title="Supplier follow-through"
          description="Recorded confirmations for this period, not a quality score."
          className="mb-6"
          flush
        >
          <TableShell className="rounded-none border-0" dense>
            <thead>
              <tr><Th>Supplier</Th><Th>Status</Th><Th>Confirmed</Th><Th>Oldest unconfirmed</Th><Th>Review due</Th></tr>
            </thead>
            <tbody>
              {Array.from(report.supplierMetrics, ([id, g]) => (
                <Tr key={id}>
                  <Td className="font-medium">{g.name}</Td>
                  <Td>{titleCase(String(g.status))}</Td>
                  <Td className="tnum">{g.confirmed}/{g.total}</Td>
                  <Td className="tnum">{days(g.oldestPending)}</Td>
                  <Td className="tnum">{days(g.reviewDue)}</Td>
                </Tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      )}

      {report.support && report.support.length > 0 && (
        <Panel title="Support cases now" className="mb-6">
          <BarList rows={report.support.map((r) => ({ label: titleCase(String(r.status)), value: r._count }))} />
        </Panel>
      )}

      {actor.role === "ADMIN" && report.interactions.length > 0 && (
        <Panel
          title="Call-to-action clicks"
          description="Daily counts, not unique visitors. Nothing personal is stored; repeat or automated clicks may be included."
          className="mb-6"
          flush
        >
          <TableShell className="rounded-none border-0" dense>
            <thead><tr><Th>Day</Th><Th>Service</Th><Th>Placement</Th><Th>Clicks</Th></tr></thead>
            <tbody>
              {report.interactions.map((i) => (
                <Tr key={`${i.day}-${i.service}-${i.placement}`}>
                  <Td className="tnum">{days(i.day)}</Td>
                  <Td>{titleCase(String(i.service))}</Td>
                  <Td>{titleCase(String(i.placement))}</Td>
                  <Td className="tnum">{i.clicks}</Td>
                </Tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      )}

      <p className="max-w-3xl text-xs leading-relaxed text-[var(--ink-faint)]">
        Statuses are current, so figures can change after the period ends; this is not a historical funnel.
        Unresponded cases are left out of the median.
      </p>
    </>
  );
}

const titleCase = (s: string) => s.toLowerCase().replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
