"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

type State = { status: "idle" | "error" | "ok"; message?: string };
const initial: State = { status: "idle" };

// General-purpose delete confirmation on a native <dialog>: focus trap, Escape and inert page for free.
export function ConfirmDeleteButton({
  action,
  fields,
  title,
  subject,
  children,
  confirmLabel = "Delete permanently",
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  fields: Record<string, string>;
  title: string;
  /** The thing being deleted, shown under the title. */
  subject: string;
  /** Body copy explaining what happens. */
  children: React.ReactNode;
  confirmLabel?: string;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(action, initial);
  const titleId = React.useId();

  const close = () => {
    if (!pending) dialogRef.current?.close();
  };

  React.useEffect(() => {
    if (state.status === "ok") dialogRef.current?.close();
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center gap-1 text-2xs text-[var(--ink-faint)] transition-colors hover:text-red-700"
      >
        <Trash2 className="size-3.5" />
        Delete
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-forest-950/50 backdrop:backdrop-blur-[2px]"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-700">
              <AlertTriangle className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-lg leading-snug">
                {title}
              </h2>
              <p className="mt-1 truncate text-sm font-medium text-[var(--ink-muted)]">{subject}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="-mr-2 -mt-2 grid size-8 shrink-0 place-items-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-[var(--paper-sunken)] hover:text-[var(--ink)]"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-5 space-y-3 text-sm leading-relaxed text-[var(--ink-muted)]">{children}</div>

          {state.status === "error" && state.message ? (
            <p
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-[var(--radius-inset)] border border-red-200 bg-red-50 p-3 text-2xs leading-relaxed text-red-900"
            >
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              <span>{state.message}</span>
            </p>
          ) : null}
        </div>

        <form
          action={formAction}
          className="flex flex-wrap justify-end gap-2 border-t border-[var(--line)] bg-[var(--paper-sunken)] px-6 py-4"
        >
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <button
            type="button"
            onClick={close}
            disabled={pending}
            // Cancel takes focus, so a stray Enter never deletes.
            autoFocus
            className="inline-flex h-9 items-center rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-4 text-sm transition-colors hover:bg-[var(--paper)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-inset)] bg-red-700 px-4 text-sm font-medium text-white transition-colors hover:bg-red-800 disabled:opacity-60"
          >
            <Trash2 className="size-4" />
            {pending ? "Deleting…" : confirmLabel}
          </button>
        </form>
      </dialog>
    </>
  );
}
