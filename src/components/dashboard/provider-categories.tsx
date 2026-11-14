"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { setProviderCategories, type AdminState } from "@/app/actions/admin";
import { cn } from "@/lib/utils";

const initial: AdminState = { status: "idle" };

const CATEGORIES = [
  { value: "TOUR", label: "Safaris & tours" },
  { value: "HOTEL", label: "Hotels" },
  { value: "CAR", label: "Car hire" },
] as const;

/**
 * What a provider is allowed to list.
 *
 * Inline on the row rather than a separate page: it is one decision an admin
 * makes while looking at the provider, usually right after approving them.
 */
export function ProviderCategories({
  providerId,
  kinds,
  businessName,
}: {
  providerId: string;
  kinds: string[];
  businessName: string;
}) {
  const [state, action, pending] = useActionState(setProviderCategories, initial);
  const [chosen, setChosen] = React.useState<string[]>(kinds);

  const toggle = (value: string) =>
    setChosen((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );

  const changed =
    chosen.length !== kinds.length || chosen.some((value) => !kinds.includes(value));

  return (
    <form action={action} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="providerId" value={providerId} />
      {chosen.map((value) => (
        <input key={value} type="hidden" name="kinds" value={value} />
      ))}

      <fieldset className="flex flex-wrap justify-end gap-1">
        <legend className="sr-only">Categories {businessName} may list in</legend>
        {CATEGORIES.map((c) => {
          const on = chosen.includes(c.value);
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => toggle(c.value)}
              aria-pressed={on}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors",
                on
                  ? "border-forest-800 bg-forest-800 text-bone-50"
                  : "border-[var(--line-strong)] text-[var(--ink-faint)] hover:border-forest-800",
              )}
            >
              {on ? <Check className="size-3" /> : null}
              {c.label}
            </button>
          );
        })}
      </fieldset>

      {changed ? (
        <button
          type="submit"
          disabled={pending || chosen.length === 0}
          className="rounded-[var(--radius-inset)] bg-forest-800 px-3 py-1 text-2xs font-semibold text-bone-50 transition-colors hover:bg-forest-900 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save categories"}
        </button>
      ) : null}

      {state.status === "error" && state.message ? (
        <span role="alert" className="flex items-start gap-1 text-2xs font-medium text-red-700">
          <AlertTriangle className="mt-px size-3 shrink-0" />
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
