"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertTriangle, MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

type State = { status: "idle" | "error" | "ok"; message?: string };
const initial: State = { status: "idle" };

type Status = "CONFIRMED" | "COMPLETED" | "REJECTED" | "CANCELLED" | "PENDING" | "AWAITING_PAYMENT" | "PAID";

// Verbs, not the resulting status: the button says what happens when you press it.
const LABEL: Partial<Record<Status, string>> = {
  CONFIRMED: "Confirm",
  COMPLETED: "Mark completed",
  REJECTED: "Decline",
  CANCELLED: "Cancel booking",
};

// Only these end a booking and release its dates, so only these ask first.
const CONFIRM: Partial<Record<Status, { title: string; body: string; button: string }>> = {
  REJECTED: {
    title: "Decline this booking?",
    body: "The customer is told the dates can't be taken, and the dates open up for others. This can't be undone.",
    button: "Decline booking",
  },
  CANCELLED: {
    title: "Cancel this booking?",
    body: "The booking is cancelled and its dates released. Any refund is handled separately under the cancellation policy. This can't be undone.",
    button: "Cancel booking",
  },
};

const isDestructive = (to: string) => to === "REJECTED" || to === "CANCELLED";

// One button for the likely next step and a ⋯ menu for the rest, so a row stays one line tall.
export function BookingActions({
  action,
  reference,
  next,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  reference: string;
  /** Statuses this user may move the booking to, from allowedTransitions. */
  next: string[];
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [menuOpen, setMenuOpen] = React.useState(false);
  // Fixed to the window, not the cell: the table scrolls sideways, which would clip an absolute menu on the last rows.
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number } | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [asking, setAsking] = React.useState<Status | null>(null);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  const primary = next.find((to) => !isDestructive(to)) as Status | undefined;
  const others = next.filter((to) => to !== primary) as Status[];

  React.useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    // A fixed menu would drift away from its button, so any scroll or resize just closes it.
    const dismiss = () => setMenuOpen(false);
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
  }, [menuOpen]);

  // Open the confirmation once the choice is set; close it when the change lands.
  React.useEffect(() => {
    if (asking) dialogRef.current?.showModal();
  }, [asking]);
  React.useEffect(() => {
    if (state.status === "ok") dialogRef.current?.close();
  }, [state]);

  const choose = (to: Status) => {
    setMenuOpen(false);
    // Only changes with a confirmation text ask first; anything else in the menu applies straight away.
    if (CONFIRM[to]) {
      setAsking(to);
      return;
    }
    const data = new FormData();
    data.set("reference", reference);
    data.set("to", to);
    React.startTransition(() => formAction(data));
  };

  const ask = asking ? CONFIRM[asking] : undefined;

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1.5">
        {primary ? (
          <form action={formAction}>
            <input type="hidden" name="reference" value={reference} />
            <input type="hidden" name="to" value={primary} />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-8 items-center whitespace-nowrap rounded-[var(--radius-inset)] bg-forest-800 px-3 text-2xs font-semibold text-bone-50 transition-colors hover:bg-forest-900 disabled:opacity-60"
            >
              {pending && !asking ? "Saving…" : (LABEL[primary] ?? primary)}
            </button>
          </form>
        ) : null}

        {others.length > 0 ? (
          <div ref={menuRef} className="relative">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => {
                const r = triggerRef.current?.getBoundingClientRect();
                const width = 176;
                if (r) {
                  // Opens upward when there is no room below the button.
                  const room = window.innerHeight - r.bottom;
                  const height = 8 + others.length * 40;
                  setMenuPos({
                    top: room > height + 8 ? r.bottom + 4 : r.top - height - 4,
                    left: Math.max(8, r.right - width),
                  });
                }
                setMenuOpen((v) => !v);
              }}
              aria-expanded={menuOpen}
              aria-label={`More actions for ${reference}`}
              className="grid size-8 place-items-center rounded-[var(--radius-inset)] border border-[var(--line-strong)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--paper-sunken)] hover:text-[var(--ink)]"
            >
              <MoreHorizontal className="size-4" />
            </button>
            {menuOpen && menuPos ? (
              <div
                style={{ top: menuPos.top, left: menuPos.left }}
                className="fixed z-50 w-44 overflow-hidden rounded-[var(--radius-inset)] border border-[var(--line)] bg-[var(--paper-raised)] py-1 shadow-lg shadow-black/10"
              >
                {others.map((to) => (
                  <button
                    key={to}
                    type="button"
                    onClick={() => choose(to)}
                    className={cn(
                      "flex w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--paper-sunken)]",
                      isDestructive(to) ? "text-red-700" : "text-[var(--ink)]",
                    )}
                  >
                    {LABEL[to] ?? to}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {state.status === "error" && state.message && !asking ? (
        <span role="alert" className="max-w-[14rem] text-2xs font-medium text-red-700">
          {state.message}
        </span>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => setAsking(null)}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current && !pending) dialogRef.current?.close();
        }}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-forest-950/50"
      >
        {ask && asking ? (
          <>
            <div className="p-6">
              <div className="flex items-start gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-700">
                  <AlertTriangle className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id={titleId} className="text-lg leading-snug">
                    {ask.title}
                  </h2>
                  <p className="tnum mt-1 text-sm text-[var(--ink-muted)]">{reference}</p>
                </div>
                <button
                  type="button"
                  onClick={() => !pending && dialogRef.current?.close()}
                  aria-label="Close"
                  className="-mr-2 -mt-2 grid size-8 place-items-center rounded-full text-[var(--ink-faint)] hover:bg-[var(--paper-sunken)]"
                >
                  <X className="size-4" />
                </button>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[var(--ink-muted)]">{ask.body}</p>
              {state.status === "error" && state.message ? (
                <p role="alert" className="mt-4 rounded-[var(--radius-inset)] border border-red-200 bg-red-50 p-3 text-2xs text-red-900">
                  {state.message}
                </p>
              ) : null}
            </div>
            <form
              action={formAction}
              className="flex justify-end gap-2 border-t border-[var(--line)] bg-[var(--paper-sunken)] px-6 py-4"
            >
              <input type="hidden" name="reference" value={reference} />
              <input type="hidden" name="to" value={asking} />
              <button
                type="button"
                autoFocus
                disabled={pending}
                onClick={() => dialogRef.current?.close()}
                className="inline-flex h-9 items-center rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-4 text-sm disabled:opacity-50"
              >
                Keep booking
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-9 items-center rounded-[var(--radius-inset)] bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
              >
                {pending ? "Saving…" : ask.button}
              </button>
            </form>
          </>
        ) : null}
      </dialog>
    </div>
  );
}
