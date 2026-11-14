"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterGroup = {
  /** Query-string key this group writes to. */
  key: string;
  label: string;
  options: { value: string; label: string }[];
};

export type SortOption = { value: string; label: string };

/**
 * URL-driven filters. All state lives in the query string, so a filtered
 * view is shareable, bookmarkable and survives a refresh — and the server
 * component doing the filtering stays the single source of truth.
 */
export function FilterBar({
  groups,
  sorts,
  resultCount,
  className,
  searchLabel = "Search",
}: {
  groups: FilterGroup[];
  sorts: SortOption[];
  resultCount: number;
  className?: string;
  /** Doubles as the box's placeholder, so name the fields: "Search safaris". */
  searchLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [openOnMobile, setOpenOnMobile] = React.useState(false);

  const urlTerm = params.get("q") ?? "";
  const [term, setTerm] = React.useState(urlTerm);
  // Keeps the box in step with the URL when the back button or "clear all" changes it.
  const [seenTerm, setSeenTerm] = React.useState(urlTerm);
  if (urlTerm !== seenTerm) {
    setSeenTerm(urlTerm);
    setTerm(urlTerm);
  }

  const current = React.useCallback(
    (key: string) => params.get(key) ?? "",
    [params],
  );

  function apply(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || next.get(key) === value) next.delete(key);
    else next.set(key, value);
    // Page 3 of the old result set is usually empty under a new filter.
    next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function clearAll() {
    router.replace(pathname, { scroll: false });
  }

  const activeCount = groups.reduce(
    (n, g) => n + (current(g.key) ? 1 : 0),
    0,
  );

  return (
    <div
      className={cn(
        "sticky top-[4.5rem] z-30 border-y border-[var(--line)] bg-[color-mix(in_oklab,white_92%,transparent)] backdrop-blur-xl",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-[110rem] flex-wrap items-center gap-3 px-5 py-3 sm:px-8">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            apply("q", term.trim());
          }}
          className="relative order-first w-full sm:w-64"
        >
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-faint)]"
          />
          <input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label={searchLabel}
            placeholder={searchLabel}
            className="w-full rounded-full border border-[var(--line-strong)] bg-[var(--paper-raised)] py-2 pl-9 pr-9 text-sm outline-none transition-colors focus-visible:border-lake-600"
          />
          {term ? (
            <button
              type="button"
              onClick={() => {
                setTerm("");
                apply("q", "");
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-[var(--ink-faint)] hover:text-[var(--ink)]"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </form>

        <button
          type="button"
          onClick={() => setOpenOnMobile((v) => !v)}
          aria-expanded={openOnMobile}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] px-4 py-2 text-sm font-medium lg:hidden"
        >
          <SlidersHorizontal className="size-4" />
          Filters
          {activeCount > 0 && (
            <span className="tnum grid size-5 place-items-center rounded-full bg-sun-500 text-2xs text-forest-950">
              {activeCount}
            </span>
          )}
        </button>

        <div
          className={cn(
            "w-full flex-wrap items-center gap-2 lg:flex lg:w-auto",
            openOnMobile ? "flex pb-2 pt-1" : "hidden",
          )}
        >
          {groups.map((group) => (
            <FilterMenu
              key={group.key}
              group={group}
              value={current(group.key)}
              onSelect={(v) => apply(group.key, v)}
            />
          ))}

          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm text-[var(--ink-muted)] underline-offset-4 hover:text-clay-700 hover:underline"
            >
              <X className="size-3.5" />
              Clear
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-4">
          <p
            aria-live="polite"
            className="tnum hidden text-sm text-[var(--ink-muted)] sm:block"
          >
            {resultCount} {resultCount === 1 ? "result" : "results"}
          </p>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-[var(--ink-faint)]">Sort</span>
            <select
              value={current("sort")}
              onChange={(e) => apply("sort", e.target.value)}
              className="cursor-pointer rounded-full border border-[var(--line-strong)] bg-transparent py-1.5 pl-3 pr-7 text-sm font-medium outline-none focus-visible:border-lake-600"
            >
              {sorts.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

/** A single filter group rendered as a native-feeling popover. */
function FilterMenu({
  group,
  value,
  onSelect,
}: {
  group: FilterGroup;
  value: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = group.options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
          selected
            ? "border-forest-800 bg-forest-800 text-bone-50"
            : "border-[var(--line-strong)] text-[var(--ink)] hover:border-forest-800",
        )}
      >
        {selected ? selected.label : group.label}
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-40 min-w-[13rem] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] py-1.5 shadow-[var(--shadow-float)]"
        >
          {group.options.map((option) => {
            const isActive = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onSelect(option.value);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]"
              >
                {option.label}
                {isActive && <Check className="size-4 text-lake-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
