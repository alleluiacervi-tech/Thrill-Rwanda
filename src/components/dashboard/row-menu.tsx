"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { AlertTriangle, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type State = { status: "idle" | "error" | "ok"; message?: string };
const initial: State = { status: "idle" };

export type RowMenuItem =
  | {
      label: string;
      action: (prev: State, formData: FormData) => Promise<State>;
      fields: Record<string, string>;
      /** Replaces the label on a second click before the action runs. */
      confirm?: string;
      danger?: boolean;
    }
  | { label: string; href: string };

/**
 * A ⋯ menu for a table row.
 *
 * Four or five buttons per row push a table into horizontal scroll and make
 * every row shout; a menu keeps the row one control wide and the table
 * readable. The menu is fixed to the window because the table scrolls.
 */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const [result, setResult] = React.useState<State | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // A fixed menu would drift from its button, so any scroll just closes it.
    const dismiss = () => setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  if (items.length === 0) return <span className="text-[var(--ink-faint)]">—</span>;

  return (
    <div ref={rootRef} className="relative inline-flex flex-col items-end gap-1">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          const r = triggerRef.current?.getBoundingClientRect();
          if (r) {
            const width = 208;
            const height = 10 + items.length * 38;
            const room = window.innerHeight - r.bottom;
            setPos({
              top: room > height + 8 ? r.bottom + 4 : Math.max(8, r.top - height - 4),
              left: Math.max(8, r.right - width),
            });
          }
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label={label}
        className={cn(
          "grid size-8 place-items-center rounded-[var(--radius-inset)] border border-[var(--line-strong)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--paper-sunken)] hover:text-[var(--ink)]",
          open && "bg-[var(--paper-sunken)] text-[var(--ink)]",
        )}
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open && pos ? (
        <div
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 w-52 overflow-hidden rounded-[var(--radius-inset)] border border-[var(--line)] bg-[var(--paper-raised)] py-1 shadow-lg shadow-black/10"
        >
          {items.map((item) =>
            "href" in item ? (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                // text-left: the cell holding the menu is right-aligned, and a link would inherit it.
                className="block px-3 py-2 text-left text-sm text-[var(--ink)] transition-colors hover:bg-[var(--paper-sunken)]"
              >
                {item.label}
              </Link>
            ) : (
              <MenuAction
                key={item.label}
                item={item}
                onDone={(state) => {
                  setResult(state);
                  setOpen(false);
                }}
              />
            ),
          )}
        </div>
      ) : null}

      {result?.status === "error" && result.message ? (
        <span role="alert" className="flex max-w-[14rem] items-start gap-1 text-right text-2xs font-medium text-red-700">
          <AlertTriangle className="mt-px size-3 shrink-0" />
          {result.message}
        </span>
      ) : null}
      {result?.status === "ok" && result.message ? (
        <span role="status" className="max-w-[14rem] text-right text-2xs text-forest-700">
          {result.message}
        </span>
      ) : null}
    </div>
  );
}

function MenuAction({
  item,
  onDone,
}: {
  item: Extract<RowMenuItem, { action: unknown }>;
  onDone: (state: State) => void;
}) {
  const [state, formAction, pending] = useActionState(item.action, initial);
  // Two-step, like the row buttons were: the first click arms, the second runs.
  const [armed, setArmed] = React.useState(false);

  const [seen, setSeen] = React.useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.status !== "idle") onDone(state);
  }

  return (
    <form action={formAction}>
      {Object.entries(item.fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type={item.confirm && !armed ? "button" : "submit"}
        onClick={() => item.confirm && !armed && setArmed(true)}
        disabled={pending}
        className={cn(
          "block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--paper-sunken)] disabled:opacity-60",
          item.danger ? "text-red-700" : "text-[var(--ink)]",
          armed && "font-semibold",
        )}
      >
        {pending ? "Working…" : armed && item.confirm ? item.confirm : item.label}
      </button>
    </form>
  );
}
