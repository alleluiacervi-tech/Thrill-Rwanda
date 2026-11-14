"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormError, PasswordField } from "@/components/auth/auth-fields";
import { Button } from "@/components/ui/button";
import { resetPassword } from "@/lib/auth-client";

const MIN_PASSWORD = 10;

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [pending, setPending] = React.useState(false);

  // A missing token means the link was truncated or hand-typed. Say so
  // rather than showing a form that cannot possibly succeed.
  if (!token) {
    return (
      <div className="space-y-5">
        <FormError message="This reset link is incomplete or has expired. Request a new one." />
        <Button href="/forgot-password" variant="accent" size="lg" className="w-full">
          Request a new link
        </Button>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const data = new FormData(e.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");

    const errs: Record<string, string> = {};
    if (password.length < MIN_PASSWORD)
      errs.password = `Use at least ${MIN_PASSWORD} characters.`;
    if (password !== confirm) errs.confirm = "Passwords don't match.";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }

    setPending(true);
    const { error } = await resetPassword({ newPassword: password, token: token! });

    if (error) {
      setError(
        "That link has expired or has already been used. Request a new one.",
      );
      setPending(false);
      return;
    }

    router.push("/sign-in?reset=1");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormError message={error} />

      <PasswordField
        label="New password"
        name="password"
        required
        autoFocus
        autoComplete="new-password"
        error={fieldErrors.password}
        hint={`At least ${MIN_PASSWORD} characters.`}
      />

      <PasswordField
        label="Confirm new password"
        name="confirm"
        required
        autoComplete="new-password"
        error={fieldErrors.confirm}
      />

      <Button
        type="submit"
        variant="accent"
        size="lg"
        className="w-full"
        disabled={pending}
      >
        {pending ? "Saving…" : "Save new password"}
      </Button>

      <p className="text-center text-2xs text-[var(--ink-faint)]">
        Changed your mind?{" "}
        <Link href="/sign-in" className="link-draw">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
