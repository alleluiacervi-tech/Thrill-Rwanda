import Link from "next/link";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { GatewaySettlementForm } from "@/components/dashboard/gateway-settlement-form";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { db } from "@/lib/db";
import { paginate } from "@/lib/pagination";
import { dateRange, DATE_RANGES, searchTerm } from "@/lib/table-query";
import { formatQuoteMoney } from "@/lib/quote-rules";
import { paymentRegisterWhere, paymentRowInclude, type PaymentQuery } from "@/lib/collections/register";
import { COLLECTION_METHOD_LABEL, paymentStatusLabel, type CollectionMethod } from "@/lib/collections/rules";
import { getUrubutoProvider } from "@/lib/collections/urubuto";
import { PUBLIC_SERVICES } from "@/lib/launch-rules";

export async function CollectionRegister({ raw, admin }: { raw: PaymentQuery; admin: boolean }) {
  const where = paymentRegisterWhere(raw);
  const page = paginate(raw, await db.collectionAttempt.count({ where }));
  const [rows, accounts, totals, policy] = await Promise.all([
    db.collectionAttempt.findMany({ where, include: paymentRowInclude, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take }),
    db.settlementAccount.findMany({ where: { active: true, method: "BANK_TRANSFER" }, select: { id: true, name: true, currency: true } }),
    db.collectionAttempt.groupBy({
      by: ["currency", "settlementStatus", "method"],
      where: { ...where, status: "SUCCESSFUL" },
      _sum: { amountMinor: true, feeMinor: true },
      _count: { _all: true },
    }),
    db.paymentRoutingPolicy.findUnique({ where: { environment: where.environment as string } }),
  ]);
  const url = admin ? "/admin/payments" : "/staff/finance/collections";
  const query = new URLSearchParams(Object.entries(raw).flatMap(([key, val]) => typeof val === "string" && key !== "page" ? [[key, val]] : []));
  const configuration = getUrubutoProvider();
  const settlement = typeof raw.settlement === "string" ? raw.settlement : "";
  const field = "rounded-lg border border-[var(--line-strong)] bg-white px-3 py-2 text-sm";
  return (
    <>
      <DashboardHead title="Payment collections" lede="Review verified collections and match bank settlement evidence." action={
        <div className="flex flex-wrap gap-2">
          {admin ? <Button variant="accent" href="/admin/payments/routing">Provider settings</Button> : null}
          <Button variant="outline" href={admin ? "/admin/payments?view=legacy" : "/staff/finance"}>{admin ? "Historical payments" : "Finance overview"}</Button>
        </div>
      } />
      <section className="mb-6 rounded-xl border border-[var(--line)] p-4 text-sm">
        <h2 className="text-base font-semibold">UrubutoPay · {where.environment === "live" ? "Production" : "Testing"}</h2>
        <p className="mt-2">{configuration?.enabled && policy?.enabled ? "New collections enabled." : "Digital collections are paused."} Routing methods {policy?.methods.map((method) => COLLECTION_METHOD_LABEL[method as CollectionMethod]).join(", ") || "pending"}.</p>
      </section>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {totals.map((value) => (
          <dl key={`${value.currency}/${value.method}/${value.settlementStatus}`} className="rounded-xl border border-[var(--line)] p-4 text-sm">
            <dt>{COLLECTION_METHOD_LABEL[value.method as CollectionMethod]} · {value.settlementStatus === "SETTLED" ? "Settled" : "Awaiting reconciliation"}</dt>
            <dd className="mt-1 text-xl">{formatQuoteMoney(value._sum.amountMinor ?? 0, value.currency)}</dd>
            <dd>{value._count._all} verified · {value.settlementStatus === "SETTLED"
              ? `${formatQuoteMoney((value._sum.amountMinor ?? 0) - (value._sum.feeMinor ?? 0), value.currency)} net`
              : "Bank credit pending verification"}</dd>
          </dl>
        ))}
      </div>
      <form className="mb-5 flex flex-wrap items-end gap-2" action={url}>
        <label>Search<input className={`ml-1 ${field}`} name="q" defaultValue={searchTerm(raw)} placeholder="Reference or customer" /></label>
        <label>Status<select className={`ml-1 ${field}`} name="status" defaultValue={typeof raw.status === "string" ? raw.status : ""}>
          <option value="">All</option>{Object.entries(paymentStatusLabel).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select></label>
        <label>Method<select className={`ml-1 ${field}`} name="method" defaultValue={typeof raw.method === "string" ? raw.method : ""}>
          <option value="">All</option>{Object.entries(COLLECTION_METHOD_LABEL).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select></label>
        <label>Settlement<select className={`ml-1 ${field}`} name="settlement" defaultValue={settlement}>
          <option value="">All</option><option value="UNRECONCILED">Unreconciled</option><option value="SETTLED">Settled</option><option value="REVIEW">Review</option>
        </select></label>
        <label>Service<select className={`ml-1 ${field}`} name="service" defaultValue={typeof raw.service === "string" ? raw.service : ""}>
          <option value="">All</option>{PUBLIC_SERVICES.map((service) => <option key={service} value={service}>{service.toLowerCase()}</option>)}
        </select></label>
        <label>Period<select className={`ml-1 ${field}`} name="range" defaultValue={raw.range === "today" || dateRange(raw) ? String(raw.range) : ""}>
          <option value="">All time</option><option value="today">Today in Kigali</option>{DATE_RANGES.filter((item) => item.value).map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <Button type="submit" size="sm">Apply</Button>
        <Link href={`/api/payments/collections/export?${query}`} className="rounded p-2 text-sm underline">Export CSV</Link>
      </form>
      {!rows.length ? <p>No collections match this view.</p> : (
        <TableShell>
          <thead><tr><Th>Reference</Th><Th>Customer and service</Th><Th>Payment</Th><Th>Gross collected</Th><Th>Settlement</Th></tr></thead>
          <tbody>{rows.map((row) => {
            const booking = row.invoice.booking;
            const enquiry = row.invoice.financialCase?.enquiry;
            const source = booking?.reference ?? enquiry!.reference;
            const href = booking ? (admin ? `/admin/bookings/${source}` : undefined) : `${admin ? "/admin" : "/staff"}/enquiries/${source}`;
            return (
              <Tr key={row.id}>
                <Td>{href ? <Link className="underline" href={href}>{source}</Link> : source}<span className="block text-xs">{row.providerReference ?? row.merchantReference}</span></Td>
                <Td>{booking?.customer.fullName ?? enquiry?.name}<span className="block text-xs">{booking?.serviceType ?? enquiry?.service}</span></Td>
                <Td>{paymentStatusLabel[row.status]}<span className="block text-xs">{COLLECTION_METHOD_LABEL[row.method as CollectionMethod]} · {row.createdAt.toLocaleDateString("en-GB", { timeZone: "Africa/Kigali" })}</span></Td>
                <Td>{row.status === "SUCCESSFUL" ? formatQuoteMoney(row.amountMinor, row.currency) : <span className="text-xs">Requested {formatQuoteMoney(row.amountMinor, row.currency)}</span>}</Td>
                <Td>{row.settledAt ? `Net ${formatQuoteMoney(row.amountMinor - (row.feeMinor ?? 0), row.currency)}`
                  : (row.status === "SUCCESSFUL" && row.settlementStatus !== "REVIEW")
                    ? <GatewaySettlementForm attemptId={row.id} currency={row.currency} accounts={accounts.filter((account) => account.currency === row.currency)} />
                    : row.settlementStatus === "REVIEW" ? "Finance review" : "Awaiting verification"}</Td>
              </Tr>
            );
          })}</tbody>
        </TableShell>
      )}
      <Pagination page={page} pathname={url} params={raw} label="collections" />
    </>
  );
}
