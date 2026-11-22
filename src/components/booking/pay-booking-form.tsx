"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertTriangle, Lock, Phone } from "lucide-react";
import { beginPayment, type CheckoutState } from "@/app/actions/payment";
import { ProcessingOverlay } from "@/components/booking/processing-overlay";
import { Button } from "@/components/ui/button";
import { useSite } from "@/components/layout/site-context";

const initial: CheckoutState = { status: "idle" };

/**
 * Opens the booking's payment page.
 *
 * The action returns a URL rather than redirecting so a gateway failure
 * renders here, next to the amount, instead of on a blank error screen.
 */
export function PayBookingForm({
  reference,
  amount,
  kind = "full",
  balanceAfter,
}: {
  reference: string;
  amount: string;
  /** Which payment this is, so the button says what is actually being charged. */
  kind?: "full" | "deposit" | "balance";
  /** What will still be owed after a deposit. */
  balanceAfter?: string;
}) {
  const site = useSite();
  const [state, action, pending] = useActionState(beginPayment, initial);

  React.useEffect(() => {
    if (state.status === "redirect") window.location.href = state.url;
  }, [state]);

  const leaving = state.status === "redirect";
  // A gateway cap or account setting will reject every retry identically, so
  // the Pay button is replaced rather than left there inviting a dead end.
  const blocked = state.status === "error" && !state.retryable;

  return (
    <form action={action} className="mt-5">
      {pending || leaving ? <ProcessingOverlay title="Preparing your payment…" /> : null}
      <input type="hidden" name="reference" value={reference} />

      {state.status === "error" ? (
        <p
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-red-200 bg-red-50 p-3 text-2xs leading-relaxed text-red-900"
        >
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          <span>{state.message}</span>
        </p>
      ) : null}

      {blocked ? (
        <a
          href={site.contact.phoneHref}
          className="flex items-center justify-center gap-2 rounded-full border border-[var(--line-strong)] px-5 py-3 text-sm font-medium transition-colors hover:border-forest-800 hover:bg-forest-800 hover:text-bone-50"
        >
          <Phone className="size-4" />
          Call {site.contact.phone}
        </a>
      ) : (
        <Button type="submit" variant="accent" className="w-full" disabled={pending || leaving}>
          {pending || leaving
          ? "Preparing payment…"
          : kind === "deposit"
            ? `Pay ${amount} deposit`
            : kind === "balance"
              ? `Pay balance ${amount}`
              : `Pay ${amount}`}
        </Button>
      )}

      {!blocked && balanceAfter ? (
        <p className="mt-3 text-center text-2xs text-[var(--ink-muted)]">
          The remaining {balanceAfter} is paid later from this page.
        </p>
      ) : null}

      <p className="mt-3 flex items-start gap-2 text-2xs leading-relaxed text-[var(--ink-muted)]">
        {blocked ? (
          <span>
            Quote your reference{" "}
            <span className="tnum font-semibold">{reference}</span> and we will
            share approved payment instructions.
          </span>
        ) : (
          <>
            <Lock className="mt-px size-3.5 shrink-0 text-forest-700" />
            <span>
              Review verified payments and available payment methods in checkout.
            </span>
          </>
        )}
      </p>
    </form>
  );
}
