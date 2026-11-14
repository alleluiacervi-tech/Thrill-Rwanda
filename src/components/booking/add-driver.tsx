"use client";

import { useActionState } from "react";
import { AlertTriangle, CheckCircle2, UserRound } from "lucide-react";
import { requestDriver, type DriverRequestState } from "@/app/actions/booking";
import { Button } from "@/components/ui/button";

const initial: DriverRequestState = { status: "idle" };

/**
 * Adds a driver to a car hire booking after it was made.
 *
 * The price is shown before they commit, and the charge lands on the balance
 * they pay next rather than taking a separate payment.
 */
export function AddDriver({
  reference,
  perDay,
  days,
  total,
}: {
  reference: string;
  /** Formatted for display; the server recalculates from the vehicle. */
  perDay: string;
  days: number;
  total: string;
}) {
  const [state, action, pending] = useActionState(requestDriver, initial);

  if (state.status === "ok") {
    return (
      <p className="flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-forest-300 bg-forest-100 p-4 text-sm text-forest-900">
        <CheckCircle2 className="mt-px size-4 shrink-0" />
        {state.message}
      </p>
    );
  }

  return (
    <form
      action={action}
      className="rounded-[var(--radius-inset)] border border-[var(--line)] bg-[var(--paper-sunken)] p-4"
    >
      <input type="hidden" name="reference" value={reference} />

      <p className="flex items-start gap-2.5 text-sm text-[var(--ink)]">
        <UserRound className="mt-px size-4 shrink-0 text-clay-700" />
        <span>
          <span className="block font-medium">Need a driver after all?</span>
          <span className="mt-0.5 block text-2xs leading-relaxed text-[var(--ink-muted)]">
            {perDay} per day × {days} {days === 1 ? "day" : "days"} ={" "}
            <span className="font-semibold text-[var(--ink)]">{total}</span>, added to your balance.
          </span>
        </span>
      </p>

      {state.status === "error" && state.message ? (
        <p role="alert" className="mt-3 flex items-start gap-2 text-2xs font-medium text-red-700">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <Button type="submit" variant="outline" size="sm" className="mt-3" disabled={pending}>
        {pending ? "Adding…" : "Add a driver"}
      </Button>
    </form>
  );
}
