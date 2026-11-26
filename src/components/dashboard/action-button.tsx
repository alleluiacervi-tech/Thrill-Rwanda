"use client";
import { useFlashAction } from "@/components/dashboard/flash";

import * as React from "react";
import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type State = { status: "idle" | "error" | "ok"; message?: string };
const initial: State = { status: "idle" };

/**
 * A one-shot server-action button carrying hidden fields.
 *
 * Wraps each action in its own <form> so several can sit in one table row
 * without their fields colliding, and surfaces the action's error inline
 * rather than throwing the row away.
 */
export function ActionButton({
  action,
  fields,
  children,
  variant = "quiet",
  size = "sm",
  confirm,
  className,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  fields: Record<string, string>;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  /** When set, the first click asks for confirmation before submitting. */
  confirm?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(useFlashAction(action), initial);
  const [armed, setArmed] = React.useState(false);

  return (
    <form action={formAction} className={cn("inline-flex flex-col gap-1", className)}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {confirm && !armed ? (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className={cn(buttonVariants({ variant, size }))}
        >
          {children}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <Button type="submit" variant={variant} size={size} disabled={pending}>
            {pending ? "Working…" : confirm ? confirm : children}
          </Button>
          {confirm && armed ? (
            <button
              type="button"
              onClick={() => setArmed(false)}
              className="text-2xs text-[var(--ink-faint)] underline underline-offset-2"
            >
              cancel
            </button>
          ) : null}
        </span>
      )}

      {state.status === "error" && state.message ? (
        <span
          role="alert"
          className="inline-flex items-start gap-1 text-2xs font-medium text-red-700"
        >
          <AlertTriangle className="mt-px size-3 shrink-0" />
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
