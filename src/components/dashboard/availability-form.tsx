"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { setAvailabilityWindow, type ActionState } from "@/app/actions/provider";
import { Button } from "@/components/ui/button";
import { localDatePlus, todayLocal } from "@/lib/utils";

const initial: ActionState = { status: "idle" };

export type Resource = {
  id: string;
  label: string;
  serviceType: "TOUR" | "ROOM" | "VEHICLE";
};

const field =
  "w-full rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-lake-600";

const label =
  "flex flex-col gap-1.5 text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]";

export function AvailabilityForm({ resources }: { resources: Resource[] }) {
  const [state, action, pending] = useActionState(setAvailabilityWindow, initial);
  const [resourceKey, setResourceKey] = React.useState(
    resources[0] ? `${resources[0].serviceType}:${resources[0].id}` : "",
  );

  const [serviceType, resourceId] = resourceKey.split(":");

  return (
    <form
      action={action}
      className="space-y-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6"
    >
      <input type="hidden" name="serviceType" value={serviceType ?? ""} />
      <input type="hidden" name="resourceId" value={resourceId ?? ""} />

      {state.status === "error" && state.message ? (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-red-200 bg-red-50 p-3.5 text-2xs leading-relaxed text-red-900"
        >
          <AlertTriangle className="mt-px size-4 shrink-0" />
          {state.message}
        </p>
      ) : null}
      {state.status === "ok" && state.message ? (
        <p
          role="status"
          className="flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-forest-300 bg-forest-100 p-3.5 text-2xs leading-relaxed text-forest-900"
        >
          <CheckCircle2 className="mt-px size-4 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <label className={label}>
        Listing
        <select
          value={resourceKey}
          onChange={(e) => setResourceKey(e.target.value)}
          className={field}
        >
          {resources.map((r) => (
            <option key={`${r.serviceType}:${r.id}`} value={`${r.serviceType}:${r.id}`}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          From
          <input
            type="date"
            name="from"
            required
            defaultValue={localDatePlus(1)}
            min={todayLocal()}
            className={`${field} tnum`}
          />
        </label>
        <label className={label}>
          To
          <input
            type="date"
            name="to"
            required
            defaultValue={localDatePlus(7)}
            min={todayLocal()}
            className={`${field} tnum`}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3 pt-1">
        <Button
          type="submit"
          name="action"
          value="block"
          variant="primary"
          disabled={pending || !resourceKey}
        >
          {pending ? "Working…" : "Close these dates"}
        </Button>
        <Button
          type="submit"
          name="action"
          value="open"
          variant="outline"
          disabled={pending || !resourceKey}
        >
          Reopen them
        </Button>
      </div>

      <p className="text-2xs leading-relaxed text-[var(--ink-faint)]">
        Closing dates only stops <em>new</em> bookings. Days that already have
        a booking on them stay open, so nobody who has booked gets stranded —
        cancel those from the Bookings tab instead.
      </p>
    </form>
  );
}
