"use client";

import { useActionState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { addDeskFare, runFareCheckNow, setFareSource, type FareActionState } from "@/app/actions/fares";
import { FormBanner, Labelled, fieldCls } from "@/components/dashboard/listing-fields";
import { destinationRegions } from "@/lib/flight-destinations";
import { StatusPill } from "@/components/dashboard/dash-ui";
import { Button } from "@/components/ui/button";
import type { FareSource } from "@/lib/fare-sources";
import { cn } from "@/lib/utils";

const initial: FareActionState = { status: "idle" };

export type SourceOption = {
  value: FareSource;
  title: string;
  body: string;
  ready: boolean;
  /** What is missing, when not ready. */
  reason?: string;
};

function Done({ state }: { state: FareActionState }) {
  if (state.status === "error") return <FormBanner message={state.message} />;
  if (state.status !== "done") return null;
  return (
    <p role="status" className="flex items-start gap-3 rounded-[var(--radius-inset)] border border-forest-200 bg-forest-50 p-4 text-sm leading-relaxed text-forest-900">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      {state.message}
    </p>
  );
}

/** The three sources as cards; one not ready can't be chosen and says what it needs. */
export function FareSourceForm({ current, options }: { current: FareSource; options: SourceOption[] }) {
  const [state, action, pending] = useActionState(setFareSource, initial);
  return (
    <form action={action} className="space-y-4">
      <fieldset className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <legend className="sr-only">Price source</legend>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "relative flex cursor-pointer flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--line)] p-4 transition-colors",
              "has-[:checked]:border-forest-700 has-[:checked]:bg-forest-50/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-forest-600",
              !option.ready && "cursor-not-allowed opacity-75",
            )}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="source"
                  value={option.value}
                  defaultChecked={option.value === current}
                  disabled={!option.ready && option.value !== current}
                  className="size-4 accent-forest-700"
                />
                <span className="font-semibold">{option.title}</span>
              </span>
              {option.value === current ? (
                <StatusPill tone={option.value === "off" ? "neutral" : "good"}>In use</StatusPill>
              ) : option.ready ? (
                <StatusPill tone="info">Ready</StatusPill>
              ) : (
                <StatusPill tone="warn">Needs a key</StatusPill>
              )}
            </span>
            <span className="text-sm leading-relaxed text-[var(--ink-muted)]">{option.body}</span>
            {!option.ready && option.reason ? <span className="text-xs leading-relaxed text-sun-900">{option.reason}</span> : null}
          </label>
        ))}
      </fieldset>
      <Done state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save price source"}
      </Button>
    </form>
  );
}

/** Runs today's check now instead of waiting for 06:15. */
export function RunFareCheck({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(runFareCheckNow, initial);
  return (
    <form action={action} className="space-y-4">
      <Done state={state} />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="outline" disabled={disabled || pending}>
          <RefreshCw className={cn("size-4", pending && "animate-spin")} aria-hidden />
          {pending ? "Checking 12 routes…" : "Check fares now"}
        </Button>
        {pending ? <span className="text-sm text-[var(--ink-muted)]">This can take a couple of minutes. Keep this page open.</span> : null}
      </div>
    </form>
  );
}

/** A fare the desk checked itself: shown on /flights until "show until", beside fetched fares. */
export function DeskFareForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(addDeskFare, initial);
  return (
    <form action={action} className="space-y-4" key={state.status === "done" ? state.message : "form"}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Labelled label="Destination">
          <select name="destination" required className={fieldCls} defaultValue="">
            <option value="" disabled>Choose a city</option>
            {destinationRegions.map((region) => (
              <optgroup key={region.id} label={region.label}>
                {region.places.map((place) => (
                  <option key={place.code} value={place.code}>{place.city}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Labelled>
        <Labelled label="Departure date">
          <input type="date" name="departureDate" required min={today} className={fieldCls} />
        </Labelled>
        <Labelled label="One-way fare" hint="Economy, one adult, all taxes">
          <span className="flex gap-2">
            <input type="number" name="price" required min="1" step="any" inputMode="decimal" placeholder="245" className={cn(fieldCls, "min-w-0")} />
            <select name="currency" className={cn(fieldCls, "w-24 shrink-0 px-3")} defaultValue="USD">
              <option>USD</option>
              <option>RWF</option>
              <option>EUR</option>
            </select>
          </span>
        </Labelled>
        <Labelled label="Show until" hint="It leaves the board after this day">
          <input type="date" name="validUntil" required min={today} className={fieldCls} />
        </Labelled>
        <Labelled label="Airline">
          <input name="airline" maxLength={60} placeholder="RwandAir" className={fieldCls} />
        </Labelled>
        <Labelled label="Stops">
          <select name="stops" className={fieldCls} defaultValue="0">
            <option value="0">Nonstop</option>
            <option value="1">1 stop</option>
            <option value="2">2 stops</option>
          </select>
        </Labelled>
        <Labelled label="Deal line (optional)" hint="Also lists it under Best deals" className="sm:col-span-2">
          <input name="dealNote" maxLength={60} placeholder="Holiday special, 12 seats left" className={fieldCls} />
        </Labelled>
      </div>
      <Done state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add fare"}</Button>
    </form>
  );
}
