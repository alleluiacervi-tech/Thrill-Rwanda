import * as React from "react";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- Container */

export function Container({
  className,
  wide = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { wide?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-8",
        wide ? "max-w-[110rem]" : "max-w-[82rem]",
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ Eyebrow */

/** Small tracked label with a lead rule. Used above every section heading. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    // A plain label, not rule + spaced capitals: that pairing above every heading is the template tell.
    <span className={cn("inline-flex items-center text-sm font-semibold tracking-[-0.005em] text-[var(--label)]", className)}>
      {children}
    </span>
  );
}

/* -------------------------------------------------------------- SectionHead */

export function SectionHead({
  eyebrow,
  title,
  lede,
  action,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  action?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-10",
        align === "center" && "md:flex-col md:items-center md:text-center",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h2 className={cn("text-display-sm", eyebrow && "mt-3")}>{title}</h2>
        {lede ? (
          <p className={cn("mt-5 max-w-xl text-base leading-relaxed text-[var(--ink-muted)] sm:text-[1.0625rem]", align === "center" && "mx-auto")}>
            {lede}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------- Badge */

const badgeTones = {
  neutral:
    "bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] text-[var(--ink-muted)]",
  forest: "bg-forest-800 text-forest-100",
  ember: "bg-ember-500 text-[#2a1605]",
  clay: "bg-clay-100 text-clay-800",
  outline: "border border-[var(--line-strong)] text-[var(--ink-muted)]",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof badgeTones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-2xs font-semibold uppercase tracking-[0.08em]",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------------- Card */

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)]",
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------- Rating */

export function Rating({
  value,
  count,
  className,
}: {
  value: number;
  count?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <svg
        viewBox="0 0 20 20"
        aria-hidden
        className="size-4 fill-ember-500"
      >
        <path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9 4.8 17.6l1-5.8L1.6 7.7l5.8-.8z" />
      </svg>
      <span className="tnum font-semibold text-[var(--ink)]">
        {value.toFixed(1)}
      </span>
      {count !== undefined ? (
        <span className="tnum text-[var(--ink-faint)]">({count})</span>
      ) : null}
      <span className="sr-only">out of 5</span>
    </span>
  );
}

/* ---------------------------------------------------------------- Rule/fade */

export function RuleFade({ className }: { className?: string }) {
  return <div aria-hidden className={cn("rule-fade", className)} />;
}
