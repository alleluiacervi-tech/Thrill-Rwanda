import { AlertTriangle } from "lucide-react";
import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { SelectFilter } from "@/components/dashboard/select-filter";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/primitives";
import { SortTh } from "@/components/dashboard/sort-header";
import { TableSearch } from "@/components/dashboard/table-search";
import { DATE_RANGES, dateRange, searchTerm, sortOrder } from "@/lib/table-query";
import { Pagination } from "@/components/ui/pagination";
import { paginate } from "@/lib/pagination";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatMoney } from "@/lib/utils";
import type { PaymentStatus } from "@/generated/prisma/enums";



const STATUSES = new Set(["INITIATED", "PENDING", "SUCCEEDED", "FAILED", "REFUNDED"]);

const TONE: Record<PaymentStatus, "forest" | "clay" | "sun" | "outline"> = {
  SUCCEEDED: "forest",
  PENDING: "clay",
  INITIATED: "clay",
  FAILED: "sun",
  REFUNDED: "outline",
};

const METHOD_LABEL: Record<string, string> = {
  MPESA: "Mobile money",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
};

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/payments");

  const raw = await searchParams;
  const statusParam = Array.isArray(raw.status) ? raw.status[0] : raw.status;
  const status =
    statusParam && STATUSES.has(statusParam) ? (statusParam as PaymentStatus) : "";

  const q = searchTerm(raw);
  const createdAt = dateRange(raw);

  const where = {
    ...(status ? { status } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(q
      ? {
          OR: [
            { transactionId: { contains: q, mode: "insensitive" as const } },
            { merchantReference: { contains: q, mode: "insensitive" as const } },
            { booking: { reference: { contains: q, mode: "insensitive" as const } } },
            { booking: { customer: { fullName: { contains: q, mode: "insensitive" as const } } } },
            { booking: { customer: { email: { contains: q, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };

  const { orderBy, sort, dir } = sortOrder(
    raw,
    [
      { value: "created", orderBy: { createdAt: true } },
      { value: "amount", orderBy: { amountMinor: true } },
      { value: "status", orderBy: { status: true } },
    ],
    { createdAt: "desc" },
  );
  const page = paginate(raw, await db.payment.count({ where }));

  const [payments, counts, collected, refunded] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy,
      skip: page.skip,
      take: page.take,
      include: {
        booking: {
          select: {
            reference: true,
            serviceType: true,
            customer: { select: { fullName: true, email: true } },
            provider: { select: { businessName: true } },
          },
        },
      },
    }),
    db.payment.groupBy({ by: ["status"], _count: { _all: true } }),
    db.payment.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amountMinor: true } }),
    db.payment.aggregate({ where: { status: "REFUNDED" }, _sum: { amountMinor: true } }),
  ]);

  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const total = counts.reduce((n, c) => n + c._count._all, 0);

  const net = (collected._sum.amountMinor ?? 0) - (refunded._sum.amountMinor ?? 0);

  return (
    <>
      <DashboardHead
        title="Payments"
        lede="Every payment attempt Pesapal has reported, newest first. This ledger is read-only — money is moved by Pesapal, never from here."
      />

      <dl className="mb-6 grid gap-3 sm:grid-cols-3">
        <Figure label="Collected" value={formatMoney(collected._sum.amountMinor ?? 0)} />
        <Figure label="Refunded" value={formatMoney(refunded._sum.amountMinor ?? 0)} />
        <Figure label="Net" value={formatMoney(net)} strong />
      </dl>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <TableSearch
          pathname="/admin/payments"
          placeholder="Search reference, transaction id or customer"
        />
        <SelectFilter
          pathname="/admin/payments"
          param="range"
          options={DATE_RANGES}
          label="Filter by date"
          className="w-44"
        />
      </div>

      <FilterChips
        basePath="/admin/payments"
        param="status"
        current={status}
        label="Filter by payment status"
        chips={[
          { value: "", label: "All", count: total },
          { value: "SUCCEEDED", label: "Succeeded", count: countOf("SUCCEEDED") },
          { value: "PENDING", label: "Pending", count: countOf("PENDING") },
          { value: "INITIATED", label: "Initiated", count: countOf("INITIATED") },
          { value: "FAILED", label: "Failed", count: countOf("FAILED") },
          { value: "REFUNDED", label: "Refunded", count: countOf("REFUNDED") },
        ]}
      />

      {payments.length === 0 ? (
        <EmptyPanel
          title={status ? "No payments with that status" : "No payments yet"}
          body={
            status
              ? "Try another status filter."
              : "Nothing has been settled through Pesapal yet. A row lands here the moment a customer opens a checkout from their booking."
          }
        />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Booking</Th>
              <Th>Customer</Th>
              <Th>Method</Th>
              <SortTh value="amount" pathname="/admin/payments" params={raw} active={sort} dir={dir} className="text-right">
                Amount
              </SortTh>
              <SortTh value="status" pathname="/admin/payments" params={raw} active={sort} dir={dir}>
                Status
              </SortTh>
              <Th>Pesapal ref</Th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <Tr key={p.id}>
                <Td>
                  <span className="block font-medium">{p.booking.reference}</span>
                  <span className="block max-w-[14rem] truncate text-2xs text-[var(--ink-faint)]">
                    {p.booking.provider.businessName}
                  </span>
                </Td>
                <Td>
                  <span className="block max-w-[12rem] truncate">
                    {p.booking.customer.fullName}
                  </span>
                  <span className="block max-w-[12rem] truncate text-2xs text-[var(--ink-faint)]">
                    {p.booking.customer.email}
                  </span>
                </Td>
                <Td>{METHOD_LABEL[p.method] ?? p.method}</Td>
                <Td className="tnum whitespace-nowrap text-right">
                  {formatMoney(p.amountMinor, p.currency)}
                </Td>
                <Td>
                  <Badge tone={TONE[p.status]}>{p.status}</Badge>
                  {p.paidAt ? (
                    <span className="mt-1 block text-2xs text-[var(--ink-faint)]">
                      {p.paidAt.toISOString().slice(0, 10)}
                    </span>
                  ) : null}
                </Td>
                <Td>
                  {/* Pesapal's own tracking id — what you quote when
                      reconciling against a Pesapal settlement report or
                      raising a dispute with them. */}
                  <span className="tnum block max-w-[12rem] truncate text-2xs">
                    {p.transactionId ?? "—"}
                  </span>
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <Pagination page={page} pathname="/admin/payments" params={raw} label="payments" />

      {/* The text lives in its own span: this row is a flex container, so an
          inline element mixed with bare text would make each run a separate
          flex item and break the sentence into columns. */}
      <p className="mt-6 flex items-start gap-3 rounded-[var(--radius-inset)] border border-[var(--line)] bg-[var(--paper-sunken)] p-4 text-2xs leading-relaxed text-[var(--ink-muted)]">
        <AlertTriangle className="mt-px size-4 shrink-0 text-clay-700" />
        <span>
          Figures come from the payments table, not from bookings. A booking
          marked paid without a matching Pesapal payment row will not appear
          here — that mismatch is the thing to watch for.
        </span>
      </p>
    </>
  );
}

function Figure({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-4">
      <dt className="text-2xs uppercase tracking-[0.14em] text-[var(--ink-faint)]">
        {label}
      </dt>
      <dd
        className={
          strong
            ? "tnum mt-1.5 font-display text-2xl font-semibold text-forest-800"
            : "tnum mt-1.5 font-display text-2xl font-semibold"
        }
      >
        {value}
      </dd>
    </div>
  );
}
