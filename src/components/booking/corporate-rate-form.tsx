"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { submitCorporateEnquiry, type CorporateEnquiryState } from "@/app/actions/corporate-enquiry";
import { Button } from "@/components/ui/button";
import { useSite } from "@/components/layout/site-context";
import { WhatsAppIcon } from "@/components/layout/whatsapp-button";
import { cn } from "@/lib/utils";

/**
 * Corporate rate-card request: opens WhatsApp with the details typed out and
 * emails the desk a copy, so the request survives even if the chat is never sent.
 */

const field =
  "w-full rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-4 py-3 text-sm text-[var(--ink)] outline-none transition-colors focus-visible:border-ember-500";

const labelCls =
  "flex flex-col gap-1.5 text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]";

export function CorporateRateForm({ className }: { className?: string }) {
  const site = useSite();
  const [state, action, pending] = React.useActionState<CorporateEnquiryState, FormData>(
    submitCorporateEnquiry,
    { status: "idle" },
  );
  const [waHref, setWaHref] = React.useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const get = (k: string) => String(data.get(k) ?? "").trim();
    const text = [
      `Hi ${site.name}, I need a corporate rate card for ${get("companyName")}.`,
      "",
      `Frequent routes: ${get("routes")}`,
      get("staff") ? `Staff travelling: ${get("staff")}` : null,
      `Email: ${get("email")}`,
      `WhatsApp: ${get("whatsapp")}`,
    ]
      .filter((l) => l !== null)
      .join("\n");
    const href = `${site.contact.whatsapp}?text=${encodeURIComponent(text)}`;
    setWaHref(href);
    // Opened inside the click, or the browser treats it as a pop-up.
    window.open(href, "_blank", "noopener,noreferrer");
    React.startTransition(() => action(data));
  }

  if (waHref && state.status !== "error" && state.status !== "idle") {
    return (
      <div className={cn("rounded-[var(--radius-card)] bg-[var(--paper-raised)] p-8 text-center text-[var(--ink)]", className)}>
        <CheckCircle2 className="mx-auto size-10 text-forest-700" />
        <h3 className="mt-4 text-xl">Request on its way</h3>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[var(--ink-muted)]">
          {state.status === "sent"
            ? "We've opened WhatsApp with your routes and emailed our team a copy. Expect your rate card shortly."
            : "We've opened WhatsApp with your routes. Press send there and we'll reply with your rate card."}
        </p>
        <Button href={waHref} variant="outline" size="md" className="mt-6" target="_blank" rel="noopener noreferrer">
          WhatsApp didn&rsquo;t open? Tap here
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn("space-y-4 rounded-[var(--radius-card)] bg-[var(--paper-raised)] p-6 text-left shadow-[var(--shadow-lift)] sm:p-8", className)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelCls}>
          Company name
          <input name="companyName" required minLength={2} maxLength={160} autoComplete="organization" className={field} />
        </label>
        <label className={labelCls}>
          Email
          <input name="email" type="email" required autoComplete="email" className={field} />
        </label>
        <label className={labelCls}>
          WhatsApp
          <input name="whatsapp" type="tel" required minLength={7} autoComplete="tel" placeholder="+250 7…" className={field} />
        </label>
        <label className={labelCls}>
          No. of staff
          <input name="staff" inputMode="numeric" maxLength={40} placeholder="e.g. 25" className={field} />
        </label>
      </div>
      <label className={labelCls}>
        Frequent routes
        <textarea
          name="routes"
          required
          minLength={3}
          rows={3}
          placeholder="e.g. Kigali Airport → Kiyovu, Kiyovu → office daily, Kigali → Musanze"
          className={cn(field, "resize-y")}
        />
      </label>

      {/* Honeypot: hidden from people, irresistible to bots. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      {state.status === "error" ? (
        <p role="alert" className="text-2xs font-medium text-red-700">{state.message}</p>
      ) : null}

      <Button type="submit" variant="accent" size="lg" className="w-full gap-2" disabled={pending}>
        <WhatsAppIcon className="size-5 fill-current" />
        Get rate card on WhatsApp
      </Button>
      <p className="text-center text-2xs text-[var(--ink-faint)]">
        Opens WhatsApp with your details filled in. No calls, no negotiations.
      </p>
    </form>
  );
}
