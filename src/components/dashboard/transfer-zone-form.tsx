"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createTransferZone, updateTransferZone } from "@/app/actions/transfers";
import { FormBanner, Labelled, fieldCls } from "@/components/dashboard/listing-fields";
import { Button } from "@/components/ui/button";
import {
  ORIGIN_LABEL,
  TRANSFER_ORIGINS,
  type TransferOriginValue,
  type TransferZoneState,
} from "@/lib/transfer-zones-shared";
import { cn } from "@/lib/utils";

const initial: TransferZoneState = { status: "idle" };

export type TransferZoneInitial = {
  id: string;
  origin: TransferOriginValue;
  name: string;
  areas: string;
  distance: string | null;
  sedanMinor: number;
  vanMinor: number;
  premiumMinor: number;
  sortOrder: number;
  isActive: boolean;
};

/** One form for adding and editing; `existing` switches the action. */
export function TransferZoneForm({ existing }: { existing?: TransferZoneInitial }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(existing ? updateTransferZone : createTransferZone, initial);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  // After a failed save, refill from what was typed rather than the saved record.
  const typed = state.status === "error" ? state.values : undefined;

  if (state.status === "success") {
    return (
      <div className="mx-auto max-w-2xl rounded-[var(--radius-card)] border border-forest-300 bg-forest-100 p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-forest-600" />
        <h2 className="mt-5 text-2xl text-forest-900">{existing ? "Zone updated" : "Zone added"}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-forest-800/80">
          The new prices are already live on the transfers page and the homepage.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button variant="accent" onClick={() => router.push("/admin/transfers")}>
            Back to zones
          </Button>
          <Button href="/transfers" variant="quiet">
            View transfers page
          </Button>
        </div>
      </div>
    );
  }

  const price = (name: "sedan" | "van" | "premium", label: string, minor?: number, placeholder?: string) => (
    <Labelled label={label} error={errors[name]}>
      <input
        name={name}
        type="number"
        required
        min={1}
        step={1}
        defaultValue={typed?.[name] ?? (minor ? minor / 100 : undefined)}
        placeholder={placeholder}
        className={cn(fieldCls, "tnum")}
      />
    </Labelled>
  );

  return (
    <form
      key={state.status === "error" ? state.attempt : "form"}
      action={action}
      className="mx-auto max-w-2xl space-y-6 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-5 sm:p-7"
    >
      {existing ? <input type="hidden" name="id" value={existing.id} /> : null}

      <FormBanner message={state.status === "error" ? state.message : undefined} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled label="Price list" hint="Kigali zones serve Kigali International Airport." error={errors.origin}>
          <select name="origin" defaultValue={typed?.origin ?? existing?.origin ?? "KIGALI"} className={fieldCls}>
            {TRANSFER_ORIGINS.map((o) => (
              <option key={o} value={o}>
                {ORIGIN_LABEL[o]}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled label="Zone name" hint="Rows with the same name are grouped on the site." error={errors.name}>
          <input
            name="name"
            required
            defaultValue={typed?.name ?? existing?.name}
            placeholder="Zone 2 · Central Kigali"
            className={fieldCls}
          />
        </Labelled>
      </div>

      <Labelled
        label="Areas"
        hint="Separate with commas. Each one is a choice customers pick from. For town-to-town routes, write the route as “Kigali ↔ Musanze”."
        error={errors.areas}
      >
        <textarea
          name="areas"
          required
          rows={3}
          defaultValue={typed?.areas ?? existing?.areas}
          placeholder="Westlands, Parklands, Gigiri, Lavington"
          className={cn(fieldCls, "resize-y")}
        />
      </Labelled>

      <Labelled label="Distance (optional)" hint="Shown beside the zone, e.g. 18–25 km." error={errors.distance}>
        <input name="distance" defaultValue={typed?.distance ?? existing?.distance ?? ""} placeholder="18–25 km" className={fieldCls} />
      </Labelled>

      <div className="grid gap-4 sm:grid-cols-3">
        {price("sedan", "Sedan (USD)", existing?.sedanMinor, "40")}
        {price("van", "Van 7-seater (USD)", existing?.vanMinor, "60")}
        {price("premium", "Prado / Alphard (USD)", existing?.premiumMinor, "80")}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled label="Position" hint="Lower numbers show first." error={errors.sortOrder}>
          <input
            name="sortOrder"
            type="number"
            min={0}
            max={9999}
            step={1}
            defaultValue={typed?.sortOrder ?? existing?.sortOrder ?? 100}
            className={cn(fieldCls, "tnum")}
          />
        </Labelled>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={typed ? typed.isActive === "on" : (existing?.isActive ?? true)}
          className="size-4.5 rounded-[0.3rem] accent-forest-800"
        />
        Bookable on the website
      </label>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="accent" size="lg" disabled={pending}>
          {pending ? "Saving…" : existing ? "Save changes" : "Add zone"}
        </Button>
        <Link
          href="/admin/transfers"
          className="inline-flex items-center px-2 text-sm text-[var(--ink-muted)] underline-offset-4 hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
