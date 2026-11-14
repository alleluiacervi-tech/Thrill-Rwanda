"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";
import { submitCancellation, type CancelState } from "@/app/actions/booking";
import { Button } from "@/components/ui/button";

const initial: CancelState = { status: "idle" };

/**
 * Cancellation is behind a confirm step because it releases inventory
 * immediately and can't be undone by the customer.
 */
export function CancelBookingForm({ reference }: { reference: string }) {
  const [confirming, setConfirming] = React.useState(false);
  const [state, action, pending] = useActionState(submitCancellation, initial);

  if (!confirming) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-sunken)] p-6">
        <h2 className="text-lg">Need to cancel?</h2>
        <p className="mt-2 text-2xs leading-relaxed text-[var(--ink-muted)]">
          Free up to 72 hours before the start date. After that the standard
          cancellation policy applies.
        </p>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 text-sm font-medium text-clay-700 underline underline-offset-4 hover:text-clay-900"
        >
          Cancel this booking
        </button>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="rounded-[var(--radius-card)] border border-red-200 bg-red-50 p-6"
    >
      <input type="hidden" name="reference" value={reference} />

      <h2 className="flex items-center gap-2 text-lg text-red-900">
        <AlertTriangle className="size-5" />
        Cancel this booking?
      </h2>
      <p className="mt-2 text-2xs leading-relaxed text-red-900/80">
        This releases your place immediately and can&rsquo;t be undone.
      </p>

      {state.status === "error" && state.message ? (
        <p role="alert" className="mt-4 text-2xs font-medium text-red-800">
          {state.message}
        </p>
      ) : null}

      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-red-900/70">
          Reason (optional)
        </span>
        <textarea
          name="reason"
          rows={2}
          className="w-full rounded-[var(--radius-inset)] border border-red-200 bg-white px-3 py-2 text-sm outline-none focus-visible:border-red-400"
          placeholder="Plans changed…"
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Cancelling…" : "Yes, cancel it"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
        >
          Keep booking
        </Button>
      </div>
    </form>
  );
}
