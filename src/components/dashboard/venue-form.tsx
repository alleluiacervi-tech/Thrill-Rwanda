"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2, Info } from "lucide-react";
import { createVenue, updateVenue } from "@/app/actions/venues";
import { ImageUploader } from "@/components/dashboard/image-uploader";
import { FormBanner, Labelled, fieldCls } from "@/components/dashboard/listing-fields";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VENUE_KINDS, type VenueState } from "@/lib/venue-rules";

const initial: VenueState = { status: "idle" };

export type VenueInitial = {
  id: string;
  name: string;
  kind: string;
  location: string;
  capacity: number;
  description: string;
  features: string[];
  images: string[];
  isPublished: boolean;
};

/** One form for adding and editing a venue; `existing` switches the action. */
export function VenueForm({ existing }: { existing?: VenueInitial }) {
  const [state, action, pending] = useActionState(existing ? updateVenue : createVenue, initial);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  if (state.status === "success") {
    return (
      <div className="mx-auto max-w-2xl rounded-[var(--radius-card)] border border-forest-300 bg-forest-100 p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-forest-600" />
        <h2 className="mt-5 text-2xl text-forest-900">
          {existing ? "Venue updated" : "Venue saved as a draft"}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-forest-800/80">
          {existing
            ? "Your changes are saved."
            : "It is not on the public page yet. Check it over, then publish it from the venue list."}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button href="/admin/venues" variant="accent">
            Go to venues
          </Button>
          <Button href={`/admin/venues/${state.id}/edit`} variant="quiet">
            Keep editing
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="mx-auto max-w-2xl space-y-6 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-5 sm:p-7"
    >
      {existing ? <input type="hidden" name="id" value={existing.id} /> : null}

      <FormBanner message={state.status === "error" ? state.message : undefined} />

      <Labelled label="Venue name" error={errors.name}>
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={existing?.name}
          placeholder="The name guests will know it by"
          className={fieldCls}
        />
      </Labelled>

      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled label="Kind of venue" error={errors.kind}>
          <select name="kind" required defaultValue={existing?.kind ?? ""} className={fieldCls}>
            <option value="" disabled>
              Choose…
            </option>
            {VENUE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled label="Town or area" error={errors.location}>
          <input
            name="location"
            required
            maxLength={120}
            defaultValue={existing?.location}
            placeholder="Kigali, or Rubavu, Lake Kivu"
            className={fieldCls}
          />
        </Labelled>
      </div>

      <Labelled
        label="Guests it takes"
        hint="The most guests the venue seats for a reception."
        error={errors.capacity}
        className="sm:max-w-[14rem]"
      >
        <input
          name="capacity"
          type="number"
          required
          min={2}
          max={5000}
          step={1}
          defaultValue={existing?.capacity}
          placeholder="250"
          className={cn(fieldCls, "tnum")}
        />
      </Labelled>

      <Labelled
        label="Description"
        hint="What the place is like, in a sentence or two. Shown on the public page."
        error={errors.description}
      >
        <textarea
          name="description"
          required
          rows={4}
          maxLength={2000}
          defaultValue={existing?.description}
          placeholder="A lawn that runs down to the water, with a covered terrace behind it."
          className={cn(fieldCls, "resize-y leading-relaxed")}
        />
      </Labelled>

      <Labelled
        label="Good to know"
        hint="One per line, or comma separated — e.g. On-site catering, Parking, Rooms on site."
      >
        <textarea
          name="features"
          rows={3}
          defaultValue={existing?.features.join("\n")}
          placeholder={"On-site catering\nParking\nRooms on site"}
          className={cn(fieldCls, "resize-y leading-relaxed")}
        />
      </Labelled>

      <ImageUploader defaultValue={existing?.images} />

      <p className="flex items-start gap-3 rounded-[var(--radius-inset)] border border-[var(--line)] bg-[var(--paper-sunken)] p-4 text-2xs leading-relaxed text-[var(--ink-muted)]">
        <Info className="mt-px size-4 shrink-0 text-clay-700" />
        <span>
          Venues carry no price and no calendar. Couples send a request from the
          venue&rsquo;s card; the date and the cost are confirmed with the venue and
          returned in a written quote. Only list a venue Thrill Rwanda is able
          to reserve.
        </span>
      </p>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="accent" size="lg" disabled={pending}>
          {pending ? "Saving…" : existing ? "Save changes" : "Save venue"}
        </Button>
        <Link
          href="/admin/venues"
          className="inline-flex items-center px-2 text-sm text-[var(--ink-muted)] underline-offset-4 hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
