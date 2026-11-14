/**
 * Shared query helpers for the dashboard tables: text search, date ranges and
 * column sorting, all driven by the URL so a filtered view is linkable.
 */

export type Params = Record<string, string | string[] | undefined>;

export function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** The search term, trimmed. Two characters is the shortest worth querying. */
export function searchTerm(params: Params) {
  const q = one(params.q);
  return q.length >= 2 ? q : "";
}

/** Prisma `contains` filters, OR'd together. Empty when there is nothing to search for. */
export function searchFilter<T extends object>(term: string, build: (q: string) => T[]) {
  return term ? { OR: build(term) } : {};
}

export const DATE_RANGES = [
  { value: "", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
] as const;

const DAYS: Record<string, number> = { "7d": 7, "30d": 30 };

/** `{ gte: Date }` for the chosen range, or nothing. Counts and rows must share it. */
export function dateRange(params: Params): { gte: Date } | undefined {
  const range = one(params.range);
  const now = new Date();

  if (DAYS[range]) {
    const from = new Date(now);
    from.setDate(from.getDate() - DAYS[range]);
    return { gte: from };
  }
  if (range === "month") return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  if (range === "year") return { gte: new Date(now.getFullYear(), 0, 1) };
  return undefined;
}

export type SortOption = {
  /** Appears in the URL as ?sort=… */
  value: string;
  /** What Prisma orders by for this column. */
  orderBy: Record<string, unknown> | Record<string, unknown>[];
};

/**
 * Resolves ?sort= and ?dir= against the columns a page allows, so an unknown
 * value falls back to that page's own order instead of erroring.
 */
export function sortOrder(
  params: Params,
  options: SortOption[],
  fallback: Record<string, unknown> | Record<string, unknown>[],
) {
  const value = one(params.sort);
  const dir = one(params.dir) === "asc" ? "asc" : "desc";
  const found = options.find((o) => o.value === value);
  if (!found) return { orderBy: fallback, sort: "", dir };

  const apply = (clause: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(clause).map(([key, val]) => [
        key,
        // A nested clause like { customer: { fullName: true } } carries the direction inside.
        val && typeof val === "object" ? apply(val as Record<string, unknown>) : dir,
      ]),
    );

  const orderBy = Array.isArray(found.orderBy)
    ? found.orderBy.map(apply)
    : apply(found.orderBy);

  return { orderBy, sort: value, dir };
}
