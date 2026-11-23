import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Executive-dashboard building blocks: figures first, prose second.
 * Server components, no state.
 */

/** One headline number with a quiet label underneath. */
export function StatTile({
  label,
  value,
  note,
  tone = "default",
  href,
}: {
  label: string;
  value: React.ReactNode;
  /** A few words at most: "of 24", "needs action". */
  note?: string;
  tone?: "default" | "alert" | "good";
  href?: string;
}) {
  const body = (
    <>
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
        {label}
      </p>
      <p
        className={cn(
          "tnum mt-2 font-display text-[1.875rem] leading-none",
          tone === "alert" && "text-clay-700",
          tone === "good" && "text-forest-800",
        )}
      >
        {value}
      </p>
      {note ? <p className="mt-2 text-xs text-[var(--ink-muted)]">{note}</p> : null}
    </>
  );
  const cls =
    "block rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-5";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-[var(--line-strong)]")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function StatGrid({
  children,
  cols = 4,
}: {
  children: React.ReactNode;
  cols?: 3 | 4;
}) {
  return (
    <div
      className={cn(
        "mb-6 grid gap-3 sm:grid-cols-2",
        cols === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}

/** A titled surface. `aside` sits on the right of the title row. */
export function Panel({
  title,
  description,
  aside,
  children,
  className,
  flush = false,
}: {
  title?: string;
  description?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Drop the inner padding, for tables and lists that run edge to edge. */
  flush?: boolean;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)]",
        className,
      )}
    >
      {title ? (
        <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-semibold">{title}</h2>
            {description ? (
              <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">{description}</p>
            ) : null}
          </div>
          {aside ? <div className="shrink-0">{aside}</div> : null}
        </header>
      ) : null}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

const PILL = {
  neutral: "bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] text-[var(--ink-muted)]",
  good: "bg-forest-100 text-forest-800",
  warn: "bg-sun-300/40 text-sun-900",
  alert: "bg-clay-100 text-clay-800",
  info: "bg-lake-100 text-lake-800",
} as const;

/** A status as a dot and a word, which scans faster down a column than a filled badge. */
export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof PILL;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        PILL[tone],
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

/** Initials in a circle, for a person or company. */
export function Monogram({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-forest-800 text-xs font-semibold text-forest-100",
        className,
      )}
    >
      {initials || "·"}
    </span>
  );
}

/** Horizontal rule of label / figure pairs, for breakdowns. */
export function BarList({
  rows,
  empty = "Nothing recorded yet.",
}: {
  rows: { label: string; value: number }[];
  empty?: string;
}) {
  if (!rows.length) return <p className="text-sm text-[var(--ink-muted)]">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="tnum font-medium">{r.value}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--paper-sunken)]">
            <div
              className="h-full rounded-full bg-forest-700"
              style={{ width: `${Math.max(4, (r.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Filters and search sharing one bar, instead of a stack of dropdowns. */
export function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-3">
      {children}
    </div>
  );
}
