"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { signAgreement, type SignState } from "@/app/actions/agreement";
import { SignaturePad } from "@/components/booking/signature-pad";
import { Labelled, fieldCls } from "@/components/dashboard/listing-fields";
import { Button } from "@/components/ui/button";

const initial: SignState = { status: "idle" };

/**
 * Reading and signing the hire agreement.
 *
 * The customer must scroll to the end before the signature box unlocks: a
 * signature on a document they could not have read is worth little if it is
 * ever disputed.
 */
export function AgreementSigner({
  reference,
  children,
}: {
  reference: string;
  /** The agreement text, rendered by the page. */
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(signAgreement, initial);
  const [read, setRead] = React.useState(false);
  const [hasInk, setHasInk] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Read means the bottom of the text has been on screen. Measured from the scroll
  // position with a little slack: a 1px marker at threshold 1 could miss on rounding
  // and leave someone unable to sign at all.
  const checkRead = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setRead(true);
  }, []);

  // A short agreement that fits without scrolling counts as read straight away.
  React.useEffect(() => {
    checkRead();
    window.addEventListener("resize", checkRead);
    return () => window.removeEventListener("resize", checkRead);
  }, [checkRead]);

  if (state.status === "signed") {
    return (
      <div className="rounded-[var(--radius-card)] border border-forest-300 bg-forest-100 p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-forest-600" />
        <h2 className="mt-5 text-2xl text-forest-900">Agreement signed</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-forest-800/80">
          A copy is kept with booking {reference}. You can read it any time from your booking page.
        </p>
        <Button
          variant="primary"
          className="mt-7"
          onClick={() => {
            router.push(`/account/bookings/${reference}`);
            router.refresh();
          }}
        >
          Back to the booking
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="reference" value={reference} />

      <div
        ref={scrollRef}
        onScroll={checkRead}
        className="max-h-[32rem] overflow-y-auto rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-7"
      >
        {children}
      </div>

      {!read ? (
        <p className="text-2xs text-[var(--ink-faint)]">
          Scroll to the end of the agreement to sign it.
        </p>
      ) : null}

      <fieldset
        disabled={!read}
        className="space-y-5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-7 disabled:opacity-50"
      >
        <Labelled
          label="Your full name"
          hint="As it appears on your driving licence."
        >
          <input name="signedName" required maxLength={120} className={fieldCls} />
        </Labelled>

        <SignaturePad name="signature" label="Signature" onChange={setHasInk} />

        {state.status === "error" ? (
          <p role="alert" className="flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-red-200 bg-red-50 p-3.5 text-sm text-red-900">
            <AlertTriangle className="mt-px size-4 shrink-0" />
            {state.message}
          </p>
        ) : null}

        <Button type="submit" variant="accent" size="lg" disabled={pending || !hasInk}>
          {pending ? "Saving…" : "Sign the agreement"}
        </Button>

        <p className="text-2xs leading-relaxed text-[var(--ink-faint)]">
          Signing records your name, your signature and the date against this booking.
        </p>
      </fieldset>
    </form>
  );
}
