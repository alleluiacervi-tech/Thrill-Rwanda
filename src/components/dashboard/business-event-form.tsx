"use client";
import { useFlashAction } from "@/components/dashboard/flash";

import { useActionState } from "react";
import { saveBusinessEventUpdate } from "@/app/actions/business-events";
import type { EnquiryActionState } from "@/lib/enquiry-workflow";

export function BusinessEventForm({
  reference, version, command, statuses, milestones,
}: {
  reference: string;
  version: number;
  command: "SOURCE" | "MILESTONE";
  statuses: readonly string[];
  milestones?: readonly string[];
}) {
  const [state, action, pending] = useActionState(
    useFlashAction(saveBusinessEventUpdate),
    { status: "idle" } as EnquiryActionState,
  );
  const sourcing = command === "SOURCE";
  const field = "block w-full rounded border border-[var(--line)] p-2";
  const option = (value: string) => (
    <option key={value} value={value}>{value.toLowerCase().replaceAll("_", " ")}</option>
  );

  return (
    <form action={action} className="grid gap-3 rounded-xl border border-[var(--line)] p-4">
      <h3 className="text-lg">{sourcing ? "Record a venue response" : "Update an organizer milestone"}</h3>
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="command" value={command} />
      {sourcing ? (
        <>
          <label>Hotel or venue<input name="venue" required minLength={2} maxLength={160} className={field} /></label>
          <label>Hall or meeting room<input name="hall" maxLength={160} className={field} /></label>
          <label>Room layout<input name="layout" maxLength={120} className={field} /></label>
          <label>Capacity for this layout<input name="capacity" type="number" min={1} max={100000} className={field} /></label>
          <label>Breakout rooms, access, AV or floor plan reference<textarea name="facilities" maxLength={1000} className={field} /></label>
        </>
      ) : (
        <label>Milestone<select name="milestone" className={field}>{milestones?.map(option)}</select></label>
      )}
      <label>Status<select name="status" className={field}>{statuses.map(option)}</select></label>
      {sourcing && (
        <label>Hold deadline (for held venues only)<input name="holdUntil" type="date" className={field} /></label>
      )}
      <label>
        Internal evidence
        <textarea name="evidence" required minLength={5} maxLength={2000} className={field} />
      </label>
      <button type="submit" disabled={pending} className="justify-self-start rounded bg-forest-800 px-4 py-2 text-white">
        {pending ? "Saving…" : "Save update"}
      </button>
      {state.status === "error" && <p role="alert">{state.message}</p>}
    </form>
  );
}
