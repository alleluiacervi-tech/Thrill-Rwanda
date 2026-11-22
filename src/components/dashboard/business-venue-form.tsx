"use client";

import { useActionState } from "react";
import { saveBusinessVenue, saveBusinessVenueSpace, type BusinessVenueState } from "@/app/actions/business-venue-catalogue";
import { layouts, spaceTypes } from "@/lib/meeting-directory";
import { Button } from "@/components/ui/button";
import { fieldCls } from "@/components/dashboard/listing-fields";

type Entry = {
  id: string;
  updatedAt: string;
  name: string;
  isPublished: boolean;
};
const initial: BusinessVenueState = { status: "idle" };
const label = "grid gap-1.5 text-sm font-medium";

export function BusinessVenueForm(props:
  | { mode: "venue"; entry?: Entry & { kind: string; description: string; source: string | null; image: string | null } }
  | { mode: "room"; venueId: string; entry?: Entry & { type: string; maximum: number | null; features: string | null; capacities: Record<string, number> } }
) {
  const { entry } = props;
  const venue = props.mode === "venue" ? props.entry : undefined;
  const room = props.mode === "room" ? props.entry : undefined;
  const [state, action, pending] = useActionState(props.mode === "venue" ? saveBusinessVenue : saveBusinessVenueSpace, initial);
  return (
    <details className="rounded-xl border border-[var(--line)] p-4">
      <summary className="cursor-pointer font-semibold">
        {entry ? `${entry.name} · ${entry.isPublished ? "Published" : "Draft"}` : props.mode === "venue" ? "Add a meeting venue" : "Add a room or hall"}
      </summary>
      <form action={action} onReset={(event) => event.preventDefault()} className="mt-4 space-y-4">
        <input type="hidden" name="id" value={entry?.id ?? ""} />
        <input type="hidden" name="updatedAt" value={entry?.updatedAt ?? ""} />
        <label className={label}>
          {props.mode === "venue" ? "Property name" : "Room or hall name"}
          <input className={fieldCls} name="name" required minLength={2} maxLength={120} defaultValue={entry?.name} />
        </label>
        {props.mode === "venue" ? (
          <>
            <label className={label}>Property type
              <select className={fieldCls} name="kind" defaultValue={venue?.kind ?? "Hotel"}>
                <option>Hotel</option><option>Convention centre</option>
              </select>
            </label>
            <label className={label}>Public description
              <textarea className={fieldCls} name="description" required minLength={10} maxLength={600} defaultValue={venue?.description} />
            </label>
            <label className={label}>Official venue website (optional)
              <input className={fieldCls} name="source" type="url" maxLength={1000} defaultValue={venue?.source ?? ""} />
            </label>
            <label className={label}>Approved photo URL (optional)
              <input className={fieldCls} name="image" type="url" maxLength={1000} defaultValue={venue?.image ?? ""} />
            </label>
          </>
        ) : (
          <>
            <input type="hidden" name="venueId" value={props.venueId} />
            <label className={label}>Space type
              <select className={fieldCls} name="type" defaultValue={room?.type ?? "Meeting room"}>
                {spaceTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <legend className="mb-2 text-sm font-medium">Published capacities. Leave unknown figures blank.</legend>
              {layouts.map((layout) => (
                <label className={label} key={layout}>{layout}
                  <input className={fieldCls} name={`capacity-${layout}`} type="number" min={1} max={99999} defaultValue={room?.capacities[layout]} />
                </label>
              ))}
              <label className={label}>Overall maximum
                <input className={fieldCls} name="maximum" type="number" min={1} max={99999} defaultValue={room?.maximum ?? ""} />
              </label>
            </fieldset>
            <label className={label}>Accessibility, AV and breakout space (optional)
              <textarea className={fieldCls} name="features" maxLength={1000} defaultValue={room?.features ?? ""} />
            </label>
          </>
        )}
        <label className={label}>Visibility
          <select className={fieldCls} name="visibility" defaultValue={entry?.isPublished ? "published" : "draft"}>
            <option value="draft">Draft</option><option value="published">Published</option>
          </select>
        </label>
        <Button disabled={pending} type="submit">{pending ? "Saving…" : "Save"}</Button>
        {state.message && <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
      </form>
    </details>
  );
}
