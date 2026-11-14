"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, UserRound } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
  return letters.toUpperCase() || "?";
}

// A disclosure, not role="menu": two links need no arrow-key roving, and Tab
// order through them is what a keyboard user expects.
export function ProfileMenu({
  name,
  role,
  profileHref,
}: {
  name: string;
  role: string;
  /** The signed-in user's own profile page. */
  profileHref?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const panelId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const rowCls =
    "flex w-full items-center gap-3 px-3 py-2 text-sm text-[var(--ink-muted)] transition-colors hover:bg-[var(--paper-sunken)] hover:text-[var(--ink)]";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-[var(--paper-sunken)]"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-forest-800 text-2xs font-semibold text-bone-50">
          {initials(name)}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-40 truncate text-sm leading-tight text-[var(--ink)]">{name}</span>
          <span className="block text-[0.625rem] uppercase leading-tight tracking-[0.16em] text-[var(--ink-faint)]">
            {role}
          </span>
        </span>
        <ChevronDown
          className={cn("size-4 text-[var(--ink-faint)] transition-transform", open && "rotate-180")}
        />
        <span className="sr-only">Account menu</span>
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-[var(--radius-inset)] border border-[var(--line)] bg-[var(--paper-raised)] py-1 shadow-lg shadow-black/5"
        >
          <div className="border-b border-[var(--line)] px-3 py-2.5">
            <p className="truncate text-sm text-[var(--ink)]">{name}</p>
            <p className="text-[0.625rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">{role}</p>
          </div>

          {profileHref ? (
            <Link href={profileHref} onClick={() => setOpen(false)} className={rowCls}>
              <UserRound className="size-4" />
              My profile
            </Link>
          ) : null}

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className={rowCls}
          >
            <ExternalLink className="size-4" />
            View website
          </a>

          <SignOutButton
            alwaysLabel
            className={cn(rowCls, "justify-start rounded-none border-0 hover:border-0")}
          />
        </div>
      ) : null}
    </div>
  );
}
