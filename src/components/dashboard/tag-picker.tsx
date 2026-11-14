"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Writes a hidden newline-joined input, the shape toList() already parses, so
// the server actions never had to learn about chips.
export function TagPicker({
  name,
  label,
  hint,
  suggestions,
  defaultValue = [],
  max = 30,
}: {
  name: string;
  label: string;
  hint?: string;
  suggestions: readonly string[];
  defaultValue?: string[];
  max?: number;
}) {
  const [tags, setTags] = React.useState<string[]>(defaultValue);
  const [draft, setDraft] = React.useState("");

  // Case-insensitive so "Wi-Fi" typed as "wifi" isn't added twice.
  const has = (v: string) =>
    tags.some((t) => t.toLowerCase() === v.trim().toLowerCase());

  function add(raw: string) {
    const value = raw.trim();
    if (!value || has(value) || tags.length >= max) return false;
    setTags((t) => [...t, value]);
    return true;
  }

  const unused = suggestions.filter((s) => !has(s));

  return (
    <div className="space-y-2.5">
      <input type="hidden" name={name} value={tags.join("\n")} />

      <span className="block text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
        {label}
      </span>

      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <li key={t}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-forest-300 bg-forest-100 py-1 pl-3 pr-1.5 text-sm text-forest-900">
                {t}
                <button
                  type="button"
                  onClick={() => setTags((cur) => cur.filter((x) => x !== t))}
                  aria-label={`Remove ${t}`}
                  className="grid size-5 place-items-center rounded-full transition-colors hover:bg-forest-800 hover:text-bone-50"
                >
                  <X className="size-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter inside a form submits it. Adding a tag is not submitting.
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (add(draft)) setDraft("");
          }}
          placeholder="Add a feature"
          className="w-full rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-4 py-2.5 text-sm outline-none transition-colors focus-visible:border-ember-500"
        />
        <button
          type="button"
          onClick={() => {
            if (add(draft)) setDraft("");
          }}
          aria-label="Add feature"
          className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-inset)] border border-[var(--line-strong)] transition-colors hover:border-forest-800 hover:bg-forest-800 hover:text-bone-50"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {unused.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {unused.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => add(s)}
                className={cn(
                  "rounded-full border border-[var(--line-strong)] px-3.5 py-1.5 text-sm text-[var(--ink-muted)] transition-colors",
                  "hover:border-forest-800 hover:text-[var(--ink)]",
                )}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {hint ? (
        <p className="text-2xs text-[var(--ink-faint)]">{hint}</p>
      ) : null}
    </div>
  );
}
