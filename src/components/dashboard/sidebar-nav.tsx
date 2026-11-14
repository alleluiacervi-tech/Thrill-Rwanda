"use client";

import { useSite } from "@/components/layout/site-context";
import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CarFront,
  Hotel,
  LayoutGrid,
  Menu,
  Mountain,
  Package,
  Plane,
  FileText,
  Mail,
  Settings,
  Star,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { ProfileMenu } from "@/components/dashboard/profile-menu";
import { WorkspaceSwitch, type Workspace } from "@/components/dashboard/workspace-switch";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { activeNavHref, type NavGroup } from "@/components/dashboard/nav-types";

// Icons arrive as names, not components — a server layout can't serialise a
// component across the boundary.
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  overview: LayoutGrid,
  bookings: CalendarDays,
  listings: Package,
  tours: Mountain,
  hotels: Hotel,
  vehicles: CarFront,
  providers: Users,
  payments: Wallet,
  reviews: Star,
  users: UserRound,
  transfers: Plane,
  emails: Mail,
  legal: FileText,
  settings: Settings,
};

// A dark rail for navigation, a light header for the account. The drawer
// state lives here because the phone menu button sits in the header.
export function SidebarLayout({
  groups,
  user,
  notifications,
  workspaces,
  children,
}: {
  groups: NavGroup[];
  user: { name: string; role: string };
  notifications?: { href: string; unread: number };
  workspaces?: Workspace[];
  children: React.ReactNode;
}) {
  const site = useSite();
  const [open, setOpen] = React.useState(false);

  // Read from the live URL, not passed down: the layout is not re-rendered on navigation,
  // so a server-decided active item would stay on the first page visited.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const activeHref = activeNavHref(groups, pathname, query ? `?${query}` : "");

  // Escape closes the drawer. Links close it themselves on click, so a tap
  // never navigates behind a panel still covering the page.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const rail = (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex-1 overflow-y-auto px-3 py-6" aria-label="Admin sections">
        {groups.map((group) => (
          <div key={group.label} className="mb-7 last:mb-0">
            <p className="px-3 pb-2.5 text-2xs font-semibold uppercase tracking-[0.2em] text-bone-50/35">
              {group.label}
            </p>
            <ul className="grid gap-0.5">
              {group.items.map((item) => {
                const active = item.href === activeHref;
                const Glyph = item.icon ? ICONS[item.icon] : undefined;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-bone-50/10 text-bone-50"
                          : "text-forest-100/60 hover:bg-bone-50/5 hover:text-bone-50",
                      )}
                    >
                      {Glyph ? (
                        <Glyph
                          className={cn(
                            "size-4 shrink-0",
                            active ? "text-sun-500" : "text-bone-50/40",
                          )}
                        />
                      ) : (
                        <span className="size-4 shrink-0" />
                      )}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="tnum rounded-full bg-sun-500 px-2 py-0.5 text-[0.625rem] font-semibold text-forest-950">
                          {item.badge > 9 ? "9+" : item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );

  const unread = notifications?.unread ?? 0;

  return (
    <div className="dash-surface flex min-h-svh bg-[var(--paper)] lg:items-start">
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-forest-950/60"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-forest-950">
            <div className="flex items-center justify-between border-b border-bone-50/10 px-4 py-3">
              <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-sun-500">
                Admin
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid size-8 place-items-center text-bone-50/70 transition-colors hover:text-bone-50"
              >
                <X className="size-4" />
              </button>
            </div>
            {rail}
          </div>
        </div>
      ) : null}

      <aside className="hidden w-68 shrink-0 bg-forest-950 lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3 border-b border-bone-50/10 px-5 py-4"
        >
          <Logo compact tone="dark" className="h-9 lg:h-9" />
          <span className="min-w-0">
            <span className="block truncate font-display text-[0.9375rem] leading-tight text-bone-50">
              {site.name}
            </span>
            <span className="block text-2xs uppercase tracking-[0.18em] text-sun-500">
              Admin
            </span>
          </span>
        </Link>
        {rail}
      </aside>

      {/* dash-compact on the whole column, so the header shares --dash-pad with the page below. */}
      <div className="dash-compact type-ui flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--paper-raised)] px-[var(--dash-pad)]">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-label="Open menu"
            className="-ml-2 grid size-9 place-items-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--paper-sunken)] hover:text-[var(--ink)] lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-lake-700 lg:hidden">
            Admin
          </span>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {workspaces ? <WorkspaceSwitch workspaces={workspaces} className="mr-1 hidden sm:flex" /> : null}
            {notifications ? <NotificationBell href={notifications.href} unread={unread} /> : null}

            <span aria-hidden className="mx-1 hidden h-6 w-px bg-[var(--line)] sm:block" />

            <ProfileMenu name={user.name} role={user.role} profileHref="/admin/profile" />
          </div>
        </header>

        <main id="main" className="min-w-0 flex-1">
          <div className="dash-body">{children}</div>
        </main>
      </div>
    </div>
  );
}
