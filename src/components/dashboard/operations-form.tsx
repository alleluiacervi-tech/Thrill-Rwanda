"use client";
import { useActionState } from "react";
import { recordOperation } from "@/app/actions/operations";
import type { OperationsState } from "@/lib/launch-rules";
import { Button } from "@/components/ui/button";
export type OperationsField = {
  name: string;
  label: string;
  value?: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
};
export function OperationsForm({
  title,
  hidden,
  fields,
}: {
  title: string;
  hidden: Record<string, string | number>;
  fields: OperationsField[];
}) {
  const [state, action, pending] = useActionState(recordOperation, {
    status: "idle",
  } as OperationsState);
  const cls =
    "mt-2 block w-full min-w-0 rounded-lg border border-[var(--line-strong)] bg-[var(--paper-raised)] p-3";
  return (
    <details className="my-4 min-w-0 rounded-xl border border-[var(--line)] p-4">
      <summary className="cursor-pointer font-semibold">{title}</summary>
      <form
        action={action}
        onReset={(event) => event.preventDefault()}
        className="mt-4 space-y-4"
      >
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {state.message && (
          <p role={state.status === "error" ? "alert" : "status"}>
            {state.message}
          </p>
        )}
        <fieldset
          disabled={pending}
          className="grid min-w-0 gap-4 sm:grid-cols-2"
        >
          {fields.map((f) => (
            <label className="min-w-0" key={f.name}>
              {f.label}
              {f.type === "textarea" ? (
                <textarea
                  className={cls}
                  name={f.name}
                  defaultValue={f.value}
                  required={f.required}
                  maxLength={3000}
                />
              ) : f.options ? (
                <select
                  className={cls}
                  name={f.name}
                  defaultValue={f.value}
                  required={f.required}
                >
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={f.type === "checkbox" ? "ml-3 size-5" : cls}
                  type={f.type ?? "text"}
                  name={f.name}
                  defaultValue={f.type === "checkbox" ? undefined : f.value}
                  defaultChecked={f.type === "checkbox" && f.value === "true"}
                  required={f.required}
                  maxLength={2000}
                />
              )}
            </label>
          ))}
        </fieldset>
        <label className="flex gap-3">
          <input
            type="checkbox"
            name="verified"
            required
            className="size-5 shrink-0"
          />
          I checked the supporting records and am authorized to save this
          change.
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save checked change"}
        </Button>
      </form>
    </details>
  );
}
