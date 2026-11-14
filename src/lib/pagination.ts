/**
 * Page-number paging for dashboard tables and public lists.
 *
 * The page lives in the URL (`?page=3`), so a row is linkable, the back button
 * works, and a refresh keeps your place.
 */

export const PAGE_SIZE = 25;

export type Page = {
  /** 1-based, clamped to the pages that exist. */
  current: number;
  size: number;
  total: number;
  pages: number;
  /** For Prisma. */
  skip: number;
  take: number;
  /** 1-based row numbers, for "Showing 1–25 of 340". Zero when empty. */
  from: number;
  to: number;
};

type Params = Record<string, string | string[] | undefined>;

function readPage(params: Params, key: string) {
  const raw = Array.isArray(params[key]) ? params[key][0] : params[key];
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Resolve the page once the total is known, so ?page=99 lands on the last page rather than an empty table. */
export function paginate(params: Params, total: number, size = PAGE_SIZE, key = "page"): Page {
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(readPage(params, key), pages);
  const skip = (current - 1) * size;
  return {
    current,
    size,
    total,
    pages,
    skip,
    take: size,
    from: total === 0 ? 0 : skip + 1,
    to: Math.min(skip + size, total),
  };
}

/** Same paging for a list already in memory (the cached public catalogue). */
export function paginateList<T>(params: Params, items: T[], size = PAGE_SIZE, key = "page") {
  const page = paginate(params, items.length, size, key);
  return { page, items: items.slice(page.skip, page.skip + page.take) };
}

/** Keeps filters in the URL while changing the page. `key` lets one page hold several independent lists. */
export function pageHref(pathname: string, params: Params, page: number, key = "page") {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (name === key || value === undefined) continue;
    query.set(name, Array.isArray(value) ? (value[0] ?? "") : value);
  }
  if (page > 1) query.set(key, String(page));
  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}
