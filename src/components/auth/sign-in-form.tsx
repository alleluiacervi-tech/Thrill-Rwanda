"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Field, FormError, PasswordField } from "@/components/auth/auth-fields";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";
import { homeForRole } from "@/lib/session-routes";
import { postSignInPath } from "@/app/actions/account";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  // Sign-up now signs people straight in, so `registered` never appears.
  // `reset` does — reset-password sends them here after a password change.
  const justReset = params.get("reset") === "1";

  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const data = new FormData(e.currentTarget);
    const { data: signedIn, error } = await signIn.email({
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
      rememberMe: data.get("remember") === "on",
    });

    if (error) {
      // Deliberately generic: distinguishing "no such user" from "wrong
      // password" tells an attacker which emails are registered.
      setError(
        error.status === 403
          ? "That account is not active. Contact us and we'll sort it."
          : "Those details don't match an account. Check the email and password and try again.",
      );
      setPending(false);
      return;
    }

    // `next` wins when it is a relative path — it is where they were headed
    // before the guard bounced them. Otherwise land on their own dashboard.
    const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : null;
    // Provider applicants are still customers by role, so the server picks their landing page.
    const home = await postSignInPath().catch(() => homeForRole(signedIn?.user?.role));
    router.push(safeNext ?? home);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {justReset && (
        <p
          role="status"
          className="rounded-[var(--radius-inset)] border border-forest-300 bg-forest-100 p-4 text-sm leading-relaxed text-forest-900"
        >
          Password updated. Sign in with your new password.
        </p>
      )}

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

      <PasswordField
        label="Password"
        name="password"
        required
        autoComplete="current-password"
      />

      <div className="flex items-center justify-between gap-4">
        <label className="flex items-center gap-2.5 text-sm text-[var(--ink-muted)]">
          <input
            type="checkbox"
            name="remember"
            defaultChecked
            className="size-4 accent-forest-800"
          />
          Keep me signed in
        </label>
        <Link
          href="/forgot-password"
          className="link-draw text-sm text-lake-700"
        >
          Forgot password?
        </Link>
      </div>

      <Button
        type="submit"
        variant="accent"
        size="lg"
        className="w-full"
        disabled={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
