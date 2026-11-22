"use client";

import { useActionState } from "react";
import { managePaymentLink } from "@/app/actions/collections";
import { Button } from "@/components/ui/button";

export function PaymentLinkForm({ reference, currency, expires, revoked }: {
  reference: string; currency: string; expires?: string; revoked?: boolean;
}) {
  const [state, action, pending] = useActionState(managePaymentLink, {});
  const input = "mt-1 w-full rounded-lg border border-[var(--line-strong)] bg-white p-2.5";
  return (
    <section className="mt-8 space-y-4 rounded-xl border border-[var(--line)] p-5">
      <h2 className="text-xl">Secure invoice link</h2>
      <p className="text-sm">
        Share the link through your approved customer channel. A replacement revokes previous access. Current link {revoked ? "revoked" : expires ? `expires ${expires} Kigali time` : "has not been issued"}.
      </p>
      <form action={action} onReset={(event) => event.preventDefault()} className="space-y-4">
        <input type="hidden" name="reference" value={reference} />
        <input type="hidden" name="currency" value={currency} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Valid for (days)
            <input className={input} name="expiryDays" type="number" min={1} max={14} defaultValue={7} required />
          </label>
          <label className="text-sm">First payment ({currency}, optional)
            <input className={input} name="deposit" inputMode={currency === "RWF" ? "numeric" : "decimal"} placeholder="Full balance by default" maxLength={30} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="command" value="issue" variant="accent" disabled={pending}>{pending ? "Saving…" : "Create or replace link"}</Button>
          {expires && !revoked ? <Button type="submit" name="command" value="revoke" variant="outline" disabled={pending}>Revoke link</Button> : null}
        </div>
      </form>
      {state.message ? <p role={state.error ? "alert" : "status"} className="text-sm">{state.message}</p> : null}
      {state.url ? (
        <label className="block text-sm">
          Copy this link for the customer
          <input className={input} value={state.url} readOnly onFocus={(event) => event.currentTarget.select()} />
        </label>
      ) : null}
    </section>
  );
}
