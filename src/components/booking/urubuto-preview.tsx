"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, CreditCard, RotateCcw, ShieldCheck, Smartphone, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UrubutoChannel } from "@/lib/urubuto-pay";

const methods = [
  { code: "MOMO", label: "MTN Mobile Money", detail: "Approve a prompt on your phone", icon: Smartphone },
  { code: "AIRTEL_MONEY", label: "Airtel Money", detail: "Approve a prompt on your phone", icon: Smartphone },
  { code: "CARD", label: "Card", detail: "Continue to hosted card checkout", icon: CreditCard },
] as const;

type Outcome = "pending" | "success" | "failed" | "cancelled";
const outcomes = {
  pending: { title: "Awaiting approval", detail: "Simulate the result of the payment prompt or hosted checkout.", icon: Clock3 },
  success: { title: "Test payment successful", detail: "The simulated payment completed. Your event case and balance are unaffected.", icon: CheckCircle2 },
  failed: { title: "Test payment declined", detail: "Try again or choose another payment method.", icon: XCircle },
  cancelled: { title: "Test payment cancelled", detail: "You can return to payment methods and try again.", icon: XCircle },
};

export function UrubutoPreview({ amount, reference, description }: {
  amount: string;
  reference: string;
  description: string;
}) {
  const [method, setMethod] = useState<UrubutoChannel>("MOMO");
  const [attempt, setAttempt] = useState<{ id: string; outcome: Outcome } | null>(null);
  const selected = methods.find((item) => item.code === method)!;
  const current = attempt && outcomes[attempt.outcome];
  const result = (outcome: Outcome) => setAttempt((previous) =>
    previous?.outcome === "pending" ? { ...previous, outcome } : previous,
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.56fr)]">
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 sm:p-8">
        {attempt && current ? (
          <div key={attempt.outcome} role="status">
            <div className="mb-5 inline-flex rounded-2xl bg-forest-100 p-3 text-forest-800">
              <current.icon className="size-7" aria-hidden />
            </div>
            <h2 className="text-3xl">{current.title}</h2>
            <p className="mt-3">{current.detail}</p>
            <p className="mt-3 break-all text-sm">Test reference <strong>{attempt.id}</strong></p>
            {attempt.outcome === "pending" ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => result("success")}>Simulate approval</Button>
                <Button variant="outline" onClick={() => result("failed")}>Simulate decline</Button>
                <Button variant="ghost" onClick={() => result("cancelled")}>Cancel test</Button>
              </div>
            ) : (
              <Button className="mt-6" variant="outline" onClick={() => setAttempt(null)}>
                <RotateCcw className="size-4" aria-hidden /> Run another test
              </Button>
            )}
          </div>
        ) : (
          <>
            <fieldset>
              <legend className="text-3xl">Choose how to pay</legend>
              <div className="mt-5 grid gap-3">
                {methods.map(({ code, label, detail, icon: Icon }) => (
                  <label key={code} className="flex cursor-pointer items-center gap-4 rounded-2xl border border-[var(--line)] p-4 has-checked:border-forest-700 has-checked:bg-forest-50 has-checked:text-forest-950">
                    <input type="radio" name="method" value={code} checked={method === code} onChange={() => setMethod(code)} className="accent-forest-800" />
                    <Icon className="size-5 shrink-0" aria-hidden />
                    <span><strong className="block">{label}</strong><span className="text-sm">{detail}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Button className="mt-6 w-full sm:w-auto" onClick={() => setAttempt({ id: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, outcome: "pending" })}>
              Continue to simulation <ArrowRight className="size-4" aria-hidden />
            </Button>
          </>
        )}
      </section>
      <aside className="on-dark overflow-hidden rounded-3xl bg-forest-900 p-6 text-bone-50 sm:p-8">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-sun-300">
          <ShieldCheck className="size-4" aria-hidden /> Simulation
        </p>
        <h2 className="mt-4 text-2xl">Payment summary</h2>
        <p className="mt-2 text-bone-100/85">{description}</p>
        <dl className="mt-6 space-y-3 border-t border-white/20 pt-5">
          <div className="flex justify-between gap-3 text-sm"><dt>Proposal</dt><dd>{reference}</dd></div>
          <div className="flex justify-between gap-3 text-sm"><dt>Method</dt><dd>{selected.label}</dd></div>
          <div className="flex items-baseline justify-between gap-3 border-t border-white/20 pt-4">
            <dt>Test total</dt><dd className="text-2xl font-semibold">{amount}</dd>
          </div>
        </dl>
        <p className="mt-5 text-sm text-bone-100/85">No money moves. Use this preview without entering payment details.</p>
      </aside>
    </div>
  );
}
