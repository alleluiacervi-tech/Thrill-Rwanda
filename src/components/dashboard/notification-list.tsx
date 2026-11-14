"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import type { NotificationPreview } from "@/app/actions/account";
import { timeAgo, useOpenNotification } from "@/components/dashboard/notification-bell";
import { cn } from "@/lib/utils";

// Clicking a row marks it read straight away, then follows its link if it has one.
export function NotificationList({ items }: { items: NotificationPreview[] }) {
  const [readIds, setReadIds] = React.useState<Set<string>>(() => new Set());
  const open = useOpenNotification((id) => setReadIds((s) => new Set(s).add(id)));

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const n = { ...item, read: item.read || readIds.has(item.id) };
        return (
          <li key={n.id}>
            <a
              href={n.href ?? undefined}
              role={n.href ? undefined : "button"}
              tabIndex={0}
              onClick={(e) => open(e, n)}
              onKeyDown={(e) => {
                if (!n.href && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  open(e as unknown as React.MouseEvent, n);
                }
              }}
              className={cn(
                "flex cursor-pointer gap-4 rounded-[var(--radius-card)] border p-5 transition-colors",
                n.read
                  ? "border-[var(--line)] bg-[var(--paper-raised)] hover:border-[var(--line-strong)]"
                  : "border-sun-200 bg-sun-100/40 hover:border-sun-300",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-9 shrink-0 place-items-center rounded-full",
                  n.read ? "bg-[var(--paper-sunken)] text-[var(--ink-faint)]" : "bg-sun-500 text-forest-950",
                )}
              >
                <Bell className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-3">
                  <span className={cn("block text-[var(--ink)]", n.read ? "font-medium" : "font-semibold")}>
                    {n.title}
                    {!n.read ? <span className="sr-only"> (unread)</span> : null}
                  </span>
                  {!n.read ? <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-sun-500" /> : null}
                </span>
                {n.body ? (
                  <span className="mt-1 block whitespace-pre-line text-sm leading-relaxed text-[var(--ink-muted)]">{n.body}</span>
                ) : null}
                <span
                  className="tnum mt-2 block text-2xs text-[var(--ink-faint)]"
                  // Relative time can tick over between the server render and hydration.
                  suppressHydrationWarning
                  title={new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(n.createdAt))}
                >
                  {timeAgo(n.createdAt)}
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
