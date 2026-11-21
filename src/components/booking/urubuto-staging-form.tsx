"use client";

import { useActionState } from "react";
import { ArrowUpRight } from "lucide-react";
import { runUrubutoTest } from "@/app/actions/urubuto-test";
import { Button } from "@/components/ui/button";

const field = "mt-1 block w-full rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-3";

export function UrubutoStagingForm() {
  const [state, action, pending] = useActionState(runUrubutoTest, { message: "" });
  return (
    <section className="space-y-5 rounded-3xl border border-[var(--line)] p-5 sm:p-8">
      <form action={action} className="grid gap-4">
        <label>Test payment method
          <select name="method" className={field}>
            <option value="MOMO">MTN Mobile Money</option>
            <option value="AIRTEL_MONEY">Airtel Money</option>
            <option value="CARD">Hosted card checkout</option>
          </select>
        </label>
        <label>Test payer name<input name="name" required minLength={2} maxLength={100} className={field} /></label>
        <label>Test payer email<input name="email" type="email" required maxLength={200} className={field} /></label>
        <label>Provider test phone<input name="phone" inputMode="numeric" pattern="2507[0-9]{8}" placeholder="2507XXXXXXXX" required className={field} /></label>
        <Button disabled={pending} className="justify-self-start">{pending ? "Contacting staging…" : "Start staging payment"}</Button>
      </form>
      {state.checkout && (
        <Button href={state.checkout}>Open hosted test checkout <ArrowUpRight className="size-4" aria-hidden /></Button>
      )}
      {state.message && <p role="status" className="rounded-xl bg-[var(--paper-raised)] p-3">{state.message}</p>}
      <form action={action}>
        <input type="hidden" name="command" value="status" />
        <Button disabled={pending} variant="outline">Check provider status</Button>
      </form>
    </section>
  );
}
