"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import {
  latestNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationPreview,
} from "@/app/actions/account";
import { cn } from "@/lib/utils";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "5 minutes ago", falling back to a date after a week. */
export function timeAgo(iso: string) {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 604800) return rtf.format(Math.round(seconds / 86400), "day");
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(iso));
}

// Plain clicks mark read first, then navigate; modified clicks (new tab) mark read and let the browser handle it.
export function useOpenNotification(onRead?: (id: string) => void) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();

  return (e: React.MouseEvent, n: { id: string; href: string | null; read: boolean }) => {
    if (!n.read) onRead?.(n.id);
    const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1;
    if (!n.href || modified) {
      if (!n.read) void markNotificationRead(n.id);
      return;
    }
    e.preventDefault();
    startTransition(async () => {
      if (!n.read) await markNotificationRead(n.id);
      router.push(n.href!);
    });
  };
}

export function NotificationBell({ href, unread }: { href: string; unread: number }) {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<{ items: NotificationPreview[]; unread: number } | null>(null);
  const [failed, setFailed] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();
  const panelId = React.useId();

  const count = data?.unread ?? unread;

  const markLocal = (id: string) =>
    setData((d) =>
      d
        ? { unread: Math.max(0, d.unread - 1), items: d.items.map((n) => (n.id === id ? { ...n, read: true } : n)) }
        : d,
    );
  const openItem = useOpenNotification((id) => {
    markLocal(id);
    setOpen(false);
  });

  // Fetched on every open, so the list reflects anything that arrived since the page loaded.
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setFailed(false);
    latestNotifications()
      .then(setData)
      .catch(() => setFailed(true));
  };

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markAll = async () => {
    setData((d) => (d ? { unread: 0, items: d.items.map((n) => ({ ...n, read: true })) } : d));
    await markAllNotificationsRead();
    router.refresh();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
        className={cn(
          "relative grid size-9 place-items-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--paper-sunken)] hover:text-[var(--ink)]",
          open && "bg-[var(--paper-sunken)] text-[var(--ink)]",
        )}
      >
        <Bell className="size-4.5" />
        {count > 0 ? (
          <span
            aria-hidden
            className="tnum absolute -right-0.5 -top-0.5 grid min-w-4.5 place-items-center rounded-full bg-sun-500 px-1 text-[0.625rem] font-semibold text-forest-950"
          >
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] shadow-xl shadow-black/10 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--ink)]">
              Notifications
              {count > 0 ? <span className="ml-1.5 font-normal text-[var(--ink-muted)]">· {count} unread</span> : null}
            </p>
            {count > 0 ? (
              <button
                type="button"
                onClick={markAll}
                className="inline-flex items-center gap-1 text-2xs font-semibold text-forest-700 hover:text-forest-900"
              >
                <CheckCheck className="size-3.5" />
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-[min(26rem,60vh)] overflow-y-auto">
            {failed ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--ink-muted)]">Couldn&rsquo;t load notifications. Try again.</p>
            ) : !data ? (
              <ul aria-busy className="divide-y divide-[var(--line)]">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex gap-3 px-4 py-3.5">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--paper-sunken)]" />
                    <span className="flex-1 space-y-2">
                      <span className="block h-3 w-2/3 animate-pulse rounded bg-[var(--paper-sunken)]" />
                      <span className="block h-3 w-full animate-pulse rounded bg-[var(--paper-sunken)]" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : data.items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto size-6 text-[var(--ink-faint)]" />
                <p className="mt-3 text-sm text-[var(--ink-muted)]">You&rsquo;re all caught up.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {data.items.map((n) => (
                  <li key={n.id}>
                    <a
                      href={n.href ?? href}
                      onClick={(e) => openItem(e, { ...n, href: n.href ?? href })}
                      className={cn(
                        "flex gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--paper-sunken)]",
                        !n.read && "bg-sun-100/40",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-sun-500")}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm leading-snug text-[var(--ink)]", !n.read && "font-semibold")}>
                          {n.title}
                          {!n.read ? <span className="sr-only"> (unread)</span> : null}
                        </span>
                        {n.body ? (
                          <span className="mt-0.5 line-clamp-2 block text-2xs leading-relaxed text-[var(--ink-muted)]">
                            {n.body}
                          </span>
                        ) : null}
                        <span className="tnum mt-1 block text-2xs text-[var(--ink-faint)]">{timeAgo(n.createdAt)}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            href={href}
            onClick={() => setOpen(false)}
            className="block border-t border-[var(--line)] bg-[var(--paper-sunken)] px-4 py-3 text-center text-sm font-semibold text-forest-800 transition-colors hover:text-forest-950"
          >
            View all notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}
