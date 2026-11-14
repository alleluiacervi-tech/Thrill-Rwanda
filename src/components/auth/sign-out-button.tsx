"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function SignOutButton({
  className,
  // The top bar hides the label on small screens to save room. In the sidebar
  // there is room, and an unlabelled icon in a list of labelled rows is worse.
  alwaysLabel = false,
}: {
  className?: string;
  alwaysLabel?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await signOut();
        router.push("/");
        router.refresh();
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] px-4 py-2 text-sm transition-colors hover:border-forest-800 hover:bg-forest-800 hover:text-bone-50 disabled:opacity-50",
        className,
      )}
    >
      <LogOut className="size-4" />
      <span className={alwaysLabel ? "inline" : "hidden sm:inline"}>
        {pending ? "Signing out…" : "Sign out"}
      </span>
    </button>
  );
}
