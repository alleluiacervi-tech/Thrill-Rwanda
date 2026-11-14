"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Search box over a server-rendered table.
 *
 * The term lives in the URL, so a search is linkable and the back button
 * works. Submitting returns to page 1 — page 4 of the old result set would
 * otherwise be an empty table.
 */
export function TableSearch({
  pathname,
  placeholder,
  label = "Search",
  className,
}: {
  pathname: string;
  /** Name the fields being searched, e.g. "Search reference, customer or provider". */
  placeholder: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("q") ?? "";
  const [value, setValue] = React.useState(current);

  // Keeps the box in step with the URL when the back button or a filter chip changes it.
  const [seen, setSeen] = React.useState(current);
  if (current !== seen) {
    setSeen(current);
    setValue(current);
  }

  const go = (term: string) => {
    const next = new URLSearchParams(params.toString());
    if (term.trim()) next.set("q", term.trim());
    else next.delete("q");
    next.delete("page");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
      className={cn("relative w-full sm:w-80", className)}
    >
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-faint)]"
      />
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={label}
        placeholder={placeholder}
        className="w-full rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] py-2.5 pl-10 pr-20 text-sm outline-none transition-colors focus-visible:border-ember-500"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            setValue("");
            go("");
          }}
          aria-label="Clear search"
          className="absolute right-16 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-[var(--paper-sunken)] hover:text-[var(--ink)]"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
      <button
        type="submit"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[calc(var(--radius-inset)-2px)] bg-forest-800 px-3 py-1.5 text-2xs font-semibold text-bone-50 transition-colors hover:bg-forest-900"
      >
        Search
      </button>
    </form>
  );
}
