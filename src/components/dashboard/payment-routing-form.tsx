"use client";

import { useActionState } from "react";
import { savePaymentRouting } from "@/app/actions/collections";
import { Button } from "@/components/ui/button";
import { COLLECTION_METHODS, COLLECTION_METHOD_LABEL } from "@/lib/collections/rules";

export function PaymentRoutingForm({ policy, configured }: {
  policy: { version: number; enabled: boolean; methods: string[]; minMinor: number; maxMinor: number; evidence: string; feeTerms: string } | null;
  configured: boolean;
}) {
  const [state, action, pending] = useActionState(savePaymentRouting, {});
  const field = "mt-1 block w-full rounded-lg border border-[var(--line-strong)] bg-white p-2.5";
  return (
    <form action={action} onReset={(event) => event.preventDefault()} className="max-w-2xl space-y-5 rounded-xl border border-[var(--line)] p-5">
      <input type="hidden" name="version" value={policy?.version ?? -1} />
      <fieldset className="space-y-3" disabled={pending}>
        <legend className="mb-2 font-semibold">Approved customer methods</legend>
        {COLLECTION_METHODS.map((method) => (
          <label key={method} className="flex gap-2">
            <input type="checkbox" name="methods" value={method} defaultChecked={policy?.methods.includes(method)} />
            {COLLECTION_METHOD_LABEL[method]}
          </label>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <label>Minimum amount (RWF)<input className={field} type="number" name="minMinor" min="1" required defaultValue={policy?.minMinor} /></label>
          <label>Maximum amount (RWF)<input className={field} type="number" name="maxMinor" min="1" required defaultValue={policy?.maxMinor} /></label>
        </div>
        <label className="block">Contract fee notes<textarea className={field} name="feeTerms" maxLength={1000} defaultValue={policy?.feeTerms} /></label>
        <label className="block">Merchant approval and test evidence reference<input className={field} name="evidence" minLength={10} maxLength={1000} required defaultValue={policy?.evidence} /></label>
        {configured ? <label className="flex gap-2">
          <input type="checkbox" name="enabled" defaultChecked={policy?.enabled} />
          Enable new collections within the approved limits
        </label> : <p className="text-sm">Provider credentials, website origin and activation approval must be configured before accepting payments.</p>}
      </fieldset>
      <Button type="submit" variant="accent" disabled={pending}>{pending ? "Saving…" : "Save routing"}</Button>
      {state.message ? <p role={state.error ? "alert" : "status"}>{state.message}</p> : null}
    </form>
  );
}
