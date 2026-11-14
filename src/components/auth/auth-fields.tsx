"use client";

import * as React from "react";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export const fieldCls =
  "w-full rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-4 py-3 text-sm outline-none transition-colors focus-visible:border-lake-600 disabled:opacity-50";

export function Field({
  label,
  name,
  type = "text",
  error,
  hint,
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className={cn(fieldCls, error && "border-red-400")}
        {...rest}
      />
      {hint && !error ? (
        <span id={`${id}-hint`} className="text-2xs text-[var(--ink-faint)]">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-err`} className="text-2xs font-medium text-red-700">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Password input with a show/hide toggle — reduces sign-in failures. */
export function PasswordField({
  label,
  name,
  error,
  hint,
  ...rest
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = React.useState(false);
  const id = React.useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${id}-err` : hint ? `${id}-hint` : undefined
          }
          className={cn(fieldCls, "pr-12", error && "border-red-400")}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] hover:text-[var(--ink)]"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {hint && !error ? (
        <span id={`${id}-hint`} className="text-2xs text-[var(--ink-faint)]">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-err`} className="text-2xs font-medium text-red-700">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-3 rounded-[var(--radius-inset)] border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-900"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
