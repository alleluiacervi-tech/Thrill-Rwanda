"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A filter that would be a row of chips, as one dropdown.
 *
 * Chips are quicker to hit but cost a full row each; above a table the
 * vertical space matters more than the click.
 */
export function SelectFilter({
  pathname,
  param,
  options,
  label,
  className,
}: {
  pathname: string;
  param: string;
  options: readonly { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get(param) ?? "";

  return (
    <div className={cn("relative", className)}>
      <select
        aria-label={label}
        value={current}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value) next.set(param, e.target.value);
          else next.delete(param);
          // A new filter means a new result set, so start at its first page.
          next.delete("page");
          const query = next.toString();
          router.push(query ? `${pathname}?${query}` : pathname);
        }}
        className={cn(
          "h-10 w-full appearance-none rounded-[var(--radius-inset)] border bg-[var(--paper-raised)] pl-3.5 pr-9 text-sm outline-none transition-colors focus-visible:border-lake-600",
          // A set filter reads as active, like a selected chip did.
          current ? "border-forest-800 font-medium text-forest-900" : "border-[var(--line-strong)]",
        )}
      >
        {options.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-faint)]"
      />
    </div>
  );
}
