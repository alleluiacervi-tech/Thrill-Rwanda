"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CreditCard, LockKeyhole, Smartphone } from "lucide-react";
import { submitCollection } from "@/app/actions/collections";
import { useSite } from "@/components/layout/site-context";
import { Button, buttonVariants } from "@/components/ui/button";
import type { collectionCheckout } from "@/lib/collections/checkout";
import { COLLECTION_METHOD_LABEL, OPEN_COLLECTIONS, paymentStatusLabel, type CollectionMethod } from "@/lib/collections/rules";
import { formatQuoteMoney } from "@/lib/quote-rules";

const field = "mt-1.5 block w-full rounded-xl border border-[var(--line-strong)] bg-white p-3";

export function CollectionCheckout({ data, token, bookingReference }: {
  data: NonNullable<Awaited<ReturnType<typeof collectionCheckout>>>;
  token?: string;
  bookingReference?: string;
}) {
  const site = useSite();
  const attempt = data.attempt;
  const open = !!attempt && OPEN_COLLECTIONS.includes(attempt.status);
  const [method, setMethod] = useState<CollectionMethod | undefined>(data.methods[0]);
  const [phone, setPhone] = useState(data.methods[0] && data.methods[0] !== "CARD" ? "+250 " : "");
  const [state, action, pending] = useActionState(submitCollection, {});
  const checkRef = useRef<HTMLButtonElement>(null);
  const money = (value: number) => formatQuoteMoney(value, data.currency);
  const base = token ? `/pay/${token}` : `/checkout/${bookingReference}/pay`;
  const identity = token ? <input type="hidden" name="token" value={token} /> : <input type="hidden" name="bookingReference" value={bookingReference} />;

  useEffect(() => {
    if (!open || attempt?.status === "DISPUTED") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") checkRef.current?.click();
    }, 45_000);
    return () => clearInterval(timer);
  }, [open, attempt?.status]);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1.3fr_1fr]">
      <section className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 sm:p-8">
        <div>
          {data.testing ? <p className="mb-2 text-sm font-medium text-clay-800">Testing environment</p> : null}
          <h1 className="text-3xl sm:text-4xl">Pay Thrill Rwanda</h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">Reference {data.reference}</p>
        </div>
        {attempt ? (
          <section role="status" className="space-y-3 rounded-xl bg-bone-50 p-4">
            <h2 className="text-lg font-medium">{paymentStatusLabel[attempt.status] ?? "Payment record"}</h2>
            <p className="text-sm">
              {money(attempt.amountMinor)} · {COLLECTION_METHOD_LABEL[attempt.method as CollectionMethod]}
            </p>
            {open && attempt.method !== "CARD" && attempt.status === "REQUIRES_ACTION" ? (
              <p className="text-sm">Review the payment prompt on your phone and authorize it in your mobile wallet.</p>
            ) : null}
            {attempt.hostedUrl && open ? <Button href={attempt.hostedUrl} variant="accent">Open secure card checkout</Button> : null}
            {attempt.status === "RECONCILIATION_REQUIRED" || attempt.status === "DISPUTED" ? (
              <p className="text-sm">Contact the travel desk with your reference before paying again.</p>
            ) : null}
            {open ? (
              <form action={action}>
                {identity}
                <button ref={checkRef} className={buttonVariants({ variant: "outline" })} type="submit" name="command" value="check" disabled={pending}>
                  {pending ? "Checking…" : "Check payment status"}
                </button>
              </form>
            ) : null}
            {attempt.status === "SUCCESSFUL" ? <p className="text-sm">The travel desk will confirm your arrangements separately.</p> : null}
          </section>
        ) : null}
        {data.existingPaymentUnderReview ? <p className="rounded-xl bg-bone-50 p-4 text-sm">Finance is reviewing an existing payment for this reference.</p> : null}
        {!!data.methods.length && !open ? (
          <form action={action} onReset={(event) => event.preventDefault()} className="space-y-4">
            {identity}
            <input type="hidden" name="expectedMinor" value={data.amountMinor} />
            <fieldset disabled={pending} className="space-y-3">
              <legend className="mb-2 text-lg font-medium">Choose a payment method</legend>
              {data.methods.map((option) => (
                <label key={option} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[var(--line-strong)] px-3 has-[:checked]:border-forest-700 has-[:checked]:bg-forest-50">
                  <input type="radio" name="method" value={option} checked={method === option || (!data.methods.includes(method!) && data.methods[0] === option)} onChange={() => {
                    setMethod(option);
                    setPhone((value) => value.trim() && value.trim() !== "+250" ? value : option === "CARD" ? "" : "+250 ");
                  }} className="accent-forest-800" />
                  {option === "CARD" ? <CreditCard className="size-4" aria-hidden /> : <Smartphone className="size-4" aria-hidden />}
                  <span className="text-sm font-medium">{COLLECTION_METHOD_LABEL[option]}</span>
                </label>
              ))}
              <label className="block text-sm">
                Phone number
                <input name="phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={method === "CARD" ? "Include your country code" : "+250 7XX XXX XXX"} autoComplete="tel" maxLength={32} className={field} required />
              </label>
              <label className="block text-sm">
                Payer email
                <input name="email" type="email" autoComplete="email" maxLength={254} className={field} required />
              </label>
            </fieldset>
            <Button type="submit" variant="accent" className="w-full" disabled={pending}>
              {pending ? "Opening payment…" : `Pay ${money(data.amountMinor)}`}
            </Button>
            <p className="flex gap-2 text-sm text-[var(--ink-muted)]"><LockKeyhole className="size-4 shrink-0" aria-hidden /> Card details stay on UrubutoPay’s hosted checkout. Mobile money authorization takes place on your phone.</p>
          </form>
        ) : null}
        {state.message ? <p role={state.error ? "alert" : "status"} className="rounded-xl bg-bone-50 p-4 text-sm">{state.message}</p> : null}
        {data.bank ? (
          <details className="rounded-xl border border-[var(--line)] p-4">
            <summary className="cursor-pointer font-medium">Bank transfer</summary>
            <p className="mt-2 text-sm">{data.bank.name} · Outstanding {money(data.totalMinor - data.paidMinor)}</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{data.bank.instructions}</p>
            <p className="mt-2 text-sm">Use {data.reference} as the transfer reference. If you send a transfer, contact the desk before paying another way.</p>
          </details>
        ) : null}
        {!data.methods.length && !data.bank && !open && data.paidMinor < data.totalMinor && !data.existingPaymentUnderReview ? (
          <p className="text-sm">Contact the desk for approved payment instructions for this invoice.</p>
        ) : null}
        <p className="text-sm">
          Need help? <a className="underline" href={site.contact.phoneHref}>{site.contact.phone}</a>
        </p>
      </section>
      <aside className="space-y-4 self-start rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 sm:p-8">
        <h2 className="text-xl">Payment summary</h2>
        <p className="break-all text-sm text-[var(--ink-muted)]">{data.invoiceNumber}</p>
        <dl className="space-y-3 border-y border-[var(--line)] py-4 text-sm">
          <div className="flex justify-between gap-2"><dt>Invoice total</dt><dd>{money(data.totalMinor)}</dd></div>
          <div className="flex justify-between gap-2"><dt>Verified payments</dt><dd>{money(data.paidMinor)}</dd></div>
          <div className="flex justify-between gap-2 font-semibold"><dt>Remaining balance</dt><dd>{money(Math.max(0, data.totalMinor - data.paidMinor))}</dd></div>
          {data.amountMinor > 0 ? <div className="flex justify-between gap-2"><dt>Current payment</dt><dd>{money(data.amountMinor)}</dd></div> : null}
        </dl>
        {data.dueAt ? <p className="text-sm">Due {data.dueAt.toLocaleString("en-GB", { timeZone: "Africa/Kigali", dateStyle: "medium", timeStyle: "short" })} Kigali time</p> : null}
        <a className="block text-sm underline" href={`${base}/receipt/invoice`}>Download commercial invoice</a>
        {data.receipts.map((receipt) => (
          <p key={receipt.reference} className="text-sm">
            <a className="underline" href={`${base}/receipt/${receipt.reference}`}>Download receipt · {money(receipt.amountMinor)}</a>
          </p>
        ))}
        <Link className="block text-sm underline" href="/legal/cancellation">Cancellation and refunds</Link>
      </aside>
    </div>
  );
}
