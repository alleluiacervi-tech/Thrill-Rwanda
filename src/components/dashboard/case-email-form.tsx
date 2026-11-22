"use client";
import { useActionState } from "react";
import { sendCaseEmail } from "@/app/actions/case-email";
import { Button } from "@/components/ui/button";
import type { EnquiryActionState } from "@/lib/enquiry-workflow";

const field = "mt-1 w-full rounded-lg border border-[var(--line)] p-3";
export function CaseEmailForm({ reference, version, email }: { reference: string; version: number; email: string }) {
  const [state, action, pending] = useActionState(sendCaseEmail, { status: "idle" } as EnquiryActionState);
  return (
    <form action={action} onReset={(event) => event.preventDefault()} className="my-6 space-y-4 rounded-xl border border-[var(--line)] p-5">
      <h2 className="text-xl">Email the client</h2>
      <p>To {email}</p>
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="version" value={version} />
      <fieldset key={version} disabled={pending} className="space-y-3">
        <label className="block">Subject<input name="subject" className={field} required maxLength={150} /></label>
        <label className="block">Message<textarea name="body" className={field} rows={4} required maxLength={5000} /></label>
        <Button type="submit">{pending ? "Queuing…" : "Queue email"}</Button>
      </fieldset>
      {state.message && <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    </form>
  );
}
