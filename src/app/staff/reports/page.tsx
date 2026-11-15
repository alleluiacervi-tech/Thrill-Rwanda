import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { operationsReport } from "@/lib/operations-report";
import { OperationsError } from "@/lib/launch-rules";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
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
  return (
    <>
      <DashboardHead
        title="Weekly operations & reports"
        lede="Enquiry creation cohort with current outcomes. Balances are as of now, not cash movements during the selected dates. All dates use Kigali UTC+2."
      />
      <form className="my-6 flex flex-wrap items-end gap-4">
        <label>
          From
          <input
            name="from"
            type="date"
            defaultValue={report.range.from}
            className="mt-2 block rounded border p-3"
          />
        </label>
        <label>
          Through
          <input
            name="to"
            type="date"
            defaultValue={report.range.to}
            className="mt-2 block rounded border p-3"
          />
        </label>
        <button className="rounded border p-3">Update range</button>
      </form>
      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          ["Enquiries in cohort", report.rows.length],
          ["Responded", report.responded],
          ["Not yet responded", report.rows.length - report.responded],
          [
            "Median elapsed response hours",
            report.median?.toFixed(1) ?? "No responses",
          ],
          ["Quoted cases", report.quoted],
          ["Accepted cases", report.accepted],
          [
            "Acceptance / quoted",
            report.quoted
              ? `${((100 * report.accepted) / report.quoted).toFixed(1)}%`
              : "No quotes",
          ],
          ["Current unresolved (all dates)", report.unresolved],
          ["Current overdue follow-up (all dates)", report.overdue],
          [
            "Supplier commitments confirmed",
            `${report.confirmedSuppliers} / ${report.committedSuppliers}`,
          ],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-[var(--line)] p-4">
            <dt>{k}</dt>
            <dd className="mt-2 text-2xl">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm">
        Elapsed response time includes nights/weekends. Unresponded cases are
        excluded from the median and shown separately. Current statuses can
        change after the period; this is not an historical funnel snapshot.
      </p>
      <div className="my-8 grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="text-xl">Sources</h2>
          {Array.from(report.sources, ([s, n]) => (
            <p key={s}>
              {s}: {n}
            </p>
          ))}
        </section>
        <section>
          <h2 className="text-xl">Current stages, including lost cases</h2>
          {Array.from(report.stages, ([s, n]) => (
            <p key={s}>
              {s}: {n}
            </p>
          ))}
        </section>
      </div>
      <section className="my-8">
        <h2 className="text-xl">Supplier follow-through for this cohort</h2>
        <p>
          Confirmation counts and pending age describe recorded work, not a
          supplier quality score. Contract and cost details stay in the
          financial workspace.
        </p>
        {Array.from(report.supplierMetrics, ([id, g]) => (
          <div key={id} className="my-4 rounded border p-4">
            <h3>
              {g.name} · {g.status}
            </h3>
            <p>
              Confirmed {g.confirmed}/{g.total} · Oldest unconfirmed{" "}
              {g.oldestPending?.toISOString().slice(0, 10) ?? "None"} · Supplier
              review due {g.reviewDue?.toISOString().slice(0, 10) ?? "Not set"}
            </p>
          </div>
        ))}
      </section>
      {report.support && (
        <section className="my-8">
          <h2 className="text-xl">Current support cases</h2>
          {report.support.map((r) => (
            <p key={r.status}>
              {r.status}: {r._count}
            </p>
          ))}
        </section>
      )}
      {internal && (
        <section className="my-8">
          <h2 className="text-xl">Off-site case balances by currency</h2>
          {Array.from(currencies, ([currency, g]) => (
            <div key={currency} className="my-4 rounded border p-4">
              <h3>{currency} · integer minor units</h3>
              <p>
                Collections {g.collections} · Refunded {g.refunds} · Supplier
                payable {g.due}
              </p>
              <p>
                Reviewed contribution {g.contribution} · {g.reviewed}/{g.cases}{" "}
                reviewed cases. Unreviewed contribution is unknown.
              </p>
            </div>
          ))}
          <p>
            Gateway records are separate. Contribution is an operational
            estimate, not statutory profit.
          </p>
        </section>
      )}
      <div className="my-8 flex flex-wrap gap-5">
        <a
          className="underline"
          href={`/staff/reports/export?kind=operations&${query}`}
        >
          Download scoped operations CSV
        </a>
        {internal && (
          <a
            className="underline"
            href={`/staff/reports/export?kind=finance&${query}`}
          >
            Download off-site finance CSV
          </a>
        )}
      </div>
      {actor.role === "ADMIN" && (
        <section>
          <h2 className="text-xl">Public CTA interactions</h2>
          <p>
            Daily click counts, not unique visitors or verified conversions. No
            cookies, contact details, routes, query strings or IP addresses are
            stored by this counter. Counts may include repeat or automated
            clicks.
          </p>
          <ul>
            {report.interactions.map((i) => (
              <li key={`${i.day}-${i.service}-${i.placement}`}>
                {i.day.toISOString().slice(0, 10)} · {i.service} · {i.placement}
                : {i.clicks}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
