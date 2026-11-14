"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { saveLegalDocument, type LegalState } from "@/app/actions/legal";
import { Labelled, fieldCls } from "@/components/dashboard/listing-fields";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const initial: LegalState = { status: "idle" };

/**
 * Paste-in editor for a legal document.
 *
 * Deliberately plain text, not a rich editor: these documents arrive as Word
 * files or emails, and pasting them should not bring formatting with it. A
 * blank line starts a paragraph, and a short line on its own becomes a
 * heading.
 */
export function LegalForm({
  slug,
  title,
  body,
  version,
  updatedAt,
  publicHref,
}: {
  slug: string;
  title: string;
  body: string;
  version: number;
  updatedAt: string | null;
  /** Null for documents with no public page, like the hire agreement. */
  publicHref?: string | null;
}) {
  const [state, action, pending] = useActionState(saveLegalDocument, initial);
  const [draft, setDraft] = React.useState(body);

  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <form action={action} className="space-y-6 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-7">
      <input type="hidden" name="slug" value={slug} />

      {state.status === "saved" ? (
        <p className="flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-forest-300 bg-forest-100 p-4 text-sm text-forest-900">
          <CheckCircle2 className="mt-px size-4 shrink-0" />
          Saved as version {state.version}. It is live on the website now, and new bookings record
          this version.
        </p>
      ) : null}

      {state.status === "error" ? (
        <p role="alert" className="flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <AlertTriangle className="mt-px size-4 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-2xs text-[var(--ink-faint)]">
          {version > 0 ? (
            <>
              Version {version}
              {updatedAt ? ` · saved ${updatedAt}` : null}
            </>
          ) : (
            "Not published yet — the website is showing the built-in draft."
          )}
        </p>
        {publicHref ? (
          <a
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-2xs font-semibold text-forest-800 hover:text-forest-950"
          >
            <ExternalLink className="size-3.5" />
            View the page
          </a>
        ) : null}
      </div>

      <Labelled label="Title">
        <input name="title" defaultValue={title} required maxLength={160} className={fieldCls} />
      </Labelled>

      <Labelled
        label="Document"
        hint="Paste the text. Leave a blank line between paragraphs; a short line on its own becomes a heading."
      >
        <textarea
          name="body"
          required
          rows={24}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={cn(fieldCls, "resize-y font-sans leading-relaxed")}
        />
      </Labelled>

      <div className="flex flex-wrap items-center gap-4 border-t border-[var(--line)] pt-5">
        <Button type="submit" variant="accent" disabled={pending || draft.trim().length < 50}>
          {pending ? "Saving…" : version > 0 ? "Save new version" : "Publish"}
        </Button>
        <span className="tnum text-2xs text-[var(--ink-faint)]">{words} words</span>
      </div>
    </form>
  );
}
