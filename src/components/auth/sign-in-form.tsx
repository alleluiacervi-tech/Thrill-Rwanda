"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Smartphone } from "lucide-react";
import { Field, FormError, PasswordField } from "@/components/auth/auth-fields";
import { Button } from "@/components/ui/button";
import { signIn, twoFactor } from "@/lib/auth-client";
import { homeForRole } from "@/lib/session-routes";
import { postSignInPath } from "@/app/actions/account";

/**
 * Sign in, in one or two steps.
 *
 * Step one is the email and password. An account with two-step sign-in on
 * (required for administrators and staff) then asks for the six-digit code
 * from its authenticator app, or a backup code, unless this device was
 * trusted within the last 30 days.
 */
export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  // `reset` arrives from reset-password after a password change.
  const justReset = params.get("reset") === "1";

  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [step, setStep] = React.useState<"password" | "code">("password");
  const [useBackup, setUseBackup] = React.useState(false);
  const role = React.useRef<string | undefined>(undefined);

  async function land() {
    // `next` wins when it is a relative path: where they were headed before the guard bounced them.
    const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : null;
    // Provider applicants are still customers by role, so the server picks their landing page.
    const home = await postSignInPath().catch(() => homeForRole(role.current));
    router.push(safeNext ?? home);
    router.refresh();
  }

  async function onPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const data = new FormData(e.currentTarget);
    const result = await signIn.email({
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
      rememberMe: data.get("remember") === "on",
    }).catch(() => null);
    if (!result) {
      setError("Could not reach sign-in. Check your connection and try again.");
      setPending(false);
      return;
    }
    const { data: signedIn, error } = result;

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

    if (signedIn && "twoFactorRedirect" in signedIn && signedIn.twoFactorRedirect) {
      setStep("code");
      setPending(false);
      return;
    }

    role.current = signedIn && "user" in signedIn ? (signedIn.user as { role?: string }).role : undefined;
    await land();
  }

  async function onCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const data = new FormData(e.currentTarget);
    const code = String(data.get("code") ?? "").replace(/\s+/g, "");
    const trustDevice = data.get("trust") === "on";
    const result = await (useBackup
      ? twoFactor.verifyBackupCode({ code, trustDevice })
      : twoFactor.verifyTotp({ code, trustDevice })).catch(() => null);
    if (!result) {
      setError("Could not verify the code. Check your connection and try again.");
      setPending(false);
      return;
    }
    const { error } = result;

    if (error) {
      setError(
        error.status === 401 && /expired|invalid two factor cookie/i.test(error.message ?? "")
          ? "That sign-in took too long. Enter your password again."
          : useBackup
            ? "That backup code didn't work. Each code works once; check it and try again."
            : "That code didn't match. Use the current six-digit code from your authenticator app.",
      );
      if (/expired|cookie/i.test(error.message ?? "")) setStep("password");
      setPending(false);
      return;
    }
    await land();
  }

  if (step === "code") {
    return (
      <form onSubmit={onCode} className="space-y-5" noValidate>
        <div className="flex items-start gap-3 rounded-[var(--radius-inset)] border border-[var(--line)] bg-bone-100 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-forest-800 text-sun-400">
            <Smartphone className="size-5" aria-hidden />
          </span>
          <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
            {useBackup
              ? "Enter one of the backup codes you saved when you set up two-step sign-in. Each code works once."
              : "Open your authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) and enter the six-digit code for Thrill Rwanda."}
          </p>
        </div>

        <FormError message={error} />

        <Field
          key={useBackup ? "backup" : "totp"}
          label={useBackup ? "Backup code" : "Six-digit code"}
          name="code"
          required
          autoFocus
          autoComplete="one-time-code"
          inputMode={useBackup ? "text" : "numeric"}
          pattern={useBackup ? undefined : "[0-9 ]*"}
          maxLength={useBackup ? 24 : 7}
          placeholder={useBackup ? "xxxxx-xxxxx" : "123 456"}
          className="tnum tracking-[0.3em]"
        />

        <label className="flex items-start gap-2.5 text-sm text-[var(--ink-muted)]">
          <input type="checkbox" name="trust" className="mt-0.5 size-4 accent-forest-800" />
          <span>
            Trust this device for 30 days
            <span className="block text-xs text-[var(--ink-faint)]">
              Only on a device that is yours. Others always ask for a code.
            </span>
          </span>
        </label>

        <Button type="submit" variant="accent" size="lg" className="w-full" disabled={pending}>
          {pending ? "Checking…" : "Verify and sign in"}
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <button
            type="button"
            onClick={() => {
              setUseBackup((b) => !b);
              setError(null);
            }}
            className="link-draw min-h-10 text-lake-700"
          >
            {useBackup ? "Use the authenticator app instead" : "Use a backup code"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("password");
              setError(null);
            }}
            className="min-h-10 text-[var(--ink-muted)] underline-offset-4 hover:underline"
          >
            Back
          </button>
        </div>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--ink-faint)]">
          <ShieldCheck className="mt-px size-4 shrink-0 text-forest-700" aria-hidden />
          Lost your phone and your backup codes? Ask a super admin to reset two-step sign-in for your account.
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={onPassword} className="space-y-5">
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
