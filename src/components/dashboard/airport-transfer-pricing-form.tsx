"use client";

import { useActionState } from "react";
import { saveAirportTransferPricing } from "@/app/actions/airport-transfer-pricing";
import { Button } from "@/components/ui/button";
import {
  AIRPORT_TRANSFER_BANDS,
  AIRPORT_TRANSFER_DIRECTIONS,
  type AirportTransferRates,
} from "@/lib/airport-transfer-pricing";

const control = "mt-1.5 w-full rounded-lg border border-[var(--line-strong)] bg-white px-3 py-2.5 text-[var(--ink)]";

export function AirportTransferPricingForm({
  rates, version, isActive,
}: {
  rates?: AirportTransferRates;
  version: number;
  isActive: boolean;
}) {
  const [state, action, pending] = useActionState(saveAirportTransferPricing, { status: "idle" });
  return (
    <form action={action} onReset={(e) => e.preventDefault()} className="rounded-[var(--radius-card)] border border-[var(--line)] bg-white p-5 sm:p-7">
      <input type="hidden" name="version" value={version} />
      <fieldset disabled={pending} className="space-y-6">
        <div>
          <h2 className="text-xl">Supplier rates per sedan</h2>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Enter the agreed cost in RWF for one vehicle. Include parking and standard waiting when the operator charges for them.
          </p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            {AIRPORT_TRANSFER_DIRECTIONS.map((direction) => (
              <fieldset key={direction} className="space-y-3 rounded-lg border border-[var(--line)] p-4">
                <legend className="px-1 font-medium">{direction === "FROM_AIRPORT" ? "From Kigali Airport" : "To Kigali Airport"}</legend>
                {AIRPORT_TRANSFER_BANDS.map(({ maxMeters, label }, index) => (
                  <label key={maxMeters} className="block text-sm">
                    {label} · RWF
                    <input className={control} name={`${direction}_${maxMeters}`} type="number" min={1} max={1000000} required defaultValue={rates?.supplierRwf[direction][index]} />
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { name: "dispatchRwf", label: "Dispatch cost (RWF)", value: rates?.dispatchRwf ?? 1000, max: 100000 },
            { name: "nightRwf", label: "Additional night cost (RWF)", value: rates?.nightRwf ?? 0, max: 100000 },
            { name: "paymentPercent", label: "Variable payment cost (%)", value: (rates?.paymentBps ?? 200) / 100, max: 15, step: "0.01" },
            { name: "contributionPercent", label: "Target contribution (%)", value: (rates?.contributionBps ?? 2200) / 100, max: 50, step: "0.01" },
          ].map(({ name, label, value, max, step }) => (
            <label key={name} className="text-sm">
              {label}
              <input className={control} name={name} type="number" min={0} max={max} step={step} required defaultValue={value} />
            </label>
          ))}
          <label className="text-sm">
            Supplier agreement valid through
            <input className={control} name="validThrough" type="date" required defaultValue={rates?.validThrough} />
          </label>
          <label className="text-sm">
            Supplier agreement reference
            <input className={control} name="evidence" minLength={10} maxLength={500} required defaultValue={rates?.evidence} />
          </label>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input className="mt-0.5 size-4 accent-forest-800" name="isActive" type="checkbox" defaultChecked={isActive} />
          <span>Use this rate card for customer estimates. I have verified the supplier costs and terms.</span>
        </label>
        <Button type="submit" variant="accent" disabled={pending}>{pending ? "Saving…" : "Save rates"}</Button>
        {state.message ? <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm text-red-800" : "text-sm text-forest-800"}>{state.message}</p> : null}
      </fieldset>
    </form>
  );
}
