"use client";

import * as React from "react";

/**
 * A page-level "Saved" notice for dashboard forms.
 *
 * Many dashboard forms are keyed by the record's version so their fields reset
 * after a save. That remount also drops the form's own state, so the success
 * message the action returned was never seen. Forms pass their success message
 * here instead: the notice lives in the dashboard shell, which survives the
 * remount, and shows it for a few seconds.
 */

type Flash = { id: number; text: string };

let current: Flash | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function flash(text: string) {
  current = { id: Date.now(), text };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    emit();
  }, 5000);
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

type ActionResult = { status: string; message?: string };

/**
 * Wraps a form action so a successful result is also announced page-wide.
 * The wrapper runs when the action returns, so it works even when the form
 * that started it has already been replaced.
 */
export function useFlashAction<S extends ActionResult, P extends unknown[]>(
  action: (state: S, ...args: P) => Promise<S>,
): (state: S, ...args: P) => Promise<S> {
  return React.useCallback(
    async (state: S, ...args: P) => {
      const result = await action(state, ...args);
      if ((result.status === "ok" || result.status === "success") && result.message) flash(result.message);
      return result;
    },
    [action],
  );
}

export function FlashNotice() {
  const notice = React.useSyncExternalStore(subscribe, () => current, () => null);
  if (!notice) return null;
  return (
    <p
      key={notice.id}
      role="status"
      className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded px-4 py-2.5 text-sm font-medium shadow-lg bg-forest-900 text-bone-50"
    >
      {notice.text}
    </p>
  );
}
