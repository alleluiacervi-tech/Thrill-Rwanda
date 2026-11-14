import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageHref, type Page } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/** Page numbers around the current one, with gaps as "…". */
function numbers(current: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "gap")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(pages - 1, current + 1);
  if (start > 2) out.push("gap");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < pages - 1) out.push("gap");
  out.push(pages);
  return out;
}

export function Pagination({
  page,
  pathname,
  params,
  /** What is being counted, e.g. "bookings". */
  label,
  param = "page",
}: {
  page: Page;
  pathname: string;
  params: Record<string, string | string[] | undefined>;
  label: string;
  /** Query key for this list, so one page can hold several independent ones. */
  param?: string;
}) {
  // One page of results still deserves the count; the controls would do nothing.
  const href = (n: number) => pageHref(pathname, params, n, param);
  const linkCls =
    "grid h-9 min-w-9 place-items-center rounded-[var(--radius-inset)] border px-2 text-sm transition-colors";

  return (
    <nav
      aria-label={`${label} pages`}
      className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row"
    >
      <p className="tnum text-2xs text-[var(--ink-muted)]">
        {page.total === 0
          ? `No ${label}`
          : `Showing ${page.from}–${page.to} of ${page.total} ${label}`}
      </p>

      {page.pages > 1 ? (
        <ul className="flex flex-wrap items-center gap-1.5">
          <li>
            {page.current > 1 ? (
              <Link
                href={href(page.current - 1)}
                rel="prev"
                aria-label="Previous page"
                className={cn(linkCls, "border-[var(--line-strong)] hover:border-forest-800")}
              >
                <ChevronLeft className="size-4" />
              </Link>
            ) : (
              <span aria-hidden className={cn(linkCls, "border-[var(--line)] text-[var(--ink-faint)] opacity-50")}>
                <ChevronLeft className="size-4" />
              </span>
            )}
          </li>

          {numbers(page.current, page.pages).map((n, i) =>
            n === "gap" ? (
              <li key={`gap-${i}`} aria-hidden className="px-1 text-sm text-[var(--ink-faint)]">
                …
              </li>
            ) : (
              <li key={n}>
                <Link
                  href={href(n)}
                  aria-label={`Page ${n}`}
                  aria-current={n === page.current ? "page" : undefined}
                  className={cn(
                    linkCls,
                    "tnum",
                    n === page.current
                      ? "border-forest-800 bg-forest-800 font-semibold text-bone-50"
                      : "border-[var(--line-strong)] hover:border-forest-800",
                  )}
                >
                  {n}
                </Link>
              </li>
            ),
          )}

          <li>
            {page.current < page.pages ? (
              <Link
                href={href(page.current + 1)}
                rel="next"
                aria-label="Next page"
                className={cn(linkCls, "border-[var(--line-strong)] hover:border-forest-800")}
              >
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span aria-hidden className={cn(linkCls, "border-[var(--line)] text-[var(--ink-faint)] opacity-50")}>
                <ChevronRight className="size-4" />
              </span>
            )}
          </li>
        </ul>
      ) : null}
    </nav>
  );
}
