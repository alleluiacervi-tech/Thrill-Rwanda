// Own module so the client sidebar imports these without the server shell.

export type NavItem = {
  label: string;
  /** May carry a query string — `/admin/providers?status=PENDING`. */
  href: string;
  badge?: number;
  /** Key into the sidebar's icon map; components can't cross the boundary. */
  icon?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

// Longest match on `path + query` wins, so `?status=PENDING` beats the plain
// route it starts with. Pathname alone would light up several rows.
export function activeNavHref(
  groups: NavGroup[],
  pathname: string,
  search: string,
): string | null {
  const current = `${pathname}${search}`;
  let best: string | null = null;

  for (const group of groups) {
    for (const item of group.items) {
      const matches =
        item.href === current ||
        // A child route (`/admin/listings/x`) belongs to its section, but only
        // for entries without a query — a filter never owns a sub-page.
        (!item.href.includes("?") && pathname.startsWith(`${item.href}/`));

      if (matches && (best === null || item.href.length > best.length)) {
        best = item.href;
      }
    }
  }

  return best;
}
