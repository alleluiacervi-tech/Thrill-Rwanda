"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared field furniture for the listing forms. Extracted so vehicle, tour
 * and hotel forms stay visually identical — three hand-rolled copies drift
 * the moment one of them gets a tweak.
 */

// Neutral grey placeholder, not the warm bone-500 the rest of the palette
// uses — against near-black values a brown placeholder reads as dim text
// rather than as a hint.
export const fieldCls =
  "w-full rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-4 py-3 text-sm text-[var(--ink)] placeholder:text-[#9a9a9a] outline-none transition-colors focus-visible:border-ember-500";

const labelCls =
  "flex flex-col gap-1.5 text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]";

export function Labelled({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn(labelCls, className)}>
      {label}
      {children}
      {hint && !error ? (
        <span className="font-normal normal-case tracking-normal text-[var(--ink-faint)]">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="font-medium normal-case tracking-normal text-red-700">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function FormBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-3 rounded-[var(--radius-inset)] border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-900"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}

export type ProviderOption = {
  id: string;
  businessName: string;
  kind: "CAR" | "HOTEL" | "TOUR";
};

const KIND_LABEL = {
  CAR: "car hire",
  HOTEL: "hotel owner",
  TOUR: "tour operator",
} as const;

// Admin only. A provider never sees this and never submits `providerId`.
export function ProviderSelect({
  providers,
  error,
  defaultValue,
}: {
  providers: ProviderOption[];
  error?: string;
  defaultValue?: string;
}) {
  if (providers.length === 0) {
    return (
      <p className="flex items-start gap-3 rounded-[var(--radius-inset)] border border-clay-300 bg-clay-100 p-4 text-2xs leading-relaxed text-clay-900">
        <AlertTriangle className="mt-px size-4 shrink-0" />
        <span>
          There are no verified providers to attribute a listing to. Approve a
          provider first — a listing has to belong to someone who is cleared to
          trade.
        </span>
      </p>
    );
  }

  return (
    <Labelled
      label="Listing belongs to"
      hint="You are posting on a provider's behalf. They will see it in their own dashboard."
      error={error}
    >
      <select name="providerId" required defaultValue={defaultValue ?? ""} className={fieldCls}>
        <option value="" disabled>
          Choose a provider…
        </option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.businessName} — {KIND_LABEL[p.kind]}
          </option>
        ))}
      </select>
    </Labelled>
  );
}

/** The "this is a draft" explainer every listing form ends with. */
export function DraftNotice({ noun }: { noun: string }) {
  return (
    <p className="flex items-start gap-3 rounded-[var(--radius-inset)] border border-[var(--line)] bg-[var(--paper-sunken)] p-4 text-2xs leading-relaxed text-[var(--ink-muted)]">
      <Info className="mt-px size-4 shrink-0 text-clay-700" />
      {/* Wrapped: in a flex row, the `strong` and the text either side of it
          would each become their own flex item and sit in columns. */}
      <span>
        Saving creates the {noun} as a <strong>draft</strong> and opens its
        calendar for 365 days. Nothing is bookable until you publish it.
      </span>
    </p>
  );
}

/** Shared success panel. */
export function ListingSaved({
  title,
  body,
  previewHref,
  onDone,
}: {
  title: string;
  body: string;
  previewHref: string;
  onDone: () => void;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-forest-300 bg-forest-100 p-8 text-center">
      <CheckCircle2 className="mx-auto size-10 text-forest-600" />
      <h2 className="mt-5 text-2xl text-forest-900">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-forest-800/80">
        {body}
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button variant="accent" onClick={onDone}>
          Go to listings
        </Button>
        <Button href={previewHref} variant="quiet">
          Preview page
        </Button>
      </div>
    </div>
  );
}
