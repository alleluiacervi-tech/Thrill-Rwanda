import Link from "next/link";
import { cn } from "@/lib/utils";

// Links, not buttons — a filtered view is a real URL, so it needs no JS and
// the sidebar can point straight at it.

export type Chip = {
  value: string;
  label: string;
  count?: number;
};

export function FilterChips({
  basePath,
  param,
  current,
  chips,
  label,
  className,
  params,
}: {
  basePath: string;
  param: string;
  current: string;
  chips: Chip[];
  label: string;
  className?: string;
  /** The page's own query, so picking a chip keeps the search term and other filters. */
  params?: Record<string, string | string[] | undefined>;
}) {
  // Page resets with the filter: page 4 of the old view is usually empty under the new one.
  const href = (value: string) => {
    const query = new URLSearchParams();
    for (const [key, raw] of Object.entries(params ?? {})) {
      if (key === param || key === "page" || raw === undefined) continue;
      const v = Array.isArray(raw) ? raw[0] : raw;
      if (v) query.set(key, v);
    }
    if (value) query.set(param, value);
    const search = query.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  return (
    <nav aria-label={label} className={cn("mb-6", className)}>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const active = current === chip.value;
          return (
            <li key={chip.value || "all"}>
              <Link
                href={href(chip.value)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-2xs font-medium transition-colors",
                  active
                    ? "border-forest-800 bg-forest-800 text-bone-50"
                    : "border-[var(--line-strong)] text-[var(--ink-muted)] hover:border-forest-800",
                )}
              >
                {chip.label}
                {chip.count !== undefined ? (
                  <span
                    className={cn(
                      "tnum text-2xs",
                      active ? "text-bone-50/70" : "text-[var(--ink-faint)]",
                    )}
                  >
                    {chip.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
