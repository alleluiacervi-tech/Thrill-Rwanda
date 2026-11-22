"use client";
import { useActionState, useState } from "react";
import {
  issueWrittenQuote,
  recordWrittenQuoteAcceptance,
} from "@/app/actions/quotes";
import { retryEnquiryNotification } from "@/app/actions/notification-retry";
import { Button } from "@/components/ui/button";
import {
  LINE_KINDS,
  QUOTE_CURRENCIES,
  formatQuoteMoney,
  quoteTotals,
  type QuoteActionState,
  type QuoteSnapshot,
} from "@/lib/quote-rules";
const field =
  "mt-2 block w-full rounded-xl border border-[var(--line-strong)] bg-[var(--paper-raised)] p-3";
export function QuoteEditor({
  reference,
  enquiryVersion,
  intentKey,
  emailAllowed,
  seed,
  businessEvent = false,
  transport = false,
}: {
  reference: string;
  enquiryVersion: number;
  intentKey: string;
  emailAllowed: boolean;
  seed?: QuoteSnapshot;
  businessEvent?: boolean;
  transport?: boolean;
}) {
  const [state, action, pending] = useActionState(issueWrittenQuote, {
    status: "idle",
  } as QuoteActionState);
  const [currency, setCurrency] = useState(seed?.currency ?? (transport ? "RWF" : "USD"));
  const [lines, setLines] = useState<
    {
      kind: (typeof LINE_KINDS)[number];
      description: string;
      quantity: number;
      unitPrice: string;
    }[]
  >(
    seed
      ? seed.items.map((item) => ({
          kind: item.kind,
          description: item.description,
          quantity: item.quantity,
          unitPrice: String(
            item.unitMinor / (seed.currency === "RWF" ? 1 : 100),
          ),
        }))
      : [
          {
            kind: "SUPPLIER",
            description: businessEvent ? "" : "Supplier fare / service",
            quantity: 1,
            unitPrice: "",
          },
          {
            kind: "SERVICE_FEE",
            description: "Thrill Rwanda service fee",
            quantity: 1,
            unitPrice: "0",
          },
        ],
  );
  let preview = "Enter valid line amounts for a total preview.";
  try {
    preview = `Draft customer total: ${formatQuoteMoney(quoteTotals(lines, currency).totalMinor, currency)}`;
  } catch {
    /* Display validation when issuing. */
  }
  const change = (index: number, key: string, value: string | number) =>
    setLines((current) =>
      current.map((line, position) =>
        position === index ? { ...line, [key]: value } : line,
      ),
    );
  return (
    <details className="mt-5 rounded-xl border border-[var(--line)] p-5">
      <summary className="cursor-pointer text-lg font-semibold">
        {businessEvent ? "Prepare an event proposal" : "Prepare a new quotation version"}
      </summary>
      <form
        action={action}
        onReset={(e) => e.preventDefault()}
        className="mt-5 space-y-5"
      >
        <p>
          Editing stays in this form until issued. Issued versions cannot be
          edited. Check supplier options, conditions and approved commercial
          terms before issuing. All deadline inputs use Kigali time (UTC+2).
        </p>
        {seed && (
          <p>
            Previous version values are prefilled as an editable draft. Recheck
            suppliers, amounts and conditions; set new deadlines before issuing.
          </p>
        )}
        <input type="hidden" name="reference" value={reference} />
        <input type="hidden" name="enquiryVersion" value={enquiryVersion} />
        <input type="hidden" name="intentKey" value={intentKey} />
        <input type="hidden" name="lines" value={JSON.stringify(lines)} />
        {state.message && (
          <p role={state.status === "error" ? "alert" : "status"}>
            {state.message}
          </p>
        )}
        <fieldset disabled={pending} className="space-y-5">
          <label className="block">
            Currency
            <select
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={field}
            >
              {QUOTE_CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block">
            {businessEvent ? "Recommended option, inclusions and exclusions" : "Service description"}
            <textarea
              name="serviceDescription"
              defaultValue={seed?.serviceDescription}
              placeholder={businessEvent ? "Describe the recommended venue, room layout, capacity and services covered by this price." : undefined}
              required
              minLength={10}
              maxLength={2000}
              className={field}
            />
          </label>
          <label className="block">
            {businessEvent ? "Event dates, programme and attendee movements" : "Travel dates, route or itinerary"}
            <textarea
              name="travelSummary"
              defaultValue={seed?.travelSummary}
              required
              minLength={5}
              maxLength={2000}
              className={field}
            />
          </label>
          <h3 className="text-lg">Customer-facing price breakdown</h3>
          {lines.map((line, index) => (
            <fieldset
              key={index}
              className="grid gap-3 rounded-xl border border-[var(--line)] p-4 sm:grid-cols-2"
            >
              <legend>Line {index + 1}</legend>
              <label>
                Type
                <select
                  aria-label={`Line ${index + 1} type`}
                  className={field}
                  value={line.kind}
                  onChange={(e) => change(index, "kind", e.target.value)}
                >
                  {LINE_KINDS.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label>
                Description
                <input
                  aria-label={`Line ${index + 1} description`}
                  required
                  maxLength={200}
                  className={field}
                  value={line.description}
                  onChange={(e) => change(index, "description", e.target.value)}
                />
              </label>
              <label>
                Quantity
                <input
                  aria-label={`Line ${index + 1} quantity`}
                  required
                  type="number"
                  min={1}
                  max={500}
                  className={field}
                  value={line.quantity}
                  onChange={(e) =>
                    change(index, "quantity", Number(e.target.value))
                  }
                />
              </label>
              <label>
                Unit price ({currency})
                <input
                  aria-label={`Line ${index + 1} unit price`}
                  inputMode="decimal"
                  required
                  className={field}
                  value={line.unitPrice}
                  onChange={(e) => change(index, "unitPrice", e.target.value)}
                />
              </label>
              {lines.length > 2 && (
                <button
                  type="button"
                  className="text-left underline"
                  onClick={() =>
                    setLines((current) =>
                      current.filter((_, position) => position !== index),
                    )
                  }
                >
                  Remove line {index + 1}
                </button>
              )}
            </fieldset>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={lines.length >= 30}
            onClick={() =>
              setLines((current) => [
                ...current,
                { kind: "OTHER", description: "", quantity: 1, unitPrice: "" },
              ])
            }
          >
            Add line
          </Button>
          <p aria-live="polite" className="font-semibold">
            {preview}
          </p>
          <label className="block">
            Taxes / charges treatment
            <textarea
              name="taxTreatment"
              defaultValue={seed?.taxTreatment}
              required
              minLength={5}
              maxLength={1000}
              className={field}
            />
          </label>
          <label className="block">
            {businessEvent ? "Venue alternatives, availability and supplier conditions" : "Supplier fare / baggage / service conditions"}
            <textarea
              name="supplierConditions"
              defaultValue={seed?.supplierConditions}
              placeholder={businessEvent ? "Summarize comparable venue options and their hold deadlines. Identify any optional prices separately." : undefined}
              required
              minLength={10}
              maxLength={4000}
              className={field}
            />
          </label>
          <label className="block">
            {businessEvent ? "Deposit, payment schedule and change or cancellation terms" : "Payment instructions and change / cancellation / refund terms"}
            <textarea
              name="terms"
              defaultValue={seed?.terms}
              required
              minLength={20}
              maxLength={6000}
              rows={5}
              className={field}
            />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label>
              Valid until (Kigali)
              <input
                type="datetime-local"
                name="expiresAt"
                required
                className={field}
              />
            </label>
            <label>
              Payment deadline (Kigali)
              <input
                type="datetime-local"
                name="paymentDeadline"
                required
                className={field}
              />
            </label>
          </div>
          <label className="block">
            Internal notes (excluded from customer copy)
            <textarea name="internalNotes" maxLength={3000} className={field} />
          </label>
          {emailAllowed && (
            <label className="flex items-start gap-3">
              <input className="mt-1 size-5" type="checkbox" name="sendEmail" />
              Queue this written quote for the customer’s preferred email
              channel. Delivery is tracked separately.
            </label>
          )}
          <label className="flex items-start gap-3">
            <input
              className="mt-1 size-5"
              type="checkbox"
              name="checked"
              required
            />
            I checked supplier options and the approved quotation terms, price
            breakdown and deadlines.
          </label>
        </fieldset>
        <Button type="submit" disabled={pending}>
          {pending ? "Issuing…" : "Issue written quote"}
        </Button>
      </form>
    </details>
  );
}
export function QuoteAcceptanceForm({
  reference,
  quoteId,
  enquiryVersion,
  number,
}: {
  reference: string;
  quoteId: string;
  enquiryVersion: number;
  number: number;
}) {
  const [state, action, pending] = useActionState(
    recordWrittenQuoteAcceptance,
    { status: "idle" } as QuoteActionState,
  );
  return (
    <form
      action={action}
      onReset={(e) => e.preventDefault()}
      className="mt-5 space-y-4 rounded-xl border border-[var(--line)] p-5"
    >
      <h3 className="text-lg">Record customer acceptance — version {number}</h3>
      <p>
        Record verified acceptance received through an approved channel. This is
        a staff attestation, not a customer portal signature.
      </p>
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="enquiryVersion" value={enquiryVersion} />
      {state.message && (
        <p role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      )}
      <label className="block">
        Customer’s accepting name
        <input
          name="customerName"
          required
          minLength={2}
          maxLength={120}
          className={field}
        />
      </label>
      <label className="block">
        Acceptance channel
        <select name="channel" className={field}>
          <option>EMAIL</option>
          <option>PHONE</option>
          <option>WHATSAPP</option>
          <option>IN_PERSON</option>
        </select>
      </label>
      <label className="block">
        Evidence / correspondence reference
        <textarea
          name="evidence"
          required
          minLength={10}
          maxLength={2000}
          className={field}
        />
      </label>
      <label className="flex items-start gap-3">
        <input
          className="mt-1 size-5"
          type="checkbox"
          name="verified"
          required
        />
        I verified the customer’s acceptance of this exact version, total and
        terms.
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Recording…" : "Record acceptance"}
      </Button>
    </form>
  );
}
export function NotificationRetryButton({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState(retryEnquiryNotification, {
    status: "idle",
  } as QuoteActionState);
  return (
    <form action={action}>
      <input type="hidden" name="jobId" value={jobId} />
      <button type="submit" className="underline" disabled={pending}>
        {pending ? "Queuing…" : "Queue retry"}
      </button>
      {state.message && (
        <p role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      )}
    </form>
  );
}
export function PrintQuoteButton() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      Print / save as PDF
    </Button>
  );
}
