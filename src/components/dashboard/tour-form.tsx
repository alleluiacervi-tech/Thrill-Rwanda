"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createTour } from "@/app/actions/listings";
import { updateTour } from "@/app/actions/listings-edit";
import type { ListingState } from "@/lib/listing-schemas";
import { ImageUploader } from "@/components/dashboard/image-uploader";
import {
  DraftNotice,
  FormBanner,
  Labelled,
  ListingSaved,
  ProviderSelect,
  type ProviderOption,
  fieldCls,
} from "@/components/dashboard/listing-fields";
import { Button } from "@/components/ui/button";
import { destinations } from "@/lib/content";
import { cn } from "@/lib/utils";

const initial: ListingState = { status: "idle" };

export type TourInitial = {
  id: string;
  name: string;
  destination: string;
  durationDays: number;
  maxParticipants: number;
  priceMinor: number;
  priceResidentMinor: number | null;
  priceNonResidentMinor: number | null;
  description: string | null;
  pickupInfo: string | null;
  activities: string[];
  images: string[];
};

/** One component for both create and edit — `existing` switches the action. */
export function TourForm({
  existing,
  providers,
  basePath = "/provider/listings",
}: {
  existing?: TourInitial;
  /** Admin only. A provider is never given this, so never submits an owner. */
  providers?: ProviderOption[];
  /** Where Cancel and the success panel return to. */
  basePath?: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    existing ? updateTour : createTour,
    initial,
  );
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  if (state.status === "success") {
    return (
      <ListingSaved
        title={existing ? "Tour updated" : "Tour saved as a draft"}
        body={
          existing
            ? "Your changes are live. Travellers already booked keep the price and group size they booked at."
            : "Its calendar is open for the next 365 days, with one seat per participant. Check the details, then publish it from your listings."
        }
        previewHref={`/tours/${state.slug}`}
        onDone={() => router.push(basePath)}
      />
    );
  }

  return (
    <form action={action} className="mx-auto max-w-2xl space-y-6 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-5 sm:p-7">
      {existing ? <input type="hidden" name="id" value={existing.id} /> : null}

      <FormBanner message={state.status === "error" ? state.message : undefined} />

      {providers ? (
        <ProviderSelect providers={providers} error={errors.providerId} />
      ) : null}

      <Labelled label="Tour name" error={errors.name}>
        <input
          name="name"
          required
          defaultValue={existing?.name}
          placeholder="Mountain Gorilla Trekking"
          className={fieldCls}
        />
      </Labelled>

      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled label="Destination" error={errors.destination}>
          <input
            name="destination"
            required
            defaultValue={existing?.destination}
            list="tour-destinations"
            placeholder="Volcanoes National Park"
            className={fieldCls}
          />
          <datalist id="tour-destinations">
            {destinations.map((d) => (
              <option key={d.slug} value={d.name} />
            ))}
          </datalist>
        </Labelled>
        <Labelled
          label="East African citizen (USD)"
          hint="Whole shillings, per traveller. The rate used if you set no others."
          error={errors.price}
        >
          <input
            name="price"
            type="number"
            required
            min={1}
            step={1}
            defaultValue={existing ? existing.priceMinor / 100 : undefined}
            placeholder="58500"
            className={cn(fieldCls, "tnum")}
          />
        </Labelled>
      </div>

      {/* Park fees differ by residency, so most operators quote three rates. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled
          label="East African resident (USD)"
          hint="On a work or residence permit. Blank charges the citizen rate."
          error={errors.priceResident}
        >
          <input
            name="priceResident"
            type="number"
            min={1}
            step={1}
            defaultValue={
              existing?.priceResidentMinor ? existing.priceResidentMinor / 100 : undefined
            }
            placeholder="72000"
            className={cn(fieldCls, "tnum")}
          />
        </Labelled>
        <Labelled
          label="Non-resident (USD)"
          hint="Visiting from outside East Africa. Blank charges the citizen rate."
          error={errors.priceNonResident}
        >
          <input
            name="priceNonResident"
            type="number"
            min={1}
            step={1}
            defaultValue={
              existing?.priceNonResidentMinor ? existing.priceNonResidentMinor / 100 : undefined
            }
            placeholder="105000"
            className={cn(fieldCls, "tnum")}
          />
        </Labelled>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled label="Duration (days)" error={errors.durationDays}>
          <input
            name="durationDays"
            type="number"
            required
            defaultValue={existing?.durationDays ?? 3}
            min={1}
            max={60}
            className={cn(fieldCls, "tnum")}
          />
        </Labelled>
        <Labelled
          label="Maximum group size"
          hint="Seats per departure. This is your daily capacity."
          error={errors.maxParticipants}
        >
          <input
            name="maxParticipants"
            type="number"
            required
            defaultValue={existing?.maxParticipants ?? 6}
            min={1}
            max={200}
            className={cn(fieldCls, "tnum")}
          />
        </Labelled>
      </div>

      <Labelled label="Description">
        <textarea
          name="description"
          rows={4}
          defaultValue={existing?.description ?? ""}
          placeholder="What the trip is, who it suits, what makes it worth booking."
          className={cn(fieldCls, "resize-y leading-relaxed")}
        />
      </Labelled>

      <Labelled
        label="Activities"
        hint="One per line, or comma separated — e.g. Gorilla trek, Canopy walk."
      >
        <textarea
          name="activities"
          rows={3}
          defaultValue={existing?.activities.join("\n")}
          placeholder={"Gorilla trek\nCanopy walk\nCultural village"}
          className={cn(fieldCls, "resize-y leading-relaxed")}
        />
      </Labelled>

      <Labelled label="Pickup information">
        <input
          name="pickupInfo"
          defaultValue={existing?.pickupInfo ?? ""}
          placeholder="Pickup from your Kigali hotel, or the airport on request."
          className={fieldCls}
        />
      </Labelled>

      <ImageUploader defaultValue={existing?.images} />

      {existing ? null : <DraftNotice noun="tour" />}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="accent" size="lg" disabled={pending}>
          {pending ? "Saving…" : existing ? "Save changes" : "Save tour"}
        </Button>
        <Link
          href={basePath}
          className="inline-flex items-center px-2 text-sm text-[var(--ink-muted)] underline-offset-4 hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
