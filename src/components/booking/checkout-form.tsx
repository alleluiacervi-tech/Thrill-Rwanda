"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Building2, CreditCard, Lock, Phone } from "lucide-react";
import { confirmBooking, leaveCheckout, type ConfirmState } from "@/app/actions/checkout";
import { DocumentUpload, type UploadedDocument } from "@/components/booking/document-upload";
import { ProcessingOverlay } from "@/components/booking/processing-overlay";
import { SignaturePad } from "@/components/booking/signature-pad";
import { Labelled, fieldCls } from "@/components/dashboard/listing-fields";
import { Button } from "@/components/ui/button";
import { PaymentLogos, type PaymentMark } from "@/components/ui/payment-logos";
import { useSite } from "@/components/layout/site-context";

const initial: ConfirmState = { status: "idle" };

/** How this booking is paid: online now, by phone (gateway off), or at the hotel. */
export type CheckoutMode = "online" | "phone" | "property";

const METHOD_COPY: Record<
  CheckoutMode,
  { title: string; logos?: PaymentMark[]; chips: string[]; note: string }
> = {
  online: {
    title: "Pesapal — mobile money and cards",
    logos: ["mpesa", "airtel", "visa", "mastercard"],
    chips: [],
    note: "You'll complete payment securely on Pesapal's page next. We never see your card or PIN.",
  },
  phone: {
    title: "Pay by phone or WhatsApp",
    logos: ["mpesa"],
    chips: ["Bank transfer"],
    note: `Online payment is being switched on. Once you confirm, we'll call or WhatsApp you from {phone} to take payment.`,
  },
  property: {
    title: "Pay at the property",
    chips: ["On arrival"],
    note: "Nothing is paid online for a hotel stay. The property confirms your room, and you settle with them when you arrive.",
  },
};

