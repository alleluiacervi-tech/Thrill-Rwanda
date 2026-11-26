import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { financeInclude } from "@/lib/finance";
import {
  canFinance,
  canOperate,
  commitmentBalance,
  financialSummary,
  refundBalance,
  type FinanceCommand,
} from "@/lib/finance-rules";
import { formatQuoteMoney, type QuoteSnapshot } from "@/lib/quote-rules";
import {
  FinanceForm,
  type FormField,
} from "@/components/dashboard/finance-forms";
import type { EnquiryActor } from "@/lib/enquiry-workflow";
import { ChangeSummary } from "@/components/dashboard/change-summary";

export async function FinancialWorkspace({
  enquiry,
  actor,
}: {
  enquiry: {
    id: string;
    reference: string;
    version: number;
    status: string;
    ownerId: string | null;
  };
  actor: EnquiryActor;
}) {
  const acceptance = await db.quoteAcceptance.findUnique({
    where: { enquiryId: enquiry.id },
    include: { quote: true },
  });
  if (!acceptance)
    return (
      <section className="mt-8">
        <h2 className="text-xl">Payments and supplier fulfilment</h2>
        <p>
          Financial records require an accepted written quote. Recording a
          request does not create a booking or payment.
        </p>
      </section>
    );
  const internal = canFinance(actor),
    operate = canOperate(actor, enquiry.ownerId);
  const snapshot = acceptance.quote.snapshot as QuoteSnapshot;
  const currency = acceptance.quote.currency;
  const stored = await db.financialCase.findUnique({
    where: { enquiryId: enquiry.id },
    include: { ...financeInclude, fulfilment: true },
  });
  const fee = snapshot.items
    .filter((line) => line.kind === "SERVICE_FEE")
    .reduce((n, line) => n + line.totalMinor, 0);
  const reserve = snapshot.items
    .filter((line) => ["TAX", "OTHER"].includes(line.kind))
    .reduce((n, line) => n + line.totalMinor, 0);
  const current = stored ?? {
    currency,
    customerChargeMinor: snapshot.totalMinor,
    serviceFeeMinor: fee,
    taxReserveMinor: reserve,
    requiredFundingMinor: snapshot.totalMinor,
    reviewed: false,
    entries: [],
    commitments: [],
    refunds: [],
  };
  const summary = financialSummary(current);
  const fmt = (minor: number) => formatQuoteMoney(minor, currency);
  const units = (minor: number) =>
    currency === "RWF" ? String(minor) : (minor / 100).toFixed(2);
  const accounts = await db.settlementAccount.findMany({
    where: { active: true, currency },
    select: { id: true, code: true, name: true, method: true },
  });
  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: `${a.code} · ${a.method} · ${a.name}`,
  }));
  const supplierOptions = internal
    ? (
        await db.supplier.findMany({
          where: { status: "APPROVED", currencies: { has: currency } },
          select: { id: true, name: true },
        })
      ).map((s) => ({ value: s.id, label: s.name }))
    : [];
  const commitments =
    stored?.commitments.map((c) => ({
      value: c.id,
      label: `${c.supplier.name} · ${c.label}`,
    })) ?? [];
  const evidence: FormField = {
    name: "evidence",
    label: "Verified evidence / approval reference and reason",
    type: "textarea",
    required: true,
  };
  const amount: FormField = {
    name: "amount",
    label: `Amount (${currency})`,
    required: true,
  };
  const target = (
    options: { value: string; label: string }[],
    label: string,
  ): FormField => ({ name: "targetId", label, options, required: true });
  const account: FormField = {
    name: "accountId",
    label: "Approved settlement account",
    options: accountOptions,
    required: true,
  };
  const external: FormField = {
    name: "externalRef",
    label: "Unique bank/statement/order reference",
    required: true,
  };
  const date: FormField = {
    name: "date",
    label: "Actual transaction time (Kigali, UTC+2)",
    type: "datetime-local",
    required: true,
  };
  const form = (
    action: FinanceCommand["action"],
    title: string,
    fields: FormField[],
    description?: string,
  ) => (
    <FinanceForm
      key={`${enquiry.version}-${action}`}
      title={title}
      hidden={{
        action,
        reference: enquiry.reference,
        expectedVersion: enquiry.version,
        currency,
        intentKey: randomUUID(),
      }}
      fields={[...fields, evidence]}
      description={description}
    />
  );
  return (
    <section className="mt-8 min-w-0">
      <h2 className="text-2xl">Payments and supplier fulfilment</h2>
      <p>
        Off-site records only. These actions do not move money, issue tickets or
        change the Pesapal ledger. Currency: {currency}.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ["Accepted quote", snapshot.totalMinor],
          ["Current agreed customer charge", current.customerChargeMinor],
          ["Reconciled collections", summary.collections],
          ["Customer balance", summary.customerBalance],
          ["Customer credit", summary.customerCredit],
          ["Refund still owed", summary.refundDue],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border p-3">
            <dt className="text-sm">{label}</dt>
            <dd className="mt-2 font-semibold">{fmt(value as number)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3">
        Funding threshold: {fmt(current.requiredFundingMinor)} ·{" "}
        {summary.funded
          ? "Funding verified at threshold"
          : "Funding below threshold / not applicable"}{" "}
        ·{" "}
        {current.reviewed
          ? "Commercial costs reviewed"
          : "Commercial review required"}
      </p>
      {stored?.instructions && (
        <p className="mt-3 whitespace-pre-wrap">
          Approved payment instructions: {stored.instructions}
        </p>
      )}
      {(internal ||
        (actor.staffRole === "SALES" && enquiry.ownerId === actor.id)) &&
        form(
          "RECORD_RECEIPT",
          "Record an unverified customer receipt",
          [
            account,
            external,
            amount,
            {
              name: "secondaryAmount",
              label: `Initial allocation to this quote (${currency}, blank = all; zero = unallocated)`,
            },
            { name: "payer", label: "Payer shown on receipt", required: true },
            date,
          ],
          "A receipt does not count as paid until finance checks the account statement. It may be split across same-currency quotes by finance.",
        )}
      {internal && (
        <>
          <h3 className="mt-7 text-xl">Finance controls</h3>
          <p>
            Use company-approved accounts; missing accounts must be registered
            by an administrator in the finance register. Do not enter card
            details or login/API credentials.
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["Agreed service fees", summary.serviceFees],
              ["Supplier net cost", summary.supplierCost],
              ["Supplier still payable", summary.supplierDue],
              ["Supplier recoverable", summary.supplierRecoveryDue],
              ["External commission received", summary.commissions],
              ["Payment charges", summary.charges],
              ["Tax/other pass-through reserve", summary.passThroughReserve],
              ["Refunds paid", summary.customerRefunds],
              ["Case cash position", summary.cashPosition],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border p-3">
                <dt className="text-sm">{label}</dt>
                <dd>{fmt(value as number)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3">
            Operational contribution:{" "}
            {summary.contribution === null
              ? "Not assessed — complete commercial review"
              : fmt(summary.contribution)}
            . This is not statutory profit or customer collections.
          </p>
          {form("INSTRUCTIONS", "Record approved payment instructions", [
            account,
            {
              name: "instructions",
              label: "Approved instructions (blank uses account instructions)",
              type: "textarea",
            },
          ])}
          {stored && (
            <FinanceRecords
              caseId={stored.id}
              currency={currency}
              form={form}
              account={account}
              external={external}
              amount={amount}
              date={date}
              target={target}
            />
          )}
          {form(
            "COMMIT_SUPPLIER",
            "Record a supplier cost commitment",
            [
              {
                name: "supplierId",
                label: "Approved supplier",
                required: true,
                options: supplierOptions,
              },
              { name: "label", label: "Contracted service", required: true },
              external,
              amount,
            ],
            "Record the complete agreed supplier payable, including applicable supplier charges. No public supplier claim is created.",
          )}
          {!!commitments.length && (
            <>
              {form("SUPPLIER_DEBIT", "Add supplier cost / debit", [
                target(commitments, "Supplier commitment"),
                external,
                amount,
              ])}
              {form(
                "SUPPLIER_CREDIT",
                "Record supplier credit / cost reduction",
                [target(commitments, "Supplier commitment"), external, amount],
              )}
              {form("SUPPLIER_PAYMENT", "Record verified supplier payment", [
                target(commitments, "Supplier commitment"),
                account,
                external,
                amount,
                date,
              ])}
              {form("SUPPLIER_RECOVERY", "Record a received supplier refund", [
                target(commitments, "Supplier commitment"),
                account,
                external,
                amount,
                date,
              ])}
            </>
          )}
          {form("PAYMENT_CHARGE", "Record payment processing/bank charge", [
            account,
            external,
            amount,
            date,
          ])}
          {form(
            "COMMISSION",
            "Record external commission received",
            [account, external, amount, date],
            "Only separately received permitted commission, not a discount already netted from supplier cost. Review prevents double-counting income.",
          )}
          {form(
            "REVIEW",
            "Review complete costs and agreed charges",
            [
              {
                ...amount,
                label: `Agreed customer charge (${currency})`,
                value: units(current.customerChargeMinor),
              },
              {
                name: "feeAmount",
                label: `Agreed service fee (${currency})`,
                value: units(current.serviceFeeMinor),
                required: true,
              },
              {
                name: "taxAmount",
                label: `Tax / other pass-through reserve (${currency})`,
                value: units(current.taxReserveMinor),
                required: true,
              },
              {
                name: "thresholdAmount",
                label: `Approved funding threshold / deposit (${currency})`,
                value: ["CANCELLED", "REFUNDED", "COMPLETED"].includes(
                  enquiry.status,
                )
                  ? "0"
                  : units(current.requiredFundingMinor),
                required: true,
              },
            ],
            "Verify all supplier costs, permitted margin/commission treatment and tax liabilities. Live quote charges/fees stay fixed. Completed/cancelled price concessions require approved evidence; closed-case funding thresholds are zero.",
          )}
          {form(
            "APPROVE_REFUND",
            "Approve a customer refund obligation",
            [
              external,
              amount,
              { name: "label", label: "Refund reason", required: true },
            ],
            "Available customer credit must cover this obligation. Approval does not mean money has been refunded.",
          )}
          {form(
            "RELEASE_PROCESSING",
            "Release funded case to supplier processing",
            [],
            "Requires reconciled funding at the approved threshold, complete reviewed costs and approved suppliers.",
          )}
        </>
      )}
      {operate && commitments.length > 0 && (
        <>
          <h3 className="mt-7 text-xl">Operations</h3>
          <ul>
            {stored?.commitments.map((c) => (
              <li key={c.id} className="mt-2 rounded border p-3">
                {c.supplier.name} · {c.label} ·{" "}
                {c.confirmationRef
                  ? `Checked reference ${c.confirmationRef}`
                  : "Supplier check outstanding"}
              </li>
            ))}
          </ul>
          {form(
            "CONFIRM_SUPPLIER",
            "Verify an individual supplier confirmation",
            [target(commitments, "Supplier commitment"), external],
            "Check actual supplier acceptance, traveller/service details and written confirmation before recording this reference.",
          )}
          {form(
            "CONFIRM_SERVICE",
            "Record checked supplier confirmation",
            [target(commitments, "Primary supplier commitment"), external],
            "Check the supplier/ticket reference and traveller/service details before confirming. This creates one service fulfilment record, never a second inventory booking.",
          )}
          {form(
            "COMPLETE_SERVICE",
            "Record service completion",
            [],
            "Only a previously confirmed service can be completed.",
          )}
          {actor.role === "ADMIN" &&
            form(
              "LINK_BOOKING",
              "Link an existing completed historical booking",
              [
                {
                  name: "bookingRef",
                  label: "Existing booking reference",
                  required: true,
                },
              ],
              "Only matching completed bookings without payment attempts can be linked. Verify identity and service; paid/payable legacy bookings remain in their original ledger. No booking is created or reset.",
            )}
        </>
      )}
      {stored?.fulfilment && (
        <p className="mt-5">
          Supplier confirmation recorded{" "}
          {stored.fulfilment.confirmedAt.toLocaleString("en-GB", {
            timeZone: "Africa/Kigali",
          })}{" "}
          Kigali{stored.fulfilment.completedAt ? " · Completed" : ""}
          {!internal || actor.role === "ADMIN"
            ? ` · Supplier reference ${stored.fulfilment.confirmationRef}`
            : ""}
          {stored.fulfilment.legacyBookingId
            ? " · Historical booking linked"
            : ""}
        </p>
      )}
    </section>
  );
}

type FormMaker = (
  action: FinanceCommand["action"],
  title: string,
  fields: FormField[],
  description?: string,
) => React.ReactNode;
async function FinanceRecords({
  caseId,
  currency,
  form,
  account,
  external,
  amount,
  date,
  target,
}: {
  caseId: string;
  currency: string;
  form: FormMaker;
  account: FormField;
  external: FormField;
  amount: FormField;
  date: FormField;
  target: (
    options: { value: string; label: string }[],
    label: string,
  ) => FormField;
}) {
  const [data, receipts] = await Promise.all([
    db.financialCase.findUniqueOrThrow({
      where: { id: caseId },
      include: {
        ...financeInclude,
        entries: { include: { proof: { include: { account: true } } } },
        operations: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    }),
    db.offsiteReceipt.findMany({
      where: { status: { not: "REVERSED" }, proof: { currency } },
      include: { proof: { include: { account: true } }, allocations: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const fmt = (n: number) => formatQuoteMoney(n, currency);
  const linkedReceipts = receipts.filter(
    (r) =>
      r.caseId === caseId || r.allocations.some((a) => a.caseId === caseId),
  );
  const receiptOptions = linkedReceipts.map((r) => ({
    value: r.id,
    label: `${r.proof.account.code} / ${r.proof.externalRef} · ${r.status} · ${fmt(r.proof.amountMinor)}`,
  }));
  const available = receipts
    .filter(
      (r) =>
        r.proof.amountMinor >
        r.allocations
          .filter((a) => a.status === "ACTIVE")
          .reduce((n, a) => n + a.amountMinor, 0),
    )
    .map((r) => ({
      value: r.id,
      label: `${r.proof.externalRef} · ${r.status} · available ${fmt(r.proof.amountMinor - r.allocations.filter((a) => a.status === "ACTIVE").reduce((n, a) => n + a.amountMinor, 0))}`,
    }));
  const allocations = linkedReceipts.flatMap((r) =>
    r.allocations
      .filter((a) => a.caseId === caseId && a.status === "ACTIVE")
      .map((a) => ({
        value: a.id,
        label: `${r.proof.externalRef} · ${fmt(a.amountMinor)}`,
      })),
  );
  return (
    <>
      <h4 className="mt-5 font-semibold">Receipts and allocations</h4>
      <p>
        Latest 100 unreversed receipts in this currency. Reconciled but
        unallocated cash is a liability, not case revenue.
      </p>
      <ul className="mt-3 space-y-2">
        {linkedReceipts.map((r) => (
          <li key={r.id} className="break-words rounded border p-3">
            {r.proof.account.code} / {r.proof.externalRef} · {r.status} ·{" "}
            {fmt(r.proof.amountMinor)} · payer {r.payer}
            <p className="text-xs">Receipt ID {r.id}</p>
          </li>
        ))}
      </ul>
      {form(
        "ALLOCATE_RECEIPT",
        "Allocate an existing receipt to this quote",
        [target(available, "Receipt with unallocated balance"), amount],
        "Verify payer authority and quote references. Same-currency allocation only; reconciliation is still required for pending receipts.",
      )}
      {form(
        "RECONCILE_RECEIPT",
        "Reconcile verified receipt against statement",
        [target(receiptOptions, "Receipt")],
        "Verify actual receipt of funds in the approved account. All active allocations are credited atomically; this does not initiate a payment.",
      )}
      {form(
        "AMEND_RECEIPT",
        "Correct recorded receipt total / date",
        [target(receiptOptions, "Receipt"), amount, date],
        "Correction is audited. Release allocations first if their total exceeds the corrected amount; statement identity cannot be changed.",
      )}
      {form(
        "RELEASE_ALLOCATION",
        "Release an incorrect allocation",
        [target(allocations, "Active allocation")],
        "A reconciled allocation receives an equal-and-opposite journal entry. This is a recording correction, not a customer payout.",
      )}
      {form(
        "REVERSE_RECEIPT",
        "Reverse an invalid receipt",
        [target(receiptOptions, "Receipt")],
        "All allocations are released atomically. The statement reference remains reserved; correct dependent payouts first.",
      )}
      <h4 className="mt-6 font-semibold">Supplier balances</h4>
      <ul>
        {data.commitments.map((c) => {
          const balance = commitmentBalance(data, c.id);
          return (
            <li key={c.id} className="mt-2 rounded border p-3">
              {c.supplier.name} / {c.contractRef} · cost {fmt(balance.cost)} ·
              payable {fmt(balance.due)} · recoverable{" "}
              {fmt(balance.recoveryDue)}
            </li>
          );
        })}
      </ul>
      <h4 className="mt-6 font-semibold">Refund obligations</h4>
      <ul>
        {data.refunds.map((r) => {
          const balance = refundBalance(data, r.id);
          return (
            <li key={r.id} className="mt-2 rounded border p-3">
              {r.referenceKey} · approved {fmt(balance.approved)} · still due{" "}
              {fmt(balance.due)} · {r.reason}
            </li>
          );
        })}
      </ul>
      {form(
        "AMEND_REFUND",
        "Correct an approved refund obligation",
        [
          target(
            data.refunds.map((r) => ({
              value: r.id,
              label: `${r.referenceKey} · approved ${fmt(refundBalance(data, r.id).approved)}`,
            })),
            "Refund obligation",
          ),
          external,
          {
            ...amount,
            label: `Correct total refund obligation (${currency}, zero may void an unsettled error)`,
          },
        ],
        "An append-only adjustment preserves the original approval. Settled payouts and other obligations remain protected.",
      )}
      {form("SETTLE_REFUND", "Record verified customer refund payout", [
        target(
          data.refunds.map((r) => ({
            value: r.id,
            label: `${r.referenceKey} · due ${fmt(refundBalance(data, r.id).due)}`,
          })),
          "Refund obligation",
        ),
        account,
        external,
        amount,
        date,
      ])}
      <h4 className="mt-6 font-semibold">Append-only journal</h4>
      <ul>
        {data.entries.map((e) => (
          <li key={e.id} className="mt-2 break-all rounded border p-3">
            {e.kind} · {fmt(e.amountMinor)}
            {e.proof
              ? ` · ${e.proof.account.code} / ${e.proof.externalRef}`
              : ""}
            {e.reversesId ? " · correction reversal" : ""}
            <p className="text-xs">Entry {e.id}</p>
          </li>
        ))}
      </ul>
      {form(
        "REVERSE_ENTRY",
        "Reverse an incorrect journal entry",
        [
          target(
            data.entries
              .filter(
                (e) =>
                  !e.reversesId &&
                  e.kind !== "RECEIPT" &&
                  e.kind !== "REFUND_ADJUSTMENT" &&
                  !data.entries.some((other) => other.reversesId === e.id),
              )
              .map((e) => ({
                value: e.id,
                label: `${e.kind} · ${fmt(e.amountMinor)}`,
              })),
            "Original unreversed entry",
          ),
        ],
        "Entries are never deleted. Reversals require verified correction evidence and cannot invalidate dependent refunds/recoveries.",
      )}
      <h4 className="mt-6 font-semibold">Financial activity (latest 100)</h4>
      {data.operations.map((o) => (
        <article key={o.id} className="mt-2 break-words rounded border p-3">
          <p>
            {o.action} ·{" "}
            {o.createdAt.toLocaleString("en-GB", { timeZone: "Africa/Kigali" })}{" "}
            Kigali
          </p>
          <p className="whitespace-pre-wrap">{o.evidence}</p>
          <ChangeSummary changes={o.changes} />
        </article>
      ))}
    </>
  );
}
