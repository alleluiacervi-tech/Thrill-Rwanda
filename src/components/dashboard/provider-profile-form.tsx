"use client";

import { useActionState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { updateProviderProfile, type ActionState } from "@/app/actions/provider";
import { Button } from "@/components/ui/button";

const initial: ActionState = { status: "idle" };

const field =
  "w-full rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-4 py-3 text-sm outline-none transition-colors focus-visible:border-lake-600";
const label =
  "flex flex-col gap-1.5 text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]";

export function ProviderProfileForm({
  provider,
}: {
  provider: {
    businessName: string;
    phone: string | null;
    about: string | null;
    kraPin: string | null;
    licenceNumber: string | null;
  };
}) {
  const [state, action, pending] = useActionState(updateProviderProfile, initial);

  return (
    <form
      action={action}
      className="space-y-5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6"
    >
      {state.status === "error" && state.message ? (
        <p role="alert" className="flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-red-200 bg-red-50 p-3.5 text-2xs text-red-900">
          <AlertTriangle className="mt-px size-4 shrink-0" />
          {state.message}
        </p>
      ) : null}
      {state.status === "ok" && state.message ? (
        <p role="status" className="flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-forest-300 bg-forest-100 p-3.5 text-2xs text-forest-900">
          <CheckCircle2 className="mt-px size-4 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <label className={label}>
        Business name
        <input name="businessName" required defaultValue={provider.businessName} className={field} />
      </label>

      <label className={label}>
        Phone
        <input name="phone" type="tel" defaultValue={provider.phone ?? ""} placeholder="+250…" className={field} />
      </label>

      <label className={label}>
        About
        <textarea name="about" rows={5} defaultValue={provider.about ?? ""} className={`${field} resize-y leading-relaxed`} placeholder="What you operate, where, and what makes you worth booking." />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          KRA PIN
          <input name="kraPin" defaultValue={provider.kraPin ?? ""} className={field} />
        </label>
        <label className={label}>
          Licence number
          <input name="licenceNumber" defaultValue={provider.licenceNumber ?? ""} className={field} />
        </label>
      </div>

      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
