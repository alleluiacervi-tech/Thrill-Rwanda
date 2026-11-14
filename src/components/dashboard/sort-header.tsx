import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Th } from "@/components/dashboard/data-table";
import type { Params } from "@/lib/table-query";
import { cn } from "@/lib/utils";

/**
 * A column heading that sorts. Links, not buttons: the sorted view is a real
 * URL, so it survives a refresh and can be shared.
 */
export function SortTh({
  children,
  value,
  pathname,
  params,
  active,
  dir,
  className,
}: {
  children: React.ReactNode;
  /** Matches a SortOption value the page allows. */
  value: string;
  pathname: string;
  params: Params;
  /** The column currently sorted, from sortOrder(). */
  active: string;
  dir: string;
  className?: string;
}) {
  const on = active === value;
  // Clicking the sorted column flips it; a new column starts newest or largest first.
  const nextDir = on && dir === "desc" ? "asc" : "desc";

  const query = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (key === "sort" || key === "dir" || key === "page" || raw === undefined) continue;
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (v) query.set(key, v);
  }
  query.set("sort", value);
  if (nextDir === "asc") query.set("dir", "asc");

  const Icon = on ? (dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;

  return (
    <Th
      className={className}
      ariaSort={on ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <Link
        href={`${pathname}?${query.toString()}`}
        className={cn(
          "inline-flex items-center gap-1.5 transition-colors hover:text-[var(--ink)]",
          on && "text-[var(--ink)]",
        )}
      >
        {children}
        <Icon className={cn("size-3", on ? "text-clay-600" : "text-[var(--ink-faint)] opacity-60")} />
      </Link>
    </Th>
  );
}
