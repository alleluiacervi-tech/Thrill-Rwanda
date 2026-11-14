"use client";

import * as React from "react";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { submitEnquiry, type EnquiryState } from "@/app/actions/enquiry";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/layout/whatsapp-button";
import { useSite } from "@/components/layout/site-context";
import { cn, formatMoney } from "@/lib/utils";

const initial: EnquiryState = { status: "idle" };

const field =
  "w-full rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-4 py-3 text-sm outline-none transition-colors focus-visible:border-lake-600";

const labelCls =
  "flex flex-col gap-1.5 text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]";

export function EnquiryForm({ className }: { className?: string }) {
  const site = useSite();
  const [state, action, pending] = useActionState(submitEnquiry, initial);
  const params = useSearchParams();
  const formRef = React.useRef<HTMLFormElement>(null);

  /**
   * The same enquiry, sent over WhatsApp instead of email.
   *
   * Built from what is typed rather than submitted to us first: the customer
   * sees the message in their own WhatsApp and presses send, which is what
   * makes it feel like their conversation rather than our form.
   */
  function openWhatsApp() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const value = (name: string) => String(data.get(name) ?? "").trim();

    const lines = [
      `Hi ${site.name}, I'd like to ask about ${value("subject") || "a trip"}.`,
      "",
      value("message"),
      "",
      `— ${value("name")}${value("email") ? ` · ${value("email")}` : ""}`,
    ].filter((line, i, all) => line !== "" || all[i - 1] !== "");

    window.open(
      `${site.contact.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  /**
   * BookingPanel and TransferForm hand off here with the request in the
   * query string, so the customer never retypes what they already chose.
   */
  const subject = params.get("subject") ?? "";
  const prefill = React.useMemo(() => {
    const bits: string[] = [];
    const from = params.get("from");
    const to = params.get("to");
    const date = params.get("date");
    const time = params.get("time");
    const guests = params.get("guests");
    const flight = params.get("flight");
    const notes = params.get("notes");
    const quote = params.get("quote");

    if (subject) bits.push(`Interested in: ${subject}`);

    // BookingPanel sends from/to as a date range; TransferForm sends them as
    // places plus a separate date. Distinguish on whether `date` is present.
    if (from && to) {
      bits.push(date ? `Route: ${from} → ${to}` : `Dates: ${from} → ${to}`);
    } else if (from) {
      bits.push(`From: ${from}`);
    }

    if (date) bits.push(`Date: ${date}${time ? ` at ${time}` : ""}`);
    if (guests) bits.push(`Guests / passengers: ${guests}`);
    if (flight) bits.push(`Flight: ${flight}`);
    if (quote && Number(quote) > 0)
      bits.push(`Indicative quote: ${formatMoney(Number(quote))}`);
    if (notes) bits.push(`Notes: ${notes}`);

    return bits.length ? `${bits.join("\n")}\n\n` : "";
  }, [params, subject]);

  if (state.status === "success") {
    return (
      <div
        className={cn(
          "rounded-[var(--radius-card)] border border-forest-300 bg-forest-100 p-8 text-center",
          className,
        )}
      >
        <CheckCircle2 className="mx-auto size-10 text-forest-600" />
        <h3 className="mt-5 text-2xl text-forest-900">Enquiry received</h3>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-forest-800/80">
          {state.message}
        </p>
        <Button href="/tours" variant="outline" className="mt-7">
          Keep browsing
        </Button>
      </div>
    );
  }

  const err = state.fieldErrors ?? {};

  return (
    <form
      ref={formRef}
      action={action}
      className={cn(
        "space-y-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6 shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      {state.status === "unconfigured" && (
        <Notice tone="warn" icon={Info}>
          {state.message}{" "}
          <a href={site.contact.whatsapp} className="link-draw font-medium">
            Open WhatsApp
          </a>
        </Notice>
      )}
      {state.status === "error" && (
        <Notice tone="error" icon={AlertTriangle}>
          {state.message}
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelCls}>
          Your name
          <input name="name" required autoComplete="name" className={field} />
          <FieldError message={err.name} />
        </label>
        <label className={labelCls}>
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className={field}
          />
          <FieldError message={err.email} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelCls}>
          Phone / WhatsApp
          <input
            name="phone"
            autoComplete="tel"
            placeholder="+250…"
            className={field}
          />
        </label>
        <label className={labelCls}>
          Subject
          <input
            name="subject"
            defaultValue={subject}
            placeholder="Safari, transfer, car hire…"
            className={field}
          />
        </label>
      </div>

      <label className={labelCls}>
        Your message
        <textarea
          name="message"
          required
          rows={7}
          defaultValue={prefill}
          placeholder="Dates, how many of you, and anything you already have in mind."
          className={cn(field, "resize-y leading-relaxed")}
        />
        <FieldError message={err.message} />
      </label>

      {/* Honeypot — hidden from people, irresistible to bots. */}
      <div aria-hidden className="hidden">
        <label>
          Company
          <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button type="submit" variant="accent" size="lg" disabled={pending}>
          {pending ? "Sending…" : "Send by email"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={openWhatsApp}
          className="border-[#25D366] text-[#128C4A] hover:bg-[#25D366]/10"
        >
          <WhatsAppIcon className="size-5" />
          Send on WhatsApp
        </Button>
      </div>

      <p className="text-center text-2xs leading-relaxed text-[var(--ink-faint)]">
        We use your details only to answer this enquiry. No marketing, no
        sharing with third parties.
      </p>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="text-2xs font-medium normal-case tracking-normal text-red-700">
      {message}
    </span>
  );
}

function Notice({
  children,
  tone,
  icon: Icon,
}: {
  children: React.ReactNode;
  tone: "warn" | "error";
  icon: React.ElementType;
}) {
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-inset)] border p-4 text-sm leading-relaxed",
        tone === "warn"
          ? "border-clay-300 bg-clay-100 text-clay-900"
          : "border-red-200 bg-red-50 text-red-900",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
