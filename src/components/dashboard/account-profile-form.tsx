"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { updateAccountProfile, type AccountState } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth-client";

const initial: AccountState = { status: "idle" };

const field =
  "w-full rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-4 py-3 text-sm outline-none transition-colors focus-visible:border-ember-500";
const label =
  "flex flex-col gap-1.5 text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]";

export function AccountProfileForm({
  user,
  phoneHint = "How a driver or guide reaches you on the day.",
}: {
  user: { fullName: string; phone: string | null };
  phoneHint?: string;
}) {
  const [state, action, pending] = useActionState(updateAccountProfile, initial);
  const router = useRouter();

  // The login cookie caches the name for a few minutes; re-read it so the header shows the new one now.
  React.useEffect(() => {
    if (state.status !== "ok") return;
    void getSession({ query: { disableCookieCache: true } }).then(() => router.refresh());
  }, [state, router]);

  return (
    <form action={action} className="space-y-5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6">
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
        Full name
        <input name="fullName" required defaultValue={user.fullName} autoComplete="name" className={field} />
      </label>

      <label className={label}>
        Phone / WhatsApp
        <input name="phone" type="tel" defaultValue={user.phone ?? ""} placeholder="+250…" autoComplete="tel" className={field} />
        <span className="font-normal normal-case tracking-normal text-[var(--ink-faint)]">
          {phoneHint}
        </span>
      </label>

      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
