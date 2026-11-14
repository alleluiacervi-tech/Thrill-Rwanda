"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Phone, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { useSession } from "@/lib/auth-client";
import { homeForRole } from "@/lib/session-routes";
import { useSite } from "@/components/layout/site-context";
import { primaryNav } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Transparent over the hero, then solidifies on scroll. `overHero` is set by
 * pages whose first section is a full-bleed dark image.
 */
export function SiteHeader({ overHero = false }: { overHero?: boolean }) {
  const site = useSite();
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const { data: session, isPending } = useSession();

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock background scroll while the mobile sheet is open. (The sheet closes
  // via each link's onClick rather than by reacting to a pathname change —
  // setState in an effect body causes a cascading render.)
  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const floating = overHero && !scrolled;

  return (
    <>
      {/* Utility strip — preview status + provider entry, hidden on mobile */}
      <div className="hidden bg-forest-950 py-2 text-bone-100 lg:block">
        <Container wide className="flex items-center justify-between">
          <p className="text-2xs tracking-wide text-forest-200">
            Rwanda travel demo · Sample listings · Configuration in progress
          </p>
          <div className="flex items-center gap-6 text-2xs">
            {site.contact.phone && site.contact.phoneHref ? (
              <a
                href={site.contact.phoneHref}
                className="link-draw inline-flex items-center gap-1.5 hover:text-sun-400"
              >
                <Phone className="size-3" />
                {site.contact.phone}
              </a>
            ) : null}
            <Link href="/partner" className="link-draw hover:text-sun-400">
              List your property or fleet
            </Link>
          </div>
        </Container>
      </div>

      <header
        className={cn(
          "sticky top-0 z-50 transition-all duration-500 [transition-timing-function:var(--ease-out-expo)]",
          floating
            ? "on-dark bg-transparent"
            : "border-b border-[var(--line)] bg-[color-mix(in_oklab,white_86%,transparent)] shadow-[0_1px_0_rgb(20_24_22/0.02),0_8px_24px_-18px_rgb(20_24_22/0.25)] backdrop-blur-xl backdrop-saturate-150",
        )}
      >
        <Container wide>
          {/* Height is load-bearing: every overHero page cancels it with
              `-mt-[4.5rem] lg:-mt-24`. Change one side, change both. */}
          <div
            className={cn(
              "flex items-center justify-between transition-all duration-500",
              floating ? "h-[4.5rem] lg:h-24" : "h-[4.5rem]",
            )}
          >
            <Link
              href="/"
              aria-label={`${site.name} home`}
              className={cn(
                "transition-colors",
                floating ? "text-bone-50" : "text-forest-800",
              )}
            >
              <Logo tone={floating ? "dark" : "light"} className="h-9 lg:h-11" />
            </Link>

            <nav
              aria-label="Primary"
              className="hidden items-center gap-1 lg:flex"
            >
              {primaryNav.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-300 xl:px-4",
                      floating
                        ? "text-white/80 hover:bg-white/10 hover:text-white"
                        : "text-bone-700 hover:bg-bone-100 hover:text-forest-900",
                      active && (floating ? "bg-white/12 text-white" : "bg-forest-100 text-forest-800"),
                    )}
                  >
                    {item.label}
                    {active && (
                      <span aria-hidden className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-sun-500" />
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              {/* `isPending` keeps the button from flickering between the
                  signed-out and signed-in label on first paint. */}
              <Button
                href={session ? homeForRole(session.user.role) : "/sign-in"}
                variant={floating ? "outline" : "ghost"}
                size="sm"
                className={cn(
                  "hidden sm:inline-flex",
                  isPending && "pointer-events-none opacity-0",
                  floating &&
                    "border-bone-100/30 text-bone-50 hover:bg-bone-50 hover:text-forest-900",
                )}
              >
                <UserRound className="size-4" />
                {session
                  ? (session.user.name?.split(" ")[0] ?? "Account")
                  : "Sign in"}
              </Button>
              <Button href="/tours" variant="accent" size="sm" className="font-semibold">
                Book now
              </Button>
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
                className={cn(
                  "-mr-1 grid size-10 place-items-center rounded-full transition-colors lg:hidden",
                  floating ? "text-bone-50" : "text-forest-800",
                )}
              >
                <Menu className="size-5" />
              </button>
            </div>
          </div>
        </Container>
      </header>

      {/* Mobile sheet */}
      <div
        className={cn(
          "on-dark fixed inset-0 z-[70] bg-forest-950 transition-[opacity,visibility] duration-400 lg:hidden",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
        aria-hidden={!open}
      >
        <div className="contours absolute inset-0 opacity-[0.07]" />
        <div className="relative flex h-full flex-col">
          <Container className="flex h-[4.5rem] shrink-0 items-center justify-between">
            <Logo tone="dark" className="h-10" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="grid size-10 place-items-center rounded-full text-bone-50"
            >
              <X className="size-5" />
            </button>
          </Container>

          <Container className="flex flex-1 flex-col justify-center gap-1 pb-16">
            {primaryNav.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                style={{ animationDelay: `${80 + i * 55}ms` }}
                className={cn(
                  "flex items-center justify-between border-b border-white/10 py-4 font-display text-[2rem] leading-tight text-bone-50",
                  open && "anim-rise",
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-8 flex flex-col gap-3">
              <Button
                href={session ? homeForRole(session.user.role) : "/sign-in"}
                variant="outline"
                size="lg"
                onClick={() => setOpen(false)}
              >
                {session ? "My account" : "Sign in"}
              </Button>
              {site.contact.whatsapp ? (
                <a
                  href={site.contact.whatsapp}
                  className="text-center text-sm text-forest-200"
                >
                  Or chat with us on WhatsApp
                  {site.contact.phone ? ` · ${site.contact.phone}` : ""}
                </a>
              ) : null}
            </div>
          </Container>
        </div>
      </div>
    </>
  );
}
