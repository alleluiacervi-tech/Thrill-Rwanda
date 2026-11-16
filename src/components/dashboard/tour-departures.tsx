"use client";

import { useActionState } from "react";
import { CalendarPlus, Trash2 } from "lucide-react";
import {
  addDeparture,
  removeDeparture,
  type DepartureState,
} from "@/app/actions/departures";
import { fieldCls } from "@/components/dashboard/listing-fields";
import { Button } from "@/components/ui/button";
import { formatRun } from "@/lib/departure-rules";
import type { Departure } from "@/lib/departures";
import { cn } from "@/lib/utils";

const idle: DepartureState = { status: "idle" };

/**
 * The dates a fixed-departure tour runs on. Sits under the tour form on the
 * edit pages. Adding or removing a date does not touch the offer's approval.
 */
export function TourDepartures({
  tourId,
  fixed,
  durationDays,
  seats,
  departures,
  today,
}: {
  tourId: string;
  /** Whether "Runs on set dates only" is saved on the tour. */
  fixed: boolean;
  durationDays: number;
  /** The tour's capacity: seats on every run. */
  seats: number;
  departures: Departure[];
  /** Earliest date that may be added, YYYY-MM-DD. */
  today: string;
}) {
  const [state, add, adding] = useActionState(addDeparture, idle);

  return (
    <section className="mx-auto mt-6 max-w-2xl rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-5 sm:p-7">
      <h2 className="text-xl">Dates this tour runs</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
        {fixed
          ? `Each date is a run of ${durationDays} ${durationDays === 1 ? "day" : "days"} with ${seats} seats. Travellers can book only the dates listed here. Changing the dates does not affect the offer's approval.`
          : "This tour can be booked for any open day. To sell it as dated editions, tick “Runs on set dates only” above and save, then add the dates here."}
      </p>

      {departures.length ? (
        <ul className="mt-5 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {departures.map((departure) => (
            <DepartureRow key={departure.id} departure={departure} />
          ))}
        </ul>
      ) : fixed ? (
        <p className="mt-5 rounded-[var(--radius-inset)] border border-dashed border-[var(--line-strong)] p-4 text-sm text-[var(--ink-muted)]">
          No upcoming dates yet. Until one is added, this tour shows as “dates
          being scheduled” and cannot be booked.
        </p>
      ) : null}

      {fixed ? (
        <form action={add} className="mt-6 grid gap-4 sm:grid-cols-[11rem_1fr_auto] sm:items-end">
          <input type="hidden" name="tourId" value={tourId} />
          <label className="flex flex-col gap-1.5 text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
            First day
            <input name="startsOn" type="date" required min={today} className={cn(fieldCls, "tnum")} />
          </label>
          <label className="flex flex-col gap-1.5 text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
            Note (optional)
            <input name="note" maxLength={120} placeholder="For example, Umuganura weekend" className={fieldCls} />
          </label>
          <Button type="submit" variant="primary" disabled={adding}>
            <CalendarPlus className="size-4" aria-hidden />
            {adding ? "Adding…" : "Add date"}
          </Button>
        </form>
      ) : null}

      <Notice state={state} />
    </section>
  );
}

function DepartureRow({ departure }: { departure: Departure }) {
  const [state, remove, removing] = useActionState(removeDeparture, idle);
  const booked = departure.seatsTotal - departure.seatsLeft;
  return (
    <li className="py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="tnum font-medium">{formatRun(departure.startsOn, departure.lastDay)}</p>
          <p className="tnum text-sm text-[var(--ink-muted)]">
            {departure.seatsLeft} of {departure.seatsTotal} seats left
            {booked > 0 ? ` · ${booked} held` : ""}
            {departure.note ? ` · ${departure.note}` : ""}
          </p>
        </div>
        <form action={remove}>
          <input type="hidden" name="id" value={departure.id} />
          <Button type="submit" variant="outline" size="sm" disabled={removing}>
            <Trash2 className="size-3.5" aria-hidden />
            {removing ? "Removing…" : "Remove"}
          </Button>
        </form>
      </div>
      <Notice state={state} />
    </li>
  );
}

function Notice({ state }: { state: DepartureState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={cn(
        "mt-3 rounded-[var(--radius-inset)] border p-3 text-sm",
        state.status === "error"
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-forest-300 bg-forest-100 text-forest-900",
      )}
    >
      {state.message}
    </p>
  );
}
