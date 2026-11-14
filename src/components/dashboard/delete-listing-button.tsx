"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { adminDeleteListing, type AdminState } from "@/app/actions/admin";

const initial: AdminState = { status: "idle" };

const KIND_LABEL = { TOUR: "tour", HOTEL: "property", VEHICLE: "vehicle" } as const;

// Native <dialog> gives focus trapping, Escape and an inert page behind it for free.
export function DeleteListingButton({
  kind,
  id,
  name,
  bookings,
  roomTypes,
}: {
  kind: "TOUR" | "HOTEL" | "VEHICLE";
  id: string;
  name: string;
  /** Bookings on record, counted server-side. Any at all blocks deletion. */
  bookings: number;
  /** Hotels only: how many room types go with it. */
  roomTypes?: number;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(adminDeleteListing, initial);
  const noun = KIND_LABEL[kind];
  const blocked = bookings > 0;

  const open = () => dialogRef.current?.showModal();
  const close = () => {
    if (!pending) dialogRef.current?.close();
  };

  // Close once the delete succeeds; the row itself disappears when the page revalidates.
  React.useEffect(() => {
    if (state.status === "ok") dialogRef.current?.close();
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-1 text-2xs text-[var(--ink-faint)] transition-colors hover:text-red-700"
      >
        <Trash2 className="size-3.5" />
        Delete
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`delete-title-${id}`}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
        onClick={(e) => {
          // A click on the backdrop lands on the dialog element itself.
          if (e.target === dialogRef.current) close();
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-forest-950/50 backdrop:backdrop-blur-[2px]"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span
              className={
                blocked
                  ? "grid size-10 shrink-0 place-items-center rounded-full bg-clay-100 text-clay-700"
                  : "grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-700"
              }
            >
              <AlertTriangle className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={`delete-title-${id}`} className="text-lg leading-snug">
                {blocked ? `This ${noun} can't be deleted` : `Delete this ${noun}?`}
              </h2>
              <p className="mt-1 truncate text-sm font-medium text-[var(--ink-muted)]">{name}</p>
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

          <div className="mt-5 space-y-3 text-sm leading-relaxed text-[var(--ink-muted)]">
            {blocked ? (
              <>
                <p>
                  It has <strong className="text-[var(--ink)]">{bookings} booking{bookings === 1 ? "" : "s"}</strong>{" "}
                  on record. Those bookings, their payments and receipts all refer to it, so removing it would leave
                  them describing nothing.
                </p>
                <p>To take it off the website, use <strong className="text-[var(--ink)]">Unpublish</strong> instead.</p>
              </>
            ) : (
              <>
                <p>
                  This permanently removes the {noun}
                  {kind === "HOTEL" && roomTypes ? `, its ${roomTypes} room type${roomTypes === 1 ? "" : "s"}` : ""} and
                  its availability calendar. It disappears from the website straight away.
                </p>
                <p className="font-medium text-red-800">This can&rsquo;t be undone.</p>
              </>
            )}
          </div>

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
          action={action}
          className="flex flex-wrap justify-end gap-2 border-t border-[var(--line)] bg-[var(--paper-sunken)] px-6 py-4"
        >
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <button
            type="button"
            onClick={close}
            disabled={pending}
            // Cancel takes focus, so a stray Enter never deletes.
            autoFocus
            className="inline-flex h-9 items-center rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-4 text-sm transition-colors hover:bg-[var(--paper)] disabled:opacity-50"
          >
            {blocked ? "Close" : "Cancel"}
          </button>
          {blocked ? null : (
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-inset)] bg-red-700 px-4 text-sm font-medium text-white transition-colors hover:bg-red-800 disabled:opacity-60"
            >
              <Trash2 className="size-4" />
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
          )}
        </form>
      </dialog>
    </>
  );
}
