"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { Field, FormError } from "@/components/auth/auth-fields";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/lib/auth-client";
import { useSite } from "@/components/layout/site-context";

export function ForgotPasswordForm() {
  const site = useSite();
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const data = new FormData(e.currentTarget);
    const { error } = await requestPasswordReset({
      email: String(data.get("email") ?? ""),
      redirectTo: "/reset-password",
    });

    setPending(false);

    if (error) {
      setError(
        `We couldn't start a reset just now. Please call or WhatsApp ${site.contact.phone} and we'll help.`,
      );
      return;
    }

    // Always the same confirmation, whether or not the address is
    // registered — otherwise this form becomes an account-enumeration oracle.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-[var(--radius-card)] border border-forest-300 bg-forest-100 p-7 text-center">
        <CheckCircle2 className="mx-auto size-9 text-forest-600" />
        <h2 className="mt-4 text-xl text-forest-900">Check your email</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-forest-800/80">
          If an account exists for that address, a reset link is on its way. It
          expires in one hour.
        </p>
        <p className="mt-4 text-2xs text-forest-800/60">
          Nothing after a few minutes? Check spam, or contact us on{" "}
          {site.contact.phone}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormError message={error} />
      <Field
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
        autoFocus
        placeholder="you@example.com"
      />
      <Button
        type="submit"
        variant="accent"
        size="lg"
        className="w-full"
        disabled={pending}
      >
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
