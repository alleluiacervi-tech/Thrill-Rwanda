"use client";
import { useActionState } from "react";
import { recordClientAction } from "@/app/actions/client-portal";
import type { OperationsState } from "@/lib/launch-rules";
import { Button } from "@/components/ui/button";
export function ClientCaseForm({
  hidden,
  accept = false,
}: {
  hidden: Record<string, string | number>;
  accept?: boolean;
}) {
  const [state, action, pending] = useActionState(recordClientAction, {
    status: "idle",
  } as OperationsState);
  const field =
    "mt-2 block w-full rounded border border-[var(--line-strong)] bg-[var(--paper-raised)] p-3";
  return (
    <form
      action={action}
      onReset={(e) => e.preventDefault()}
      className="my-6 space-y-4 rounded-xl border border-[var(--line)] p-5"
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {state.message && (
        <p role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      )}
      {accept ? (
        <>
          <label className="block">
            Your full name
            <input
              name="signedName"
              required
              minLength={3}
              maxLength={120}
              className={field}
            />
          </label>
          <label className="flex gap-3">
            <input
              name="checked"
              type="checkbox"
              required
              className="size-5 shrink-0"
            />
            I have read this exact quotation, its validity, payment deadline,
            supplier conditions and change/cancellation terms and accept it.
          </label>
        </>
      ) : (
        <>
          <label className="block">
            What do you need?
            <select name="category" className={field}>
              {["CHANGE", "CANCELLATION", "REFUND", "SERVICE", "OTHER"].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </select>
          </label>
          <label className="block">
            Your request
            <textarea
              name="message"
              required
              minLength={10}
              maxLength={2000}
              className={field}
            />
          </label>
          <p className="text-sm">
            Do not include passport scans, card details or passwords. For
            immediate danger use local emergency assistance.
          </p>
        </>
      )}
      <Button type="submit" disabled={pending || state.status === "ok"}>
        {pending
          ? "Saving…"
          : accept
            ? "Accept this quotation"
            : "Request support"}
      </Button>
    </form>
  );
}
