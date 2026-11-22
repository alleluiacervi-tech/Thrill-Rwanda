"use client";

import { useActionState } from "react";
import { recordGatewaySettlement } from "@/app/actions/collections";
import { Button } from "@/components/ui/button";

export function GatewaySettlementForm({ attemptId, currency, accounts }: {
  attemptId: string; currency: string; accounts: { id: string; name: string }[];
}) {
  const [state, action, busy] = useActionState(recordGatewaySettlement, {});
  if (!accounts.length) return <p className="text-xs">An approved settlement account in {currency} is required.</p>;
  const field = "block w-full rounded border border-[var(--line-strong)] bg-white p-2";
  return (
    <details>
      <summary className="cursor-pointer underline">Reconcile statement</summary>
      <form action={action} onReset={(event) => event.preventDefault()} className="mt-3 min-w-60 space-y-2">
        <input type="hidden" name="attemptId" value={attemptId} />
        <input type="hidden" name="currency" value={currency} />
        <label className="block">Bank account<select name="accountId" className={field} required defaultValue="">
          <option value="">Choose the account</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select></label>
        <label className="block">Statement reference<input name="statementRef" className={field} maxLength={160} required /></label>
        <label className="block">Statement credit date<input type="date" name="date" className={field} required /></label>
        <label className="block">Net bank credit ({currency})<input name="net" inputMode="numeric" className={field} required /></label>
        <label className="block">Provider fee ({currency})<input name="fee" inputMode="numeric" className={field} required defaultValue="0" /></label>
        <label className="block">Evidence reference<textarea name="evidence" minLength={10} maxLength={2000} className={field} required /></label>
        <label className="flex items-start gap-2"><input name="verified" type="checkbox" required /> I matched the credit and fee to the statement.</label>
        <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : "Record settlement"}</Button>
        {state.message ? <p role={state.error ? "alert" : "status"}>{state.message}</p> : null}
      </form>
    </details>
  );
}
