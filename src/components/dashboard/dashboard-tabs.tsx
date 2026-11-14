"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/components/dashboard/nav-types";
import { cn } from "@/lib/utils";

// Client-side on purpose: a layout is not re-rendered when you move between its
// pages, so an active tab worked out on the server stays stuck on the first page.
export function DashboardTabs({ nav, label }: { nav: NavItem[]; label: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label={label}>
      <ul className="-mb-px flex gap-1 overflow-x-auto no-bar">
        {nav.map((item, i) => {
          // The first tab is the section root, so it only matches exactly; the others own their sub-pages.
          const active = pathname === item.href || (i > 0 && pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-block whitespace-nowrap border-b-2 px-4 py-3 text-sm transition-colors",
                  active
                    ? "border-sun-500 font-medium text-[var(--ink)]"
                    : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]",
                )}
              >
                {item.label}
                {item.badge ? (
                  <span className="tnum ml-2 inline-grid size-4.5 place-items-center rounded-full bg-sun-500 align-middle text-[0.625rem] font-semibold text-forest-950">
                    {item.badge > 9 ? "9+" : item.badge}
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
