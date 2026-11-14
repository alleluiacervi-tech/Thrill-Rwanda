import Link from "next/link";
import { cn } from "@/lib/utils";

export type Workspace = { label: string; href: string; current?: boolean };

/**
 * Moves between the spaces one person can hold: a provider is also a
 * customer, and an admin may be both. Without this, switching meant signing
 * out and back in.
 *
 * Links, not a dropdown: with two or three options the whole set fits, and a
 * visible current state answers "where am I?" at a glance.
 */
export function WorkspaceSwitch({
  workspaces,
  className,
}: {
  workspaces: Workspace[];
  className?: string;
}) {
  // One workspace is not a choice.
  if (workspaces.length < 2) return null;

  return (
    <nav
      aria-label="Switch dashboard"
      className={cn(
        "flex items-center gap-0.5 rounded-full border border-[var(--line-strong)] bg-[var(--paper)] p-0.5",
        className,
      )}
    >
      {workspaces.map((w) => (
        <Link
          key={w.href}
          href={w.href}
          aria-current={w.current ? "page" : undefined}
          className={cn(
            "rounded-full px-3 py-1 text-2xs font-semibold transition-colors",
            w.current
              ? "bg-forest-800 text-bone-50"
              : "text-[var(--ink-muted)] hover:bg-[var(--paper-sunken)] hover:text-[var(--ink)]",
          )}
        >
          {w.label}
        </Link>
      ))}
    </nav>
  );
}
