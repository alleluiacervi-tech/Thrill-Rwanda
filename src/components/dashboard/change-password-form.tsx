"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { changePassword } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

// Matches minPasswordLength in src/lib/auth.ts; the server enforces it regardless.
const MIN_LENGTH = 10;

const field =
  "w-full rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-4 py-3 text-sm text-[var(--ink)] outline-none transition-colors focus-visible:border-lake-600";
const label =
  "flex flex-col gap-1.5 text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]";

type Status = { kind: "idle" } | { kind: "error"; message: string } | { kind: "done"; signedOutOthers: boolean };

// Runs in the browser through the auth client, so the refreshed session cookie is set on this response
// and only the other devices are signed out, never this one. No email involved.
export function ChangePasswordForm() {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const [pending, setPending] = React.useState(false);
  const [show, setShow] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const current = String(data.get("currentPassword") ?? "");
    const next = String(data.get("newPassword") ?? "");
    const confirm = String(data.get("confirmPassword") ?? "");
    const revokeOtherSessions = data.get("revokeOthers") === "on";

    if (next.length < MIN_LENGTH) return setStatus({ kind: "error", message: `The new password needs at least ${MIN_LENGTH} characters.` });
    if (next !== confirm) return setStatus({ kind: "error", message: "The two new passwords don't match." });
    if (next === current) return setStatus({ kind: "error", message: "Choose a password different from the current one." });

    setPending(true);
    const { error } = await changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions });
    setPending(false);

    if (error) {
      // 401 means the session is gone, not a wrong password; the library reports that as INVALID_PASSWORD.
      const message =
        error.status === 401
          ? "Your session has expired. Sign in again, then change your password."
          : error.code === "INVALID_PASSWORD"
            ? "Your current password is incorrect."
            : error.message || "We couldn't change your password. Please try again.";
      return setStatus({ kind: "error", message });
    }

    formRef.current?.reset();
    setStatus({ kind: "done", signedOutOthers: revokeOtherSessions });
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="space-y-5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6"
    >
      <div>
        <h2 className="text-lg">Change password</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">You need your current password. No email is sent.</p>
      </div>

      {status.kind === "error" ? (
        <p role="alert" className="flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-red-200 bg-red-50 p-3.5 text-2xs text-red-900">
          <AlertTriangle className="mt-px size-4 shrink-0" />
          <span>{status.message}</span>
        </p>
      ) : null}
      {status.kind === "done" ? (
        <p role="status" className="flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-forest-300 bg-forest-100 p-3.5 text-2xs text-forest-900">
          <CheckCircle2 className="mt-px size-4 shrink-0" />
          <span>
            Password changed.{" "}
            {status.signedOutOthers
              ? "Every other device has been signed out. You stay signed in here."
              : "Other devices stay signed in."}
          </span>
        </p>
      ) : null}

      <label className={label}>
        Current password
        <input name="currentPassword" type={show ? "text" : "password"} required autoComplete="current-password" className={field} />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={label}>
          New password
          <input
            name="newPassword"
            type={show ? "text" : "password"}
            required
            minLength={MIN_LENGTH}
            autoComplete="new-password"
            className={field}
          />
          <span className="font-normal normal-case tracking-normal text-[var(--ink-faint)]">At least {MIN_LENGTH} characters.</span>
        </label>
        <label className={label}>
          Repeat new password
          <input
            name="confirmPassword"
            type={show ? "text" : "password"}
            required
            minLength={MIN_LENGTH}
            autoComplete="new-password"
            className={field}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="revokeOthers" defaultChecked className="size-4.5 rounded-[0.3rem] accent-forest-800" />
          Sign out of all other devices
        </label>
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="inline-flex items-center gap-1.5 text-2xs text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {show ? "Hide passwords" : "Show passwords"}
        </button>
      </div>

      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}
