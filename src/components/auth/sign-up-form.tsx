"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field, FormError, PasswordField } from "@/components/auth/auth-fields";
import { Button } from "@/components/ui/button";
import { signUp } from "@/lib/auth-client";

const MIN_PASSWORD = 10;

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string>
  >({});
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const data = new FormData(e.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");

    // Client-side checks are for speed of feedback only — Better Auth
    // enforces the real minimum server-side.
    const errs: Record<string, string> = {};
    if (password.length < MIN_PASSWORD) {
      errs.password = `Use at least ${MIN_PASSWORD} characters.`;
    }
    if (password !== confirm) {
      errs.confirm = "Passwords don't match.";
    }
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }

    setPending(true);

    // NOTE: `role` is intentionally not sent. It is declared `input: false`
    // in src/lib/auth.ts, so the server would reject it anyway — everyone
    // who signs up here becomes a CUSTOMER.
    const { error } = await signUp.email({
      email: String(data.get("email") ?? ""),
      password,
      name: String(data.get("fullName") ?? ""),
      phone: String(data.get("phone") ?? ""),
    });

    if (error) {
      setError(
        error.status === 422 || error.message?.toLowerCase().includes("exist")
          ? "An account with that email already exists. Try signing in instead."
          : "We couldn't create that account. Please check your details and try again.",
      );
      setPending(false);
      return;
    }

    // Better Auth signs the new user in as part of sign-up, so sending
    // them to /sign-in would just bounce off redirectIfAuthenticated.
    router.push("/account");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormError message={error} />

      <Field
        label="Full name"
        name="fullName"
        required
        autoComplete="name"
        autoFocus
        placeholder="Wanjiru Kamau"
      />

      <Field
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
      />

      <Field
        label="Phone / WhatsApp"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="+250…"
        hint="Optional, but it's how a driver reaches you on the day."
      />

      <PasswordField
        label="Password"
        name="password"
        required
        autoComplete="new-password"
        error={fieldErrors.password}
        hint={`At least ${MIN_PASSWORD} characters.`}
      />

      <PasswordField
        label="Confirm password"
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
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-2xs leading-relaxed text-[var(--ink-faint)]">
        By creating an account you agree to our{" "}
        <Link href="/legal/terms" className="link-draw">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="link-draw">
          Privacy Policy
        </Link>
        .
      </p>

      <p className="border-t border-[var(--line)] pt-5 text-2xs leading-relaxed text-[var(--ink-faint)]">
        Running a lodge, camp or fleet?{" "}
        <Link href="/partner" className="link-draw text-clay-700">
          Apply as a provider
        </Link>{" "}
        — provider accounts are verified by our team before going live.
      </p>
    </form>
  );
}
