"use client";

import Image from "next/image";
import { useSite } from "@/components/layout/site-context";
import { cn } from "@/lib/utils";

/**
 * The Thrill Rwanda logo, drawn from the supplied artwork: the emblem with
 * the "THRILL RWANDA" wordmark cropped out of the same file and set to its
 * right. Size it with a height class; the width follows.
 *
 *  - default: emblem + wordmark, side by side.
 *  - `compact`: the emblem only, for tight spots like the admin rail.
 *  - `tone="dark"`: the same artwork with the black wordmark and gorilla
 *    switched to white/bone and the blue and green lifted, for dark surfaces.
 */
export function Logo({
  className,
  compact = false,
  tone = "light",
}: {
  className?: string;
  /** Emblem only, no wordmark. */
  compact?: boolean;
  /** The surface behind it. */
  tone?: "light" | "dark";
}) {
  const site = useSite();
  const dark = tone === "dark";
  const src = compact
    ? dark
      ? "/thrill-rwanda-mark-light.svg"
      : "/thrill-rwanda-mark.svg"
    : dark
      ? "/thrill-rwanda-horizontal-light.svg"
      : "/thrill-rwanda-horizontal.svg";
  return (
    <Image
      src={src}
      alt={site.name}
      width={compact ? 1134 : 2862}
      height={830}
      priority
      unoptimized
      className={cn("h-11 w-auto shrink-0 lg:h-12", className)}
    />
  );
}
