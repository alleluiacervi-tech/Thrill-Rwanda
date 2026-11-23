import { SupplierReviews } from "@/components/dashboard/supplier-reviews";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { financeInclude } from "@/lib/finance";
import {
  canFinance,
  financialSummary,
  METHODS,
  SUPPLIER_CATEGORIES,
} from "@/lib/finance-rules";
import {
  formatQuoteMoney,
  QUOTE_CURRENCIES,
  type QuoteSnapshot,
} from "@/lib/quote-rules";
import {
  FinanceForm,
  type FormField,
} from "@/components/dashboard/finance-forms";
import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { Panel, StatGrid, StatTile, StatusPill } from "@/components/dashboard/dash-ui";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { label } from "@/lib/enquiry-workflow";
import type { Supplier } from "@/generated/prisma/client";

function SupplierEditor({
  supplier,
  admin,
}: {
  supplier?: Supplier;
  admin: boolean;
}) {
  const fields: FormField[] = [
    {
      name: "name",
      label: "Supplier legal / business name",
      value: supplier?.name,
      required: true,
    },
    {
      name: "category",
      label: "Service category",
      value: supplier?.category,
      required: true,
      options: SUPPLIER_CATEGORIES.map((value) => ({ value, label: value })),
    },
    {
      name: "contact",
      label: "Approved operational contact",
      value: supplier?.contact,
      required: true,
    },
    {
      name: "escalation",
      label: "Escalation / urgent contact",
      value: supplier?.escalation,
      required: true,
    },
    {
      name: "serviceArea",
      label: "Service area",
      value: supplier?.serviceArea,
      required: true,
    },
    {
      name: "currencies",
      label: "Accepted currencies (comma separated USD, EUR, GBP, RWF)",
      value: supplier?.currencies.join(",") ?? "USD",
      required: true,
    },
    {
      name: "deliverables",
      label: "Deliverables and capacity",
      type: "textarea",
      value: supplier?.deliverables,
      required: true,
    },
    {
      name: "limitations",
      label: "Exclusions / limitations",
      type: "textarea",
      value: supplier?.limitations,
      required: true,
    },
    {
      name: "commercialTerms",
      label: "Rates, payment, commission and cancellation terms",
      type: "textarea",
      value: supplier?.commercialTerms,
      required: true,
    },
    {
      name: "agreementEvidence",
      label: "Contract / rate sheet / written authorization evidence",
      type: "textarea",
      value: supplier?.agreementEvidence,
      required: true,
    },
    {
      name: "performanceNotes",
      label: "Reliability / issues / complaints",
      type: "textarea",
      value: supplier?.performanceNotes,
    },
    {
      name: "nextReviewAt",
      label: "Next review (Kigali, UTC+2)",
      type: "datetime-local",
      value: supplier?.nextReviewAt
        ? new Date(supplier.nextReviewAt.getTime() + 7200000)
            .toISOString()
            .slice(0, 16)
        : "",
    },
    {
      name: "publicationAllowed",
      label: "Written permission to publish name / logo has been obtained",
      type: "checkbox",
      value: String(supplier?.publicationAllowed ?? false),
    },
    {
      name: "approvedWording",
      label: "Exact authorized public wording (required if permission checked)",
      type: "textarea",
      value: supplier?.approvedWording,
    },
  ];
  if (admin)
    fields.push({
      name: "status",
      label: "Approval status",
      value: supplier?.status ?? "DRAFT",
      required: true,
      options: ["DRAFT", "APPROVED", "SUSPENDED"].map((value) => ({
        value,
        label: value,
      })),
    });
  return (
    <FinanceForm
      kind="supplier"
      title={supplier ? `Edit ${supplier.name}` : "Register a supplier draft"}
      hidden={{
        intentKey: randomUUID(),
        id: supplier?.id ?? "",
        version: supplier?.version ?? 0,
        ...(admin ? {} : { status: "DRAFT" }),
      }}
      fields={fields}
      description="Only administrators approve or suspend suppliers. Approval must reflect actual written authority and reliable fulfilment. No supplier details are published by saving this register."
      submit="Save supplier"
    />
  );
}
export async function SupplierRegister() {
  const actor = await requireEnquiryStaff();
  const admin = actor.role === "ADMIN",
    operational = actor.staffRole === "OPERATIONS",
    financial = canFinance(actor);
  const suppliers = await db.supplier.findMany({
    where:
      admin || financial
        ? {}
        : operational
          ? { status: { in: ["DRAFT", "APPROVED"] } }
          : { status: "APPROVED" },
    orderBy: { name: "asc" },
  });
  const reviewDue = suppliers.filter((s) => s.nextReviewAt && s.nextReviewAt.getTime() < new Date().getTime()).length;
  const field = (name: string, value: React.ReactNode) => (
    <div className="min-w-0">
      <dt className="text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">{name}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value}</dd>
    </div>
  );
  return (
    <>
      <DashboardHead
        title="Suppliers"
        lede="Fulfilment partners, their agreements and review dates."
      />
      <StatGrid cols={3}>
        <StatTile label="Suppliers" value={suppliers.length} />
        <StatTile label="Approved" value={suppliers.filter((s) => s.status === "APPROVED").length} tone="good" />
        <StatTile label="Review overdue" value={reviewDue} tone={reviewDue ? "alert" : "good"} />
      </StatGrid>
      {(admin || operational) && (
        <div className="mb-6">
          <SupplierEditor admin={admin} />
        </div>
      )}
      {suppliers.length === 0 ? (
        <EmptyPanel title="No suppliers yet" body="Registered suppliers will be listed here." />
      ) : (
        <div className="grid gap-4">
          {suppliers.map((s) => (
            <Panel
              key={s.id}
              title={s.name}
              description={`${label(s.category)} · ${s.serviceArea} · ${s.currencies.join(", ")}`}
              aside={
                <StatusPill tone={s.status === "APPROVED" ? "good" : s.status === "SUSPENDED" ? "alert" : "neutral"}>
                  {label(s.status)}
                </StatusPill>
              }
            >
              <dl className="grid gap-5 sm:grid-cols-2">
                {field("Deliverables", s.deliverables)}
                {field("Limitations", s.limitations)}
                {(admin || operational || financial) && field("Contact", `${s.contact}\nEscalation: ${s.escalation}`)}
                {financial && field("Commercial terms", s.commercialTerms)}
                {financial && field("Agreement evidence", s.agreementEvidence)}
                {field("Public wording", s.publicationAllowed ? s.approvedWording : "No permission recorded")}
                {(admin || operational || financial) &&
                  field("Performance", s.performanceNotes || "No issues recorded")}
                {(admin || operational || financial) &&
                  field(
                    "Next review",
                    s.nextReviewAt?.toLocaleDateString("en-GB", { timeZone: "Africa/Kigali", day: "numeric", month: "short", year: "numeric" }) ?? "Not scheduled",
                  )}
              </dl>
              {(admin || (operational && s.status === "DRAFT")) && (
                <div className="mt-4">
                  <SupplierEditor key={s.version} supplier={s} admin={admin} />
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}
      <SupplierReviews />
    </>
  );
}
export async function FinanceReport() {
  const actor = await requireEnquiryStaff();
  if (!canFinance(actor)) redirect("/staff/enquiries");
  const [cases, receipts, accounts] = await Promise.all([
    db.financialCase.findMany({
      include: {
        ...financeInclude,
        enquiry: { select: { reference: true, status: true } },
        quote: { select: { totalMinor: true, snapshot: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.offsiteReceipt.findMany({ include: { proof: true, allocations: true } }),
    db.settlementAccount.findMany({ orderBy: { code: "asc" } }),
  ]);
  type Totals = {
    cases: number;
    reviewedCases: number;
    quoteValue: number;
    supplierQuotedValue: number;
    agreedCharge: number;
    collections: number;
    refundsPaid: number;
    refundDue: number;
    fees: number;
    supplierCost: number;
    supplierDue: number;
    supplierRecoverable: number;
    commissions: number;
    charges: number;
    reserve: number;
    reviewedContribution: number;
    cash: number;
    held: number;
    pending: number;
  };
  const totals = new Map<string, Totals>();
  const group = (currency: string) => {
    let g = totals.get(currency);
    if (!g) {
      g = {
        cases: 0,
        reviewedCases: 0,
        quoteValue: 0,
        supplierQuotedValue: 0,
        agreedCharge: 0,
        collections: 0,
        refundsPaid: 0,
        refundDue: 0,
        fees: 0,
        supplierCost: 0,
        supplierDue: 0,
        supplierRecoverable: 0,
        commissions: 0,
        charges: 0,
        reserve: 0,
        reviewedContribution: 0,
        cash: 0,
        held: 0,
        pending: 0,
      };
      totals.set(currency, g);
    }
    return g;
  };
  for (const data of cases) {
    const s = financialSummary(data),
      g = group(data.currency);
    g.cases++;
    g.quoteValue += data.quote.totalMinor;
    g.supplierQuotedValue += (data.quote.snapshot as QuoteSnapshot).items
      .filter((i) => i.kind === "SUPPLIER")
      .reduce((n, i) => n + i.totalMinor, 0);
    g.agreedCharge += data.customerChargeMinor;
    g.collections += s.collections;
    g.refundsPaid += s.customerRefunds;
    g.refundDue += s.refundDue;
    g.fees += s.serviceFees;
    g.supplierCost += s.supplierCost;
    g.supplierDue += s.supplierDue;
    g.supplierRecoverable += s.supplierRecoveryDue;
    g.commissions += s.commissions;
    g.charges += s.charges;
    g.reserve += s.passThroughReserve;
    g.cash += s.cashPosition;
    if (s.contribution !== null) {
      g.reviewedCases++;
      g.reviewedContribution += s.contribution;
    }
  }
  for (const r of receipts) {
    const g = group(r.proof.currency);
    if (r.status === "RECONCILED")
      g.held +=
        r.proof.amountMinor -
        r.allocations
          .filter((a) => a.status === "ACTIVE")
          .reduce((n, a) => n + a.amountMinor, 0);
    if (r.status === "PENDING") g.pending += r.proof.amountMinor;
  }
  for (const g of totals.values())
    if (Object.values(g).some((value) => !Number.isSafeInteger(value)))
      throw new Error("Report exceeds integer precision");
  const money = (v: number, c: string) => formatQuoteMoney(v, c);
  return (
    <>
      <DashboardHead
        title="Off-site finance"
        lede="Recorded off-site cases by currency. Operating balances, not statutory profit or bank statements."
      />
      {totals.size === 0 ? (
        <EmptyPanel title="No financial cases yet" body="Totals appear once an accepted quote has a financial case." />
      ) : null}
      <div className="grid gap-6">
        {[...totals].map(([currency, g]) => (
          <section key={currency}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{currency}</h2>
              <span className="text-xs text-[var(--ink-muted)]">
                {g.cases} {g.cases === 1 ? "case" : "cases"} · {g.reviewedCases} reviewed
              </span>
            </div>
            <StatGrid>
              <StatTile label="Collected" value={money(g.collections, currency)} note="reconciled, allocated" tone="good" />
              <StatTile label="Held cash" value={money(g.held, currency)} note="unallocated liability" />
              <StatTile label="Supplier payable" value={money(g.supplierDue, currency)} tone={g.supplierDue ? "alert" : "default"} />
              <StatTile label="Contribution" value={money(g.reviewedContribution, currency)} note="reviewed cases only" />
            </StatGrid>
            <details className="group rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-sm font-medium">
                Full breakdown
                <span aria-hidden className="text-lg leading-none text-[var(--ink-faint)] transition-transform group-open:rotate-45">+</span>
              </summary>
              <dl className="grid gap-x-8 gap-y-4 border-t border-[var(--line)] p-5 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Accepted quote value", g.quoteValue],
                  ["Quoted supplier value", g.supplierQuotedValue],
                  ["Agreed customer charges", g.agreedCharge],
                  ["Unverified receipts", g.pending],
                  ["Refunds paid", g.refundsPaid],
                  ["Refunds still owed", g.refundDue],
                  ["Agreed service fees", g.fees],
                  ["Supplier net costs", g.supplierCost],
                  ["Supplier recoverables", g.supplierRecoverable],
                  ["Commission received", g.commissions],
                  ["Payment charges", g.charges],
                  ["Tax and pass-through reserve", g.reserve],
                  ["Cash position incl. held", g.cash + g.held],
                ].map(([name, value]) => (
                  <div key={name}>
                    <dt className="text-xs text-[var(--ink-muted)]">{name}</dt>
                    <dd className="tnum mt-0.5 font-medium">{money(value as number, currency)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </section>
        ))}
      </div>

      {cases.length > 0 && (
        <Panel title="Tracked cases" className="mt-8" flush>
          <TableShell className="rounded-none border-0" dense>
            <thead>
              <tr><Th>Enquiry</Th><Th>Stage</Th><Th>Currency</Th><Th>Balance</Th><Th>Refund due</Th></tr>
            </thead>
            <tbody>
              {cases.map((c) => {
                const s = financialSummary(c);
                return (
                  <Tr key={c.id}>
                    <Td><Link className="font-mono text-xs hover:underline" href={`/staff/enquiries/${c.enquiry.reference}`}>{c.enquiry.reference}</Link></Td>
                    <Td><StatusPill tone="info">{label(c.enquiry.status)}</StatusPill></Td>
                    <Td>{c.currency}</Td>
                    <Td className="tnum">{money(s.customerBalance, c.currency)}</Td>
                    <Td className="tnum">{money(s.refundDue, c.currency)}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableShell>
        </Panel>
      )}

      <Panel
        title="Settlement accounts"
        description="One code per physical account and currency. Never enter login or API secrets here."
        className="mt-8"
      >
        {actor.role === "ADMIN" && (
          <FinanceForm
            kind="account"
            title="Approve a settlement account"
            hidden={{ intentKey: randomUUID() }}
            fields={[
              { name: "code", label: "Unique canonical account code", required: true },
              { name: "name", label: "Company account label", required: true },
              { name: "method", label: "Approved method", options: METHODS.map((value) => ({ value, label: value })), required: true },
              { name: "currency", label: "Currency", options: QUOTE_CURRENCIES.map((value) => ({ value, label: value })), required: true },
              { name: "instructions", label: "Approved customer payment instructions", type: "textarea", required: true },
              { name: "approvalEvidence", label: "Company approval / account ownership evidence", type: "textarea", required: true },
            ]}
          />
        )}
        <ul className="mt-4 grid gap-3">
          {accounts.map((a) => (
            <li key={a.id} className="rounded-[var(--radius-card)] border border-[var(--line)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  <span className="font-mono text-xs">{a.code}</span> · {a.name}
                </p>
                <div className="flex gap-2">
                  <StatusPill>{a.method}</StatusPill>
                  <StatusPill>{a.currency}</StatusPill>
                  <StatusPill tone={a.active ? "good" : "alert"}>{a.active ? "Active" : "Disabled"}</StatusPill>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--ink-muted)]">{a.instructions}</p>
              {actor.role === "ADMIN" && (
                <FinanceForm
                  key={a.version}
                  kind="accountStatus"
                  title={a.active ? "Disable for new records" : "Reactivate account"}
                  hidden={{ id: a.id, version: a.version, active: String(!a.active) }}
                  fields={[{ name: "evidence", label: "Approval evidence and reason", type: "textarea", required: true }]}
                />
              )}
            </li>
          ))}
        </ul>
      </Panel>
      <p className="mt-6 max-w-3xl text-xs leading-relaxed text-[var(--ink-faint)]">
        Legacy gateway collections are separate and not included. Accepted quotes without a financial case are excluded.
        Contribution covers reviewed cases only, and unallocated reconciled cash remains a customer liability.
      </p>
    </>
  );
}
