import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-medium transition-all duration-300",
    "[transition-timing-function:var(--ease-out-expo)]",
    "disabled:pointer-events-none disabled:opacity-45",
    "active:translate-y-px",
  ],
  {
    variants: {
      variant: {
        /** Primary action. Forest ground, warm lift on hover. */
        primary:
          "bg-forest-800 text-bone-50 shadow-[0_1px_2px_rgb(7_28_21/0.2)] hover:bg-forest-700 hover:shadow-[0_10px_28px_-12px_rgb(15_61_46/0.55)]",
        /** Sun gold, from the logo. Use once per view, on the money action. */
        accent:
          "bg-sun-500 font-semibold text-forest-950 shadow-[0_1px_2px_rgb(92_67_10/0.25)] hover:bg-sun-300 hover:shadow-[0_12px_30px_-12px_rgb(217_163_0/0.75)]",
        outline:
          "border border-[var(--line-strong)] bg-transparent text-[var(--ink)] hover:border-forest-800 hover:bg-forest-800 hover:text-bone-50",
        ghost:
          "bg-transparent text-[var(--ink)] hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]",
        quiet:
          "bg-[var(--paper-raised)] text-[var(--ink)] border border-[var(--line)] hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-lift)]",
      },
      size: {
        sm: "h-9 rounded-full px-4 text-[0.8125rem]",
        md: "h-11 rounded-full px-6 text-sm",
        lg: "h-14 rounded-full px-8 text-base",
        icon: "size-11 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonBaseProps = VariantProps<typeof button> & { className?: string };

type ButtonProps = ButtonBaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type AnchorProps = ButtonBaseProps &
  Omit<React.ComponentPropsWithoutRef<typeof Link>, "href"> & { href: string };

export function Button(props: ButtonProps | AnchorProps) {
  const { className, variant, size, ...rest } = props;
  const classes = cn(button({ variant, size }), className);
  // A stable hook so the admin can shrink md/lg without touching call sites.
  const dataBtn = size ?? "md";

  if (typeof rest === "object" && "href" in rest && rest.href) {
    const { href, ...anchorRest } = rest as AnchorProps;
    return <Link href={href} data-btn={dataBtn} className={classes} {...anchorRest} />;
  }
  return <button data-btn={dataBtn} className={classes} {...(rest as ButtonProps)} />;
}

export { button as buttonVariants };
