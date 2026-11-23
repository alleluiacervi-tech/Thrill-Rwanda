import Link from "next/link";
import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { Panel, StatGrid, StatTile, StatusPill } from "@/components/dashboard/dash-ui";
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
  const field = "h-9 rounded border border-[var(--line-strong)] bg-[var(--paper-raised)] px-3 text-sm font-normal text-[var(--ink)]";
  return (
    <>
      <DashboardHead title="Payment collections" lede="Review verified collections and match bank settlement evidence." action={
        <div className="flex flex-wrap gap-2">
          {admin ? <Button variant="accent" href="/admin/payments/routing">Provider settings</Button> : null}
          <Button variant="outline" href={admin ? "/admin/payments?view=legacy" : "/staff/finance"}>{admin ? "Historical payments" : "Finance overview"}</Button>
        </div>
      } />
      <Panel
        className="mb-6"
        title={"UrubutoPay · " + (where.environment === "live" ? "Production" : "Testing")}
        description={"Methods: " + (policy?.methods.map((method) => COLLECTION_METHOD_LABEL[method as CollectionMethod]).join(", ") || "pending")}
        aside={<StatusPill tone={configuration?.enabled && policy?.enabled ? "good" : "warn"}>{configuration?.enabled && policy?.enabled ? "Collections on" : "Collections paused"}</StatusPill>}
      >
        <p className="text-sm text-[var(--ink-muted)]">{configuration?.enabled && policy?.enabled ? "New digital collections are being accepted." : "New digital collections are paused. Existing records stay visible."}</p>
      </Panel>
      <StatGrid cols={3}>
        {totals.map((value) => (
          <StatTile
            key={`${value.currency}/${value.method}/${value.settlementStatus}`}
            label={COLLECTION_METHOD_LABEL[value.method as CollectionMethod] + " · " + (value.settlementStatus === "SETTLED" ? "Settled" : "Unreconciled")}
            value={formatQuoteMoney(value._sum.amountMinor ?? 0, value.currency)}
            tone={value.settlementStatus === "SETTLED" ? "good" : "default"}
            note={value._count._all + " verified" + (value.settlementStatus === "SETTLED" ? " · " + formatQuoteMoney((value._sum.amountMinor ?? 0) - (value._sum.feeMinor ?? 0), value.currency) + " net" : " · bank credit pending")}
          />
        ))}
      </StatGrid>
      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-3 text-xs font-medium text-[var(--ink-muted)] [&_label]:grid [&_label]:gap-1" action={url}>
        <label>Search<input className={field} name="q" defaultValue={searchTerm(raw)} placeholder="Reference or customer" /></label>
        <label>Status<select className={field} name="status" defaultValue={typeof raw.status === "string" ? raw.status : ""}>
          <option value="">All</option>{Object.entries(paymentStatusLabel).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select></label>
        <label>Method<select className={field} name="method" defaultValue={typeof raw.method === "string" ? raw.method : ""}>
          <option value="">All</option>{Object.entries(COLLECTION_METHOD_LABEL).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select></label>
        <label>Settlement<select className={field} name="settlement" defaultValue={settlement}>
          <option value="">All</option><option value="UNRECONCILED">Unreconciled</option><option value="SETTLED">Settled</option><option value="REVIEW">Review</option>
        </select></label>
        <label>Service<select className={field} name="service" defaultValue={typeof raw.service === "string" ? raw.service : ""}>
          <option value="">All</option>{PUBLIC_SERVICES.map((service) => <option key={service} value={service}>{service.toLowerCase()}</option>)}
        </select></label>
        <label>Period<select className={field} name="range" defaultValue={raw.range === "today" || dateRange(raw) ? String(raw.range) : ""}>
          <option value="">All time</option><option value="today">Today in Kigali</option>{DATE_RANGES.filter((item) => item.value).map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <Button type="submit" size="sm">Apply</Button>
        <Link href={`/api/payments/collections/export?${query}`} className="ml-auto inline-flex h-9 items-center text-sm font-medium text-lake-700 hover:underline">Export CSV</Link>
      </form>
      {!rows.length ? <EmptyPanel title="No collections" body="Nothing matches this view." /> : (
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
                <Td><StatusPill tone={row.status === "SUCCESSFUL" ? "good" : "neutral"}>{paymentStatusLabel[row.status]}</StatusPill><span className="block text-xs">{COLLECTION_METHOD_LABEL[row.method as CollectionMethod]} · {row.createdAt.toLocaleDateString("en-GB", { timeZone: "Africa/Kigali" })}</span></Td>
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
