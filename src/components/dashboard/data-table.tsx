import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal table primitives for the dashboards. Wrapped in an overflow-x
 * container so wide tables scroll inside their card rather than pushing the
 * page sideways on a phone.
 */


export function TableShell({
  children,
  className,
  dense = false,
}: {
  children: React.ReactNode;
  className?: string;
  /**
   * Drops the 46rem minimum. Use for narrow two-or-three column tables in a
   * half-width column — without it the min-width pushes the last columns
   * into the horizontal scroll where nobody sees them.
   */
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        // `relative`: anything absolutely positioned in a cell (screen-reader-only
        // labels included) stays inside this scroller instead of widening the page.
        "relative overflow-x-auto rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)]",
        className,
      )}
    >
      <table
        className={cn(
          "w-full border-collapse text-sm",
          dense ? "min-w-0" : "min-w-[46rem]",
        )}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
  ariaSort,
}: {
  children?: React.ReactNode;
  className?: string;
  /** Set by SortTh; belongs on the cell, not on the link inside it. */
  ariaSort?: "ascending" | "descending" | "none";
}) {
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={cn(
        "whitespace-nowrap border-b border-[var(--line)] px-5 py-3 text-left text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border-b border-[var(--line)] px-5 py-4 align-middle",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <tr className={cn("transition-colors last:[&>td]:border-0 hover:bg-[var(--paper-sunken)]", className)}>
      {children}
    </tr>
  );
}
