"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { createProviderForUser, type AdminState } from "@/app/actions/admin";
import { Labelled, fieldCls } from "@/components/dashboard/listing-fields";
import { Button } from "@/components/ui/button";

const initial: AdminState = { status: "idle" };

/**
 * Turns a customer into a provider.
 *
 * The role alone isn't enough — a PROVIDER with no provider record lands on
 * the application page with nothing to do — so this collects the business
 * details and creates both together.
 */
export function MakeProviderForm({
  userId,
  userName,
  defaultName,
  defaultPhone,
}: {
  userId: string;
  userName: string;
  defaultName: string;
  defaultPhone: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createProviderForUser, initial);

  if (state.status === "ok") {
    return (
      <div className="mx-auto max-w-2xl rounded-[var(--radius-card)] border border-forest-300 bg-forest-100 p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-forest-600" />
        <h2 className="mt-5 text-2xl text-forest-900">{userName} is now a provider</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-forest-800/80">{state.message}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button href="/admin/providers" variant="primary">
            Open providers
          </Button>
          <Button href="/admin/users" variant="outline">
            Back to users
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="mx-auto max-w-2xl space-y-6 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-7">
      <input type="hidden" name="userId" value={userId} />

      {state.status === "error" && state.message ? (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-red-200 bg-red-50 p-3.5 text-sm text-red-900"
        >
          <AlertTriangle className="mt-px size-4 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <Labelled label="Business name">
        <input name="businessName" defaultValue={defaultName} required maxLength={160} className={fieldCls} />
      </Labelled>

      <Labelled label="What they offer" hint="Decides which listings they can add.">
        <select name="kind" defaultValue="TOUR" className={fieldCls}>
          <option value="TOUR">Tours &amp; safaris</option>
          <option value="HOTEL">Hotel or property</option>
          <option value="CAR">Vehicles</option>
        </select>
      </Labelled>

      <div className="grid gap-5 sm:grid-cols-2">
        <Labelled label="City">
          <input name="city" maxLength={80} placeholder="Kigali" className={fieldCls} />
        </Labelled>
        <Labelled label="Phone" hint="Defaults to the phone on their account.">
          <input name="phone" defaultValue={defaultPhone} maxLength={40} className={fieldCls} />
        </Labelled>
      </div>

      <label className="flex items-start gap-3 rounded-[var(--radius-inset)] border border-[var(--line)] bg-[var(--paper-sunken)] p-4 text-sm">
        <input type="checkbox" name="verify" value="true" defaultChecked className="mt-0.5 size-4 shrink-0 accent-forest-800" />
        <span>
          <span className="block font-medium text-[var(--ink)]">Verify straight away</span>
          <span className="mt-0.5 block text-2xs leading-relaxed text-[var(--ink-muted)]">
            Their listings can go live as soon as they publish them. Untick to leave the application
            pending, as if they had applied themselves.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-5">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Creating…" : "Create provider"}
        </Button>
        <Button type="button" variant="quiet" onClick={() => router.push("/admin/users")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
