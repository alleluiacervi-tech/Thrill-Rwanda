"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createVehicle } from "@/app/actions/listings";
import { updateVehicle } from "@/app/actions/listings-edit";
import {
  FUEL_TYPES,
  VEHICLE_CATEGORIES,
  VEHICLE_FEATURES,
  type ListingState,
} from "@/lib/listing-schemas";
import { TagPicker } from "@/components/dashboard/tag-picker";
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
import { cn } from "@/lib/utils";

const initial: ListingState = { status: "idle" };

// A saved value outside FUEL_TYPES would otherwise make the select show the
// first option and overwrite it on save. Carry it through so it stays visible.
function withCurrent(options: readonly string[], current?: string) {
  return current && !options.includes(current) ? [current, ...options] : [...options];
}

export type VehicleInitial = {
  id: string;
  make: string;
  model: string;
  year: number;
  category: string;
  seats: number;
  transmission: string;
  fuelType: string;
  isPublished: boolean;
  quantity: number;
  pricePerDayMinor: number;
  driverPerDayMinor: number | null;
  insuranceChargeMinor: number | null;
  features: string[];
  images: string[];
};

/** One component for both create and edit — `existing` switches the action. */
export function VehicleForm({
  existing,
  providers,
  basePath = "/provider/listings",
}: {
  existing?: VehicleInitial;
  /** Admin only. A provider is never given this, so never submits an owner. */
  providers?: ProviderOption[];
  /** Where Cancel and the success panel return to. */
  basePath?: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    existing ? updateVehicle : createVehicle,
    initial,
  );
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const [live, setLive] = React.useState(existing?.isPublished ?? false);

  if (state.status === "success") {
    return (
      <ListingSaved
        title={existing ? "Vehicle updated" : "Vehicle saved as a draft"}
        body={
          existing
            ? "Your changes are live. Existing bookings keep the price they were made at."
            : "Its calendar is open for the next 365 days, with one unit per vehicle you own. Check the details, then publish it from your listings."
        }
        previewHref={`/cars/${state.slug}`}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled label="Make" error={errors.make}>
          <input name="make" required defaultValue={existing?.make} placeholder="Toyota" className={fieldCls} />
        </Labelled>
        <Labelled label="Model" error={errors.model}>
          <input name="model" required defaultValue={existing?.model} placeholder="Land Cruiser Prado" className={fieldCls} />
        </Labelled>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Labelled label="Year" error={errors.year}>
          <input
            name="year"
            type="number"
            required
            defaultValue={existing?.year ?? new Date().getFullYear()}
            min={1990}
            max={new Date().getFullYear() + 1}
            className={cn(fieldCls, "tnum")}
          />
        </Labelled>
        <Labelled label="Seats" error={errors.seats}>
          <input name="seats" type="number" required defaultValue={existing?.seats ?? 5} min={1} max={60} className={cn(fieldCls, "tnum")} />
        </Labelled>
        <Labelled label="Transmission" error={errors.transmission}>
          <select name="transmission" defaultValue={existing?.transmission ?? "Automatic"} className={fieldCls}>
            <option>Automatic</option>
            <option>Manual</option>
          </select>
        </Labelled>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled label="Category" error={errors.category}>
          <select
            name="category"
            required
            defaultValue={existing?.category ?? "4x4 Safari"}
            className={fieldCls}
          >
            {withCurrent(VEHICLE_CATEGORIES, existing?.category).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled label="Fuel type" error={errors.fuelType}>
          <select
            name="fuelType"
            required
            defaultValue={existing?.fuelType ?? "Diesel"}
            className={fieldCls}
          >
            {withCurrent(FUEL_TYPES, existing?.fuelType).map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Labelled>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled
          label="Price per day (USD)"
          hint="Whole shillings. What a customer pays for one day."
          error={errors.pricePerDay}
        >
          <input
            name="pricePerDay"
            type="number"
            required
            min={1}
            step={1}
            defaultValue={existing ? existing.pricePerDayMinor / 100 : undefined}
            placeholder="14500"
            className={cn(fieldCls, "tnum")}
          />
        </Labelled>
        <Labelled
          label="How many do you have?"
          hint="Identical units of this vehicle. This is your daily capacity."
          error={errors.quantity}
        >
          <input
            name="quantity"
            type="number"
            required
            defaultValue={existing?.quantity ?? 1}
            min={1}
            max={200}
            className={cn(fieldCls, "tnum")}
          />
        </Labelled>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled
          label="Driver per day (USD)"
          hint="Extra charge when a customer wants a driver. Leave blank for self-drive only."
          error={errors.driverPerDay}
        >
          <input
            name="driverPerDay"
            type="number"
            min={1}
            step={1}
            defaultValue={existing?.driverPerDayMinor ? existing.driverPerDayMinor / 100 : undefined}
            placeholder="3500"
            className={cn(fieldCls, "tnum")}
          />
        </Labelled>
        <Labelled
          label="Damage liability (USD)"
          hint="What the customer agrees to be liable for if this vehicle is damaged."
          error={errors.insuranceCharge}
        >
          <input
            name="insuranceCharge"
            type="number"
            min={1}
            step={1}
            defaultValue={
              existing?.insuranceChargeMinor ? existing.insuranceChargeMinor / 100 : undefined
            }
            placeholder="60000"
            className={cn(fieldCls, "tnum")}
          />
        </Labelled>
      </div>

      <TagPicker
        name="features"
        label="What's included in the hire price"
        hint="Mileage limit, insurance, toolkit, anything else the price covers. Tap a suggestion or type your own."
        suggestions={VEHICLE_FEATURES}
        defaultValue={existing?.features}
      />

      <ImageUploader defaultValue={existing?.images} />

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="isPublished"
          checked={live}
          onChange={(e) => setLive(e.target.checked)}
          className="size-4.5 rounded-[0.3rem] accent-forest-800"
        />
        Available for rental
      </label>

      {existing || live ? null : <DraftNotice noun="vehicle" />}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="accent" size="lg" disabled={pending}>
          {pending ? "Saving…" : existing ? "Save changes" : "Save vehicle"}
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
