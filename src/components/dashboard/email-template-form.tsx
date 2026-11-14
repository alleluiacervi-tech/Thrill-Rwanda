"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import {
  resetEmailTemplate,
  saveEmailTemplate,
  type EmailTemplateState,
} from "@/app/actions/email-templates";
import { Labelled, fieldCls } from "@/components/dashboard/listing-fields";
import { Button } from "@/components/ui/button";
import { fill, type Placeholder } from "@/lib/email/template-data";
import { cn } from "@/lib/utils";

const initial: EmailTemplateState = { status: "idle" };

/**
 * Rewording one customer email.
 *
 * The preview updates as they type, with sample values in the placeholders,
 * so an admin sees the sentence a customer will read rather than the raw
 * {tokens}.
 */
export function EmailTemplateForm({
  templateKey,
  label,
  when,
  subject,
  body,
  ctaLabel,
  edited,
  placeholders,
  samples,
}: {
  templateKey: string;
  label: string;
  when: string;
  subject: string;
  body: string;
  ctaLabel: string;
  /** True when an admin's wording is in use rather than the built-in copy. */
  edited: boolean;
  placeholders: Placeholder[];
  samples: Record<string, string>;
}) {
  const [state, action, pending] = useActionState(saveEmailTemplate, initial);
  const [resetState, resetAction, resetting] = useActionState(resetEmailTemplate, initial);

  const [draftSubject, setDraftSubject] = React.useState(subject);
  const [draftBody, setDraftBody] = React.useState(body);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  // Until they click into the message, the cursor sits at 0 — append instead.
  const placed = React.useRef(false);

  // Inserts at the cursor, so a placeholder lands where they are writing.
  const insert = (token: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = placed.current ? el.selectionStart : draftBody.length;
    const end = placed.current ? el.selectionEnd : start;
    const next = draftBody.slice(0, start) + token + draftBody.slice(end);
    setDraftBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const previewSubject = fill(draftSubject, samples);
  const previewParagraphs = fill(draftBody, samples)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <form
        action={action}
        className="space-y-5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6"
      >
        <input type="hidden" name="key" value={templateKey} />

        <div>
          <h2 className="text-xl">{label}</h2>
          <p className="mt-1.5 text-sm text-[var(--ink-muted)]">{when}</p>
          <p className="mt-2 text-2xs text-[var(--ink-faint)]">
            {edited ? "Using your wording." : "Using the built-in wording."}
          </p>
        </div>

        {state.status === "saved" ? (
          <p className="flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-forest-300 bg-forest-100 p-3.5 text-sm text-forest-900">
            <CheckCircle2 className="mt-px size-4 shrink-0" />
            Saved. Customers receive this wording from now on.
          </p>
        ) : null}
        {resetState.status === "reset" ? (
          <p className="flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-forest-300 bg-forest-100 p-3.5 text-sm text-forest-900">
            <CheckCircle2 className="mt-px size-4 shrink-0" />
            Restored. Reload to see the built-in wording.
          </p>
        ) : null}
        {state.status === "error" ? (
          <p role="alert" className="flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-red-200 bg-red-50 p-3.5 text-sm text-red-900">
            <AlertTriangle className="mt-px size-4 shrink-0" />
            {state.message}
          </p>
        ) : null}

        <Labelled label="Subject">
          <input
            name="subject"
            value={draftSubject}
            onChange={(e) => setDraftSubject(e.target.value)}
            required
            maxLength={200}
            className={fieldCls}
          />
        </Labelled>

        <Labelled label="Message" hint="Leave a blank line between paragraphs.">
          <textarea
            ref={bodyRef}
            onFocus={() => (placed.current = true)}
            name="body"
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            required
            rows={10}
            className={cn(fieldCls, "resize-y leading-relaxed")}
          />
        </Labelled>

        <div>
          <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
            Insert a detail
          </p>
          <div className="flex flex-wrap gap-1.5">
            {placeholders.map((p) => (
              <button
                key={p.token}
                type="button"
                onClick={() => insert(p.token)}
                title={p.describes}
                className="rounded-full border border-[var(--line-strong)] px-2.5 py-1 font-mono text-2xs text-[var(--ink-muted)] transition-colors hover:border-forest-800 hover:text-[var(--ink)]"
              >
                {p.token}
              </button>
            ))}
          </div>
        </div>

        <Labelled label="Button label" hint="Leave blank to keep the standard one.">
          <input name="ctaLabel" defaultValue={ctaLabel} maxLength={60} className={fieldCls} />
        </Labelled>

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-4">
          <Button type="submit" variant="accent" disabled={pending}>
            {pending ? "Saving…" : "Save wording"}
          </Button>
        </div>
      </form>

      <div className="space-y-4">
        <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6">
          <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
            Preview, with example details
          </p>
          <p className="mt-3 text-sm">
            <span className="text-[var(--ink-muted)]">Subject: </span>
            <span className="font-medium">{previewSubject}</span>
          </p>
          <div className="mt-4 space-y-3 border-t border-[var(--line)] pt-4">
            <p className="text-sm text-[var(--ink-muted)]">Hi {samples.customerName},</p>
            {previewParagraphs.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-[var(--ink-muted)]">
                {p}
              </p>
            ))}
          </div>
        </div>

        {edited ? (
          <form action={resetAction}>
            <input type="hidden" name="key" value={templateKey} />
            <Button type="submit" variant="quiet" size="sm" disabled={resetting}>
              <RotateCcw className="size-3.5" />
              {resetting ? "Restoring…" : "Restore the built-in wording"}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