/** Step two: how to pay, the agreement for car hire, the terms, then confirm. */
export function CheckoutForm({
  reference,
  buttonLabel,
  mode,
  note,
  agreement,
  documents = [],
  documentAccept = "",
  documentNotice,
}: {
  reference: string;
  /** e.g. "Confirm booking · Ksh 144,000" */
  buttonLabel: string;
  mode: CheckoutMode;
  /** Deposit wording, shown under the button when only part is charged now. */
  note?: string;
  /** Car hire, not yet signed: the agreement text, rendered on the server. */
  agreement?: React.ReactNode;
  /** Car hire: the licence and ID copies still to upload, or already uploaded. */
  documents?: { kind: string; label: string; hint: string; uploaded?: UploadedDocument }[];
  documentAccept?: string;
  documentNotice?: string;
}) {
  const site = useSite();
  const [state, action, pending] = useActionState(confirmBooking, initial);

  // A full navigation to the payment page, which embeds Pesapal.
  React.useEffect(() => {
    if (state.status === "redirect") window.location.href = state.url;
  }, [state]);

  // The agreement unlocks once its end has been scrolled into view.
  const [read, setRead] = React.useState(!agreement);
  const [hasInk, setHasInk] = React.useState(!agreement);
  // Every required document uploaded before Confirm unlocks.
  const [uploaded, setUploaded] = React.useState(
    () => new Set(documents.filter((d) => d.uploaded).map((d) => d.kind)),
  );
  const documentsDone = documents.every((d) => uploaded.has(d.kind));
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const checkRead = React.useCallback(() => {
    const el = scrollRef.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setRead(true);
  }, []);
  React.useEffect(() => {
    if (!agreement) return;
    checkRead();
    window.addEventListener("resize", checkRead);
    return () => window.removeEventListener("resize", checkRead);
  }, [agreement, checkRead]);

  // Dispatched by hand so a refused attempt keeps the typed name and terms tick.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    React.startTransition(() => action(data));
  }

  const leaving = state.status === "redirect";
  const blocked = state.status === "error" && !state.retryable;
  // The number in the note is the admin's current one.
  const copy = { ...METHOD_COPY[mode], note: METHOD_COPY[mode].note.replace("{phone}", site.contact.phone) };

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6 sm:p-8">
      {pending || leaving ? <ProcessingOverlay /> : null}
      <h2 className="text-2xl">{mode === "property" ? "How you pay" : "Choose a payment method"}</h2>

      <label className="mt-6 flex cursor-pointer items-start gap-4 rounded-[var(--radius-inset)] border-2 border-forest-800 bg-forest-100/40 p-5">
        <input type="radio" name="method" defaultChecked className="mt-1 size-4 shrink-0 accent-forest-800" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-medium">
            {mode === "property" ? <Building2 className="size-4 text-forest-700" /> : null}
            {copy.title}
          </span>
          <span className="mt-3 flex flex-wrap items-center gap-2">
            {copy.logos ? <PaymentLogos marks={copy.logos} /> : null}
            {copy.chips.map((m) => (
              <span
                key={m}
                className="rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-2 py-1 text-2xs font-semibold"
              >
                {m}
              </span>
            ))}
          </span>
        </span>
      </label>

      <p className="mt-3 flex items-start gap-2 text-2xs leading-relaxed text-[var(--ink-muted)]">
        <Lock className="mt-px size-3.5 shrink-0 text-forest-700" />
        {copy.note}
      </p>

      <form id="checkout" onSubmit={onSubmit} className="mt-6 space-y-5">
        <input type="hidden" name="reference" value={reference} />

        {documents.length ? (
          <section className="space-y-3">
            <div>
              <h3 className="text-lg">Your documents</h3>
              <p className="mt-1 text-2xs leading-relaxed text-[var(--ink-muted)]">
                {documentNotice ?? "Contact the desk to confirm the approved collection purpose and retention before uploading. Collection may be unavailable pending approval."}
              </p>
            </div>
            {documents.map((d) => (
              <DocumentUpload
                key={d.kind}
                reference={reference}
                kind={d.kind}
                label={d.label}
                hint={d.hint}
                accept={documentAccept}
                initial={d.uploaded}
                onChange={(ok) =>
                  setUploaded((prev) => {
                    const next = new Set(prev);
                    if (ok) next.add(d.kind);
                    return next;
                  })
                }
              />
            ))}
          </section>
        ) : null}

        {agreement ? (
          <section className="space-y-4">
            <div>
              <h3 className="text-lg">Car hire agreement</h3>
              <p className="mt-1 text-2xs leading-relaxed text-[var(--ink-muted)]">
                Filled in with your details and this vehicle. Read it to the end, then sign below.
              </p>
            </div>
            <div
              ref={scrollRef}
              onScroll={checkRead}
              className="max-h-80 overflow-y-auto rounded-[var(--radius-inset)] border border-[var(--line)] bg-[var(--paper-sunken)] p-5"
            >
              {agreement}
            </div>
            {!read ? (
              <p className="text-2xs text-[var(--ink-faint)]">Scroll to the end of the agreement to sign it.</p>
            ) : null}
            <fieldset disabled={!read} className="space-y-4 disabled:opacity-50">
              <Labelled label="Your full name" hint="As it appears on your driving licence.">
                <input name="signedName" required minLength={3} maxLength={120} className={fieldCls} />
              </Labelled>
              <SignaturePad name="signature" label="Signature" onChange={setHasInk} />
            </fieldset>
          </section>
        ) : null}

        <label className="flex items-start gap-3 rounded-[var(--radius-inset)] border border-[var(--line-strong)] p-4 text-sm leading-relaxed">
          <input type="checkbox" name="termsAccepted" required className="mt-1 size-4 shrink-0 accent-forest-800" />
          <span>
            I have read and agree to the{" "}
            <Link href="/legal/terms" target="_blank" className="link-draw text-clay-700">
              Terms and Conditions
            </Link>{" "}
            and the{" "}
            <Link href="/legal/cancellation" target="_blank" className="link-draw text-clay-700">
              Cancellation Policy
            </Link>{" "}
            of {site.name}.
          </span>
        </label>

        {state.status === "error" ? (
          <p
            role="alert"
            className="flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-red-200 bg-red-50 p-3 text-2xs leading-relaxed text-red-900"
          >
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            <span>{state.message}</span>
          </p>
        ) : null}
      </form>

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
        {/* Its own form: going back must not need the terms ticked. */}
        <form action={leaveCheckout}>
          <input type="hidden" name="reference" value={reference} />
          <Button type="submit" variant="outline" size="lg" className="w-full" disabled={pending || leaving}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </form>
        {blocked ? (
          <Button href={site.contact.phoneHref} variant="primary" size="lg" className="sm:flex-1">
            <Phone className="size-4" />
            Call {site.contact.phone}
          </Button>
        ) : (
          <Button
            type="submit"
            form="checkout"
            variant="accent"
            size="lg"
            className="sm:flex-1"
            disabled={pending || leaving || !read || !hasInk || !documentsDone}
          >
            <CreditCard className="size-4" />
            {pending || leaving ? (mode === "online" ? "Preparing payment…" : "Confirming…") : buttonLabel}
          </Button>
        )}
      </div>

      {!documentsDone ? (
        <p className="mt-4 text-2xs font-medium text-clay-800">Upload your documents above to confirm.</p>
      ) : null}
      {note ? <p className="mt-4 text-2xs text-[var(--ink-muted)]">{note}</p> : null}
      <p className="mt-2 text-2xs leading-relaxed text-[var(--ink-faint)]">
        Back releases the dates you&rsquo;re holding so you can change your details.
      </p>
    </div>
  );
}
