"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createHotel } from "@/app/actions/listings";
import { updateHotel } from "@/app/actions/listings-edit";
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
import { cn } from "@/lib/utils";

const initial: ListingState = { status: "idle" };

export type HotelInitial = {
  id: string;
  name: string;
  location: string;
  stars: number | null;
  description: string | null;
  amenities: string[];
  images: string[];
  rooms: {
    id: string;
    name: string;
    capacity: number;
    quantity: number;
    pricePerNightMinor: number;
  }[];
};

/**
 * A room row in the form.
 *
 * `id` is the database id for a room that already exists and `null` for one
 * the provider just added. It is submitted as a hidden `roomId` field, and
 * that blank-or-present distinction is the whole reason `updateHotel` can
 * tell an update from an insert in a single pass over the parallel arrays.
 */
type RoomRow = {
  key: number;
  id: string | null;
  name: string;
  capacity: number;
  quantity: number;
  price: number | "";
};

const blankRoom = (key: number): RoomRow => ({
  key,
  id: null,
  name: "",
  capacity: 2,
  quantity: 1,
  price: "",
});

export function HotelForm({
  existing,
  providers,
  basePath = "/provider/listings",
}: {
  existing?: HotelInitial;
  /** Admin only. A provider is never given this, so never submits an owner. */
  providers?: ProviderOption[];
  /** Where Cancel and the success panel return to. */
  basePath?: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    existing ? updateHotel : createHotel,
    initial,
  );
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  /* Room rows are tracked by a stable key, not an index. Removing a middle
     row by index makes React reuse the wrong DOM node and the typed values
     shuffle up — a classic repeater bug. */
  const [rooms, setRooms] = React.useState<RoomRow[]>(() =>
    existing && existing.rooms.length > 0
      ? existing.rooms.map((r, i) => ({
          key: i,
          id: r.id,
          name: r.name,
          capacity: r.capacity,
          quantity: r.quantity,
          price: r.pricePerNightMinor / 100,
        }))
      : [blankRoom(0)],
  );
  const nextKey = React.useRef(rooms.length);

  if (state.status === "success") {
    return (
      <ListingSaved
        title={existing ? "Property updated" : "Property saved as a draft"}
        body={
          existing
            ? "Your changes are live. Any room you added starts hidden with its own fresh calendar — publish it from your listings."
            : "Each room type has its own calendar, open for 365 days. Check the details, then publish the property and its rooms from your listings."
        }
        previewHref={`/hotels/${state.slug}`}
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

      <Labelled label="Property name" error={errors.name}>
        <input
          name="name"
          required
          defaultValue={existing?.name}
          placeholder="Volcanoes Ridge Lodge"
          className={fieldCls}
        />
      </Labelled>

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Labelled label="Location" error={errors.location}>
          <input
            name="location"
            required
            defaultValue={existing?.location}
            placeholder="Musanze, Northern Province"
            className={fieldCls}
          />
        </Labelled>
        <Labelled label="Star rating" error={errors.stars}>
          <select
            name="stars"
            defaultValue={existing?.stars ? String(existing.stars) : ""}
            className={fieldCls}
          >
            <option value="">Not rated</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} star
              </option>
            ))}
          </select>
        </Labelled>
      </div>

      <Labelled label="Description">
        <textarea
          name="description"
          rows={4}
          defaultValue={existing?.description ?? ""}
          placeholder="Where it is, what it's like to stay there, what's included."
          className={cn(fieldCls, "resize-y leading-relaxed")}
        />
      </Labelled>

      <Labelled
        label="Amenities"
        hint="One per line, or comma separated — e.g. Full board, Wi-Fi, Pool."
      >
        <textarea
          name="amenities"
          rows={3}
          defaultValue={existing?.amenities.join("\n")}
          placeholder={"Full board\nGame drives\nRiverfront"}
          className={cn(fieldCls, "resize-y leading-relaxed")}
        />
      </Labelled>

      {/* ------------------------------------------------------- room types */}
      <fieldset className="space-y-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-sunken)] p-5">
        <legend className="px-1 text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
          Room types
        </legend>

        <p className="text-2xs leading-relaxed text-[var(--ink-muted)]">
          Rooms are what customers actually book — the property itself is not
          bookable, so at least one type is required. Each carries its own
          price and how many of that room you have.
        </p>

        {errors.rooms ? (
          <p role="alert" className="text-2xs font-medium text-red-700">
            {errors.rooms}
          </p>
        ) : null}

        {rooms.map((room, i) => (
          <div
            key={room.key}
            className="space-y-3 rounded-[var(--radius-inset)] border border-[var(--line)] bg-[var(--paper-raised)] p-4"
          >
            {/* Blank for a new row, the room's id for an existing one. */}
            <input type="hidden" name="roomId" value={room.id ?? ""} />

            <div className="flex items-center justify-between">
              <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                Room type {i + 1}
              </span>
              {/* Only unsaved rows can be dropped. A saved room may already
                  hold bookings, so it is unpublished from the listings page
                  rather than deleted — offering "Remove" here would look
                  like a delete and silently do nothing. */}
              {room.id === null && rooms.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setRooms((r) => r.filter((x) => x.key !== room.key))
                  }
                  className="inline-flex items-center gap-1.5 text-2xs text-[var(--ink-muted)] transition-colors hover:text-red-700"
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </button>
              ) : null}
            </div>

            <Labelled label="Name">
              <input
                name="roomName"
                required
                defaultValue={room.name}
                placeholder="Riverfront Tented Suite"
                className={fieldCls}
              />
            </Labelled>

            <div className="grid gap-3 sm:grid-cols-3">
              <Labelled label="Sleeps">
                <input
                  name="roomCapacity"
                  type="number"
                  required
                  defaultValue={room.capacity}
                  min={1}
                  max={30}
                  className={cn(fieldCls, "tnum")}
                />
              </Labelled>
              <Labelled label="How many">
                <input
                  name="roomQuantity"
                  type="number"
                  required
                  defaultValue={room.quantity}
                  min={1}
                  max={500}
                  className={cn(fieldCls, "tnum")}
                />
              </Labelled>
              <Labelled label="Per night (USD)">
                <input
                  name="roomPrice"
                  type="number"
                  required
                  min={1}
                  step={1}
                  defaultValue={room.price}
                  placeholder="32000"
                  className={cn(fieldCls, "tnum")}
                />
              </Labelled>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setRooms((r) => [...r, blankRoom(nextKey.current++)])
          }
          className="inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] px-4 py-2 text-sm transition-colors hover:border-forest-800 hover:bg-forest-800 hover:text-bone-50"
        >
          <Plus className="size-4" />
          Add another room type
        </button>
      </fieldset>

      <ImageUploader defaultValue={existing?.images} />

      {existing ? null : <DraftNotice noun="property" />}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="accent" size="lg" disabled={pending}>
          {pending ? "Saving…" : existing ? "Save changes" : "Save property"}
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
