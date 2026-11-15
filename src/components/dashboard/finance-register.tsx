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
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
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
  return (
    <>
      <DashboardHead
        title="Supplier register"
        lede="Internal fulfilment evidence, permissions and review records. A provider login is not proof of a supplier agreement."
      />
      {(admin || operational) && <SupplierEditor admin={admin} />}
      <div className="mt-6 space-y-5">
        {suppliers.map((s) => (
          <article
            key={s.id}
            className="min-w-0 rounded-xl border border-[var(--line)] p-5"
          >
            <h2 className="text-xl">
              {s.name} · {s.category}
            </h2>
            <p>
              {s.status} · {s.serviceArea} · {s.currencies.join(", ")}
            </p>
            <p className="mt-2 whitespace-pre-wrap">{s.deliverables}</p>
            <p className="whitespace-pre-wrap">Limitations: {s.limitations}</p>
            {(admin || operational || financial) && (
              <p className="mt-2 whitespace-pre-wrap">
                Contact: {s.contact}
                <br />
                Escalation: {s.escalation}
              </p>
            )}
            {financial && (
              <>
                <p className="mt-2 whitespace-pre-wrap">
                  Commercial terms: {s.commercialTerms}
                </p>
                <p className="whitespace-pre-wrap">
                  Agreement evidence: {s.agreementEvidence}
                </p>
              </>
            )}
            <p className="mt-2">
              Publication:{" "}
              {s.publicationAllowed
                ? s.approvedWording
                : "No permission recorded"}
            </p>
            {(admin || operational || financial) && (
              <p className="whitespace-pre-wrap">
                Performance: {s.performanceNotes || "No issues recorded"}
                <br />
                Next review:{" "}
                {s.nextReviewAt?.toLocaleString("en-GB", {
                  timeZone: "Africa/Kigali",
                }) ?? "Not scheduled"}
              </p>
            )}
            {(admin || (operational && s.status === "DRAFT")) && (
              <SupplierEditor key={s.version} supplier={s} admin={admin} />
            )}
          </article>
        ))}
      </div>
      {!suppliers.length && <p>No accessible supplier records.</p>}
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
  return (
    <>
      <DashboardHead
        title="Off-site finance"
        lede="All-time recorded off-site cases, grouped by currency. Legacy Pesapal collections are separate and are not added to these totals."
      />
      <p>
        These are operational balances, not statutory profit or bank statements.
        Accepted quotes without a financial case are not included. Contribution
        is a subtotal of reviewed cases only; unallocated reconciled cash
        remains a customer liability.
      </p>
      <div className="mt-5 space-y-5">
        {[...totals].map(([currency, g]) => (
          <section key={currency} className="rounded-xl border p-5">
            <h2 className="text-2xl">
              {currency} · {g.cases} case(s)
            </h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              {[
                ["Accepted quote value", g.quoteValue],
                ["Quoted ticket / supplier value", g.supplierQuotedValue],
                ["Current agreed customer charges", g.agreedCharge],
                ["Reconciled allocated collections", g.collections],
                ["Unallocated reconciled cash (liability)", g.held],
                ["Unverified receipt total", g.pending],
                ["Customer refunds paid", g.refundsPaid],
                ["Customer refunds still owed", g.refundDue],
                ["Agreed service fees", g.fees],
                ["Supplier net costs", g.supplierCost],
                ["Supplier payables", g.supplierDue],
                ["Supplier recoverables", g.supplierRecoverable],
                ["External commission received", g.commissions],
                ["Payment charges", g.charges],
                ["Tax / other pass-through reserve", g.reserve],
                ["Reviewed contribution subtotal", g.reviewedContribution],
                ["Case cash position + held cash", g.cash + g.held],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm">{label}</dt>
                  <dd className="font-semibold">
                    {formatQuoteMoney(value as number, currency)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4">
              Commercial review complete for {g.reviewedCases}/{g.cases} cases.
              Gross collections are not retained revenue or profit.
            </p>
          </section>
        ))}
      </div>
      <h2 className="mt-8 text-xl">Tracked cases</h2>
      <ul>
        {cases.map((c) => (
          <li key={c.id} className="mt-2 rounded border p-3">
            <Link
              className="underline"
              href={`/staff/enquiries/${c.enquiry.reference}`}
            >
              {c.enquiry.reference}
            </Link>{" "}
            · {c.enquiry.status} · {c.currency} · balance{" "}
            {formatQuoteMoney(financialSummary(c).customerBalance, c.currency)}{" "}
            · refund due{" "}
            {formatQuoteMoney(financialSummary(c).refundDue, c.currency)}
          </li>
        ))}
      </ul>
      <h2 className="mt-8 text-xl">Approved off-site settlement accounts</h2>
      <p>
        Use one canonical code for each physical account/currency and consistent
        statement identifiers. This register does not connect to banks or
        activate payment gateways. Never enter login/API secrets.
      </p>
      {actor.role === "ADMIN" && (
        <FinanceForm
          kind="account"
          title="Approve a settlement account"
          hidden={{ intentKey: randomUUID() }}
          fields={[
            {
              name: "code",
              label: "Unique canonical account code",
              required: true,
            },
            { name: "name", label: "Company account label", required: true },
            {
              name: "method",
              label: "Approved method",
              options: METHODS.map((value) => ({ value, label: value })),
              required: true,
            },
            {
              name: "currency",
              label: "Currency",
              options: QUOTE_CURRENCIES.map((value) => ({
                value,
                label: value,
              })),
              required: true,
            },
            {
              name: "instructions",
              label: "Approved customer payment instructions",
              type: "textarea",
              required: true,
            },
            {
              name: "approvalEvidence",
              label: "Company approval / account ownership evidence",
              type: "textarea",
              required: true,
            },
          ]}
        />
      )}
      <ul>
        {accounts.map((a) => (
          <li key={a.id} className="mt-3 rounded border p-4">
            <h3>
              {a.code} · {a.name} · {a.method} · {a.currency} ·{" "}
              {a.active ? "Active" : "Disabled"}
            </h3>
            <p className="whitespace-pre-wrap">{a.instructions}</p>
            <p className="whitespace-pre-wrap">
              Approval: {a.approvalEvidence}
            </p>
            {actor.role === "ADMIN" && (
              <FinanceForm
                key={a.version}
                kind="accountStatus"
                title={
                  a.active ? "Disable for new records" : "Reactivate account"
                }
                hidden={{
                  id: a.id,
                  version: a.version,
                  active: String(!a.active),
                }}
                fields={[
                  {
                    name: "evidence",
                    label: "Approval evidence and reason",
                    type: "textarea",
                    required: true,
                  },
                ]}
              />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
