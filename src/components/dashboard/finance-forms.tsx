"use client";
import { useActionState } from "react";
import {
  recordFinanceAction,
  recordSupplier,
  recordSettlementAccount,
  recordAccountStatus,
} from "@/app/actions/finance";
import type { FinanceActionState } from "@/lib/finance-rules";
import { Button } from "@/components/ui/button";
import { useFlashAction } from "@/components/dashboard/flash";
export type FormField = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  value?: string;
  options?: { value: string; label: string }[];
  help?: string;
};
const field =
  "mt-2 block w-full min-w-0 rounded-xl border border-[var(--line-strong)] bg-[var(--paper-raised)] p-3";
export function FinanceForm({
  title,
  kind = "finance",
  hidden,
  fields,
  description,
  submit = "Record operation",
}: {
  title: string;
  kind?: "finance" | "supplier" | "account" | "accountStatus";
  hidden: Record<string, string | number>;
  fields: FormField[];
  description?: string;
  submit?: string;
}) {
  const [state, action, pending] = useActionState(
    useFlashAction(
      kind === "supplier"
        ? recordSupplier
        : kind === "account"
          ? recordSettlementAccount
          : kind === "accountStatus"
            ? recordAccountStatus
            : recordFinanceAction,
    ),
    { status: "idle" } as FinanceActionState,
  );
  return (
    <details className="group mt-3 min-w-0 border-b border-[var(--line)] pb-3 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">{title}<span aria-hidden className="text-lg leading-none text-[var(--ink-faint)] transition-transform group-open:rotate-45">+</span></summary>
      <form
        action={action}
        onReset={(e) => e.preventDefault()}
        className="mt-4 space-y-4"
      >
        {description && <p className="text-sm">{description}</p>}
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} name={name} type="hidden" value={value} />
        ))}
        {state.status === "error" && state.message && (
          <p role="alert">
            {state.message}
          </p>
        )}
        <fieldset
          disabled={pending}
          className="grid min-w-0 gap-4 sm:grid-cols-2"
        >
          {fields.map((f) =>
            f.type === "checkbox" ? (
              <label key={f.name} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name={f.name}
                  defaultChecked={f.value === "true"}
                  className="mt-1 size-5"
                />
                {f.label}
              </label>
            ) : (
              <label key={f.name} className="min-w-0">
                {f.label}
                {f.options ? (
                  <select
                    name={f.name}
                    defaultValue={f.value ?? ""}
                    required={f.required}
                    className={field}
                  >
                    <option value="">Choose…</option>
                    {f.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    name={f.name}
                    defaultValue={f.value}
                    required={f.required}
                    maxLength={3000}
                    rows={3}
                    className={field}
                  />
                ) : (
                  <input
                    type={f.type ?? "text"}
                    name={f.name}
                    defaultValue={f.value}
                    required={f.required}
                    maxLength={3000}
                    className={field}
                  />
                )}
                {f.help && <span className="mt-1 block text-sm">{f.help}</span>}
              </label>
            ),
          )}
        </fieldset>
        {kind !== "accountStatus" && (
          <label className="flex items-start gap-3 text-sm">
            <input
              className="mt-1 size-5 shrink-0"
              type="checkbox"
              name="verified"
              required
            />
            {kind === "finance"
              ? "I checked the supporting records and am authorized to record this action. A recorded receipt is unverified until finance reconciles it; payouts must have actually occurred off-site."
              : "I verified these details, approval evidence and permissions. No login credentials or API secrets are included."}
          </label>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submit}
        </Button>
      </form>
    </details>
  );
}
