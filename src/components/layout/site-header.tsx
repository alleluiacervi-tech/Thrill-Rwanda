"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ArrowUpRight, ChevronDown, MapPin, Menu, MessageCircle, UserRound, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { useSession } from "@/lib/auth-client";
import { homeForRole } from "@/lib/session-routes";
import { useSite } from "@/components/layout/site-context";
import { destinations } from "@/lib/content";
import { destinationImages } from "@/lib/images";
import { TEMBERA, collections, essentials, journeyImages } from "@/lib/journeys";
import { visiblePath, type Publications } from "@/lib/launch-rules";
import { primaryNav as allPrimaryNav } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * The site header.
 *
 *  - Over a hero (`overHero`) it starts transparent, then, once the page
 *    moves, gathers into a floating glass bar. Pages without a hero get the
 *    bar from the start.
 *  - Past the first screen it slides away while the visitor scrolls down to
 *    read and comes back the moment they scroll up, or tab into it.
 *  - On desktop one highlight glides to whichever link is under the pointer,
 *    and "Tours & Experiences" opens a panel: ways to travel, where to go,
 *    the Tembera u Rwanda editions and the travel essentials.
 *  - On phones the menu is a full-screen sheet: each section with a line of
 *    context, popular places, and the two actions people come for.
 */

/** Below this the header never hides: the hero and first section stay framed. */
const HIDE_AFTER_PX = 480;
/** Scroll this far in one direction before the header reacts, so a trembling thumb doesn't toggle it. */
const SCROLL_INTENT_PX = 8;

function useScrollState() {
  const [state, setState] = React.useState({ scrolled: false, hidden: false });
  React.useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const dy = y - lastY;
      const moved = Math.abs(dy) >= SCROLL_INTENT_PX;
      setState((s) => {
        const scrolled = y > 24;
        let hidden = s.hidden;
        if (y < HIDE_AFTER_PX) hidden = false;
        else if (moved) hidden = dy > 0;
        return s.scrolled === scrolled && s.hidden === hidden ? s : { scrolled, hidden };
      });
      if (moved || y < HIDE_AFTER_PX) lastY = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return state;
}

const toursFor = (name: string) => `/tours?destination=${encodeURIComponent(name)}`;

/** The item that opens the panel, and the section it stays lit for. */
const PANEL_HREF = "/experiences";
const isActive = (pathname: string, href: string) =>
  pathname.startsWith(href) || (href === PANEL_HREF && pathname.startsWith("/tours"));

export function SiteHeader({ overHero = false }: { overHero?: boolean }) {
  const site = useSite();
  const primaryNav = allPrimaryNav.filter(n => visiblePath(n.href, site.publications));
  const { scrolled, hidden } = useScrollState();
  const [open, setOpen] = React.useState(false);
  const [mega, setMega] = React.useState(false);
  const pathname = usePathname();
  const { data: session, isPending } = useSession();

  const floating = overHero && !scrolled;
  const accountHref = session ? homeForRole(session.user.role) : "/sign-in";
  const firstName = session?.user.name?.split(" ")[0];

  // Lock background scroll while the phone sheet is open. (The sheet closes
  // via each link's onClick rather than by reacting to a pathname change —
  // setState in an effect body causes a cascading render.)
  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  /* ----- the gliding highlight ----- */
  const navRef = React.useRef<HTMLElement>(null);
  const [glide, setGlide] = React.useState<{ left: number; width: number } | null>(null);
  const glideTo = (el: HTMLElement) => {
    const nav = navRef.current;
    if (!nav) return;
    const a = el.getBoundingClientRect();
    const b = nav.getBoundingClientRect();
    setGlide({ left: a.left - b.left, width: a.width });
  };

  /* ----- the destinations panel: opens on hover intent, survives the gap to the panel ----- */
  const megaTimer = React.useRef(0);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [megaLeft, setMegaLeft] = React.useState(0);
  const openMega = (delay = 90) => {
    window.clearTimeout(megaTimer.current);
    megaTimer.current = window.setTimeout(() => {
      // Centre the panel on the bar rather than on its own link, so it never runs off a narrow screen.
      const nav = navRef.current;
      const bar = nav?.parentElement;
      const panel = panelRef.current;
      if (nav && bar && panel) setMegaLeft((bar.clientWidth - panel.offsetWidth) / 2 - nav.offsetLeft);
      setMega(true);
    }, delay);
  };
  const closeMega = (delay = 160) => {
    window.clearTimeout(megaTimer.current);
    megaTimer.current = window.setTimeout(() => setMega(false), delay);
  };
  React.useEffect(() => {
    if (!mega) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMega(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mega]);
  React.useEffect(() => () => window.clearTimeout(megaTimer.current), []);

  const tucked = hidden && !open && !mega;
  // Stable, so the menu's focus handling doesn't re-run on every header render.
  const closeMenu = React.useCallback(() => setOpen(false), [setOpen]);

  return (
    <>
      {/* The flag as a ribbon, in place of a utility bar: the phone line lives
          in the menu and footer, the provider link in the footer. */}
      <div aria-hidden className="flag-ribbon relative z-[51]" />

      <header
        className={cn(
          // The closed menu panel still takes up layout (it fades in and out), so it must not widen the page.
          "overflow-x-clip",
          "sticky top-0 z-50 transition-transform duration-500 [transition-timing-function:var(--ease-out-expo)] focus-within:translate-y-0",
          tucked ? "-translate-y-[120%]" : "translate-y-0",
          floating && "on-dark",
        )}
      >
        <Container wide>
          {/* Height is load-bearing: every overHero page cancels it with
              `-mt-[4.5rem] lg:-mt-24`. Change one side, change both. The
              glass bar sits inside this height, so gathering never shifts the page. */}
          <div
            className={cn(
              "flex items-center transition-[height] duration-500",
              floating ? "h-[4.5rem] lg:h-24" : "h-[4.5rem]",
            )}
          >
            <div
              className={cn(
                "relative flex w-full items-center justify-between rounded-full transition-all duration-500 [transition-timing-function:var(--ease-out-expo)]",
                floating
                  ? "h-full border border-transparent"
                  : "-mx-2 h-14 border border-[color-mix(in_oklab,var(--line)_80%,transparent)] bg-[color-mix(in_oklab,white_82%,transparent)] pl-4 pr-2 shadow-[0_1px_0_rgb(255_255_255/0.6)_inset,0_18px_40px_-24px_rgb(15_58_44/0.45)] backdrop-blur-xl backdrop-saturate-150 sm:-mx-3 lg:pl-5",
              )}
            >
              <Link
                href="/"
                aria-label={`${site.name} home`}
                className={cn("shrink-0 transition-colors", floating ? "text-bone-50" : "text-forest-800")}
              >
                <Logo
                  tone={floating ? "dark" : "light"}
                  className={cn("transition-[height] duration-500", floating ? "h-9 lg:h-11" : "h-8 lg:h-9")}
                />
              </Link>

              {/* Desktop links, with one highlight that glides between them. */}
              <nav
                ref={navRef}
                aria-label="Primary"
                onPointerLeave={() => setGlide(null)}
                className="relative hidden items-center xl:flex"
              >
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute top-1/2 h-9 -translate-y-1/2 rounded-full transition-[left,width,opacity] duration-300 [transition-timing-function:var(--ease-out-expo)]",
                    floating ? "bg-white/12 ring-1 ring-white/15" : "bg-forest-100/80",
                  )}
                  style={{ left: glide?.left ?? 0, width: glide?.width ?? 0, opacity: glide ? 1 : 0 }}
                />
                {primaryNav.map((item) => {
                  const active = isActive(pathname, item.href);
                  const isTours = item.href === PANEL_HREF;
                  const link = (
                    <Link
                      href={item.href}
                      onPointerEnter={(e) => glideTo(e.currentTarget)}
                      onFocus={(e) => glideTo(e.currentTarget)}
                      onClick={() => setMega(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors duration-300 2xl:px-4",
                        floating ? "text-white/80 hover:text-white" : "text-bone-700 hover:text-forest-900",
                        active && (floating ? "text-white" : "text-forest-800"),
                        isTours && "pr-2.5 xl:pr-3",
                      )}
                    >
                      {item.label}
                      {isTours ? (
                        <ChevronDown
                          aria-hidden
                          className={cn("size-3.5 opacity-70 transition-transform duration-300", mega && "rotate-180")}
                        />
                      ) : null}
                      {active && (
                        <span aria-hidden className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-sun-500" />
                      )}
                    </Link>
                  );
                  if (!isTours) return <React.Fragment key={item.href}>{link}</React.Fragment>;
                  return (
                    <div
                      key={item.href}
                      onPointerEnter={() => openMega()}
                      onPointerLeave={() => closeMega()}
                      onFocus={() => openMega(0)}
                      onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) closeMega(0);
                      }}
                    >
                      {link}
                      <ExperiencesPanel
                        ref={panelRef}
                        left={megaLeft}
                        open={mega}
                        publications={site.publications}
                        onNavigate={() => setMega(false)}
                        onEnter={() => openMega(0)}
                      />
                    </div>
                  );
                })}
              </nav>

              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* `isPending` keeps the button from flickering between the
                    signed-out and signed-in label on first paint. */}
                <Link
                  href={accountHref}
                  className={cn(
                    "hidden h-9 items-center gap-2 rounded-full pl-1 pr-3.5 text-[0.8125rem] font-medium transition-colors duration-300 sm:inline-flex",
                    isPending && "pointer-events-none opacity-0",
                    floating ? "text-white/85 hover:bg-white/10 hover:text-white" : "text-bone-700 hover:bg-forest-100/70 hover:text-forest-900",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-7 place-items-center rounded-full text-[0.6875rem] font-semibold",
                      floating ? "bg-white/15 text-white ring-1 ring-white/25" : "bg-forest-800 text-bone-50",
                    )}
                  >
                    {firstName ? firstName[0]!.toUpperCase() : <UserRound className="size-3.5" />}
                  </span>
                  {session ? (firstName ?? "Account") : "Sign in"}
                </Link>
                <Button href={site.publications.FLIGHT !== "HIDDEN" ? "/flights" : "/enquire"} variant="accent" size="sm" className="group font-semibold">
                  {site.publications.FLIGHT !== "HIDDEN" ? "Flight quote" : "Enquire"}
                  <ArrowRight
                    aria-hidden
                    className="hidden size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 sm:block"
                  />
                </Button>
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  aria-label="Open menu"
                  aria-expanded={open}
                  aria-controls="site-menu"
                  className={cn(
                    "grid size-10 place-items-center rounded-full transition-colors xl:hidden",
                    floating ? "text-bone-50 hover:bg-white/10" : "text-forest-800 hover:bg-forest-100/70",
                  )}
                >
                  <Menu className="size-5" />
                </button>
              </div>
            </div>
          </div>
        </Container>
      </header>

      <PhoneMenu
        open={open}
        onClose={closeMenu}
        pathname={pathname}
        accountHref={accountHref}
        accountLabel={session ? "My account" : "Sign in"}
        whatsapp={site.contact.whatsapp}
        phone={site.contact.phone}
      />
    </>
  );
}

/* --------------------------------------------- Tours & Experiences panel */

const panelLabel = "px-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-bone-500";
const panelRow =
  "group flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-bone-100 focus-visible:bg-bone-100";

function PanelThumb({ src }: { src?: string }) {
  return (
    <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-bone-200">
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="44px"
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
      ) : null}
    </span>
  );
}

function PanelArrow() {
  return (
    <ArrowUpRight
      aria-hidden
      className="size-4 shrink-0 -translate-x-1 text-forest-700 opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:opacity-100"
    />
  );
}

function ExperiencesPanel({
  ref,
  left,
  open,
  publications,
  onNavigate,
  onEnter,
}: {
  ref: React.Ref<HTMLDivElement>;
  /** Offset from the nav's left edge that centres the panel on the bar. */
  left: number;
  open: boolean;
  publications: Publications;
  onNavigate: () => void;
  onEnter: () => void;
}) {
  const extras = essentials.filter((e) => publications[e.service] !== "HIDDEN");
  return (
    // The top padding bridges the gap from the link, so the pointer can travel into the panel.
    <div
      ref={ref}
      onPointerEnter={onEnter}
      style={{ left }}
      className={cn(
        "absolute top-full z-10 w-[min(60rem,calc(100vw-3rem))] pt-4 transition-[opacity,transform,visibility] duration-300 [transition-timing-function:var(--ease-out-expo)]",
        open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1.5 opacity-0",
      )}
    >
      <div className="grid grid-cols-[1.15fr_1fr_1.05fr] gap-2 overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-white p-2 text-[var(--ink)] shadow-[0_40px_80px_-32px_rgb(15_58_44/0.5),0_2px_6px_rgb(15_58_44/0.06)]">
        <div className="p-3">
          <p className={panelLabel}>Ways to travel</p>
          <ul className="mt-2">
            {collections.map((c) => (
              <li key={c.slug}>
                <Link href={`/experiences/${c.slug}`} onClick={onNavigate} className={panelRow}>
                  <PanelThumb src={c.image} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-forest-900">{c.name}</span>
                    <span className="block truncate text-xs text-bone-600">{c.blurb}</span>
                  </span>
                  <PanelArrow />
                </Link>
              </li>
            ))}
            <li>
              <Link href="/tours" onClick={onNavigate} className={panelRow}>
                <PanelThumb src={journeyImages.safari} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-forest-900">Tours & safaris</span>
                  <span className="block truncate text-xs text-bone-600">Gorillas, chimpanzees and the Big Five</span>
                </span>
                <PanelArrow />
              </Link>
            </li>
          </ul>
          <Link
            href="/experiences"
            onClick={onNavigate}
            className="group mt-2 flex items-center justify-between rounded-[1.125rem] bg-forest-800 px-4 py-3 text-sm font-semibold text-bone-50 transition-colors hover:bg-forest-700"
          >
            All tours & experiences
            <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="rounded-[1.375rem] bg-bone-100/70 p-3">
          <p className={panelLabel}>Where to go</p>
          <ul className="mt-2">
            {destinations.map((d) => (
              <li key={d.slug}>
                <Link
                  href={toursFor(d.name)}
                  onClick={onNavigate}
                  className="group flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-white focus-visible:bg-white"
                >
                  <PanelThumb src={destinationImages[d.slug]} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-forest-900">
                      {d.name.replace(" National Park", "")}
                    </span>
                    <span className="block truncate text-xs text-bone-600">{d.region}</span>
                  </span>
                  <PanelArrow />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href={TEMBERA.href}
            onClick={onNavigate}
            className="group relative flex min-h-[13.5rem] flex-1 flex-col justify-end overflow-hidden rounded-[1.375rem] p-5 text-white"
          >
            <Image
              src={journeyImages.tembera}
              alt=""
              fill
              sizes="320px"
              className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105"
            />
            <span aria-hidden className="scrim-b absolute inset-0" />
            <span className="relative text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-sun-300">
              All-inclusive editions
            </span>
            <span className="on-media relative mt-1.5 font-display text-[1.45rem] leading-[1.1]" lang="rw">
              {TEMBERA.name}
            </span>
            <span className="relative mt-2 flex items-center gap-1.5 text-xs text-white/85">
              <MapPin aria-hidden className="size-3.5 text-sun-400" />
              Transport, meals and stays in one booking
            </span>
          </Link>
          {extras.length ? (
            <div className="rounded-[1.375rem] border border-[var(--line)] p-3">
              <p className={panelLabel}>Travel essentials</p>
              <ul className="mt-1.5">
                {extras.map((e) => (
                  <li key={e.href}>
                    <Link
                      href={e.href}
                      onClick={onNavigate}
                      className="group flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-bone-100 focus-visible:bg-bone-100"
                    >
                      <span className="font-medium text-forest-900">{e.label}</span>
                      <PanelArrow />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- Phone menu */

function PhoneMenu({
  open,
  onClose,
  pathname,
  accountHref,
  accountLabel,
  whatsapp,
  phone,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
  accountHref: string;
  accountLabel: string;
  whatsapp?: string | null;
  phone?: string | null;
}) {
  const site = useSite();
  const primaryNav = allPrimaryNav.filter(n => visiblePath(n.href, site.publications));
  const sheetRef = React.useRef<HTMLDivElement>(null);

  // A real dialog: focus moves in, Escape closes, focus returns to the menu button.
  React.useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;
    sheet?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !sheet) return;
      const items = [...sheet.querySelectorAll<HTMLElement>("a, button")];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [open, onClose]);

  return (
    <div
      id="site-menu"
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "on-dark fixed inset-0 z-[70] overflow-y-auto bg-forest-950 transition-[opacity,visibility] duration-400 xl:hidden",
        open ? "visible opacity-100" : "invisible opacity-0",
      )}
    >
      <div aria-hidden className="contours pointer-events-none absolute inset-0 opacity-[0.07]" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-forest-600/30 blur-3xl"
      />
      <div className="relative flex min-h-full flex-col">
        <Container className="flex h-[4.5rem] shrink-0 items-center justify-between">
          <Link href="/" onClick={onClose} aria-label="Home">
            <Logo tone="dark" className="h-9" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid size-10 place-items-center rounded-full text-bone-50 ring-1 ring-white/15 transition-colors hover:bg-white/10"
          >
            <X className="size-5" />
          </button>
        </Container>

        <Container className="flex flex-1 flex-col pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">
          <nav aria-label="Sections">
            <ul>
              {primaryNav.map((item, i) => {
                const active = isActive(pathname, item.href);
                return (
                  <li
                    key={item.href}
                    style={{ animationDelay: `${60 + i * 50}ms` }}
                    className={cn("border-b border-white/10", open && "anim-rise")}
                  >
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className="group grid grid-cols-[2rem_1fr_auto] items-center gap-x-2 py-4"
                    >
                      <span className="self-start pt-2 font-display text-sm italic text-sun-400 tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <span className="flex items-center gap-2 font-display text-[1.75rem] leading-tight text-bone-50">
                          {item.label}
                          {active ? <span aria-hidden className="size-1.5 rounded-full bg-sun-500" /> : null}
                        </span>
                        <span className="mt-0.5 block text-sm text-forest-200/80">{item.blurb}</span>
                      </span>
                      <ArrowUpRight
                        aria-hidden
                        className="size-5 text-bone-50/50 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-sun-400"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {site.publications.TRIP !== "HIDDEN" && (
            <div style={{ animationDelay: "340ms" }} className={cn("mt-8", open && "anim-rise")}>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-forest-300">Ways to travel</p>
              <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-8 sm:px-8 [&::-webkit-scrollbar]:hidden">
                {[
                  ...collections.map((c) => ({ href: `/experiences/${c.slug}`, label: c.name, image: c.image })),
                  { href: "/tours", label: "Tours & safaris", image: journeyImages.safari },
                ].map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    onClick={onClose}
                    className="flex shrink-0 items-center gap-2 rounded-full bg-white/[0.07] py-1.5 pl-1.5 pr-3.5 text-sm text-bone-50 ring-1 ring-white/12 transition-colors hover:bg-white/15"
                  >
                    <span className="relative size-7 overflow-hidden rounded-full bg-forest-800">
                      <Image src={c.image} alt="" fill sizes="28px" className="object-cover" />
                    </span>
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {essentials.some((e) => site.publications[e.service] !== "HIDDEN") && (
            <div style={{ animationDelay: "370ms" }} className={cn("mt-6", open && "anim-rise")}>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-forest-300">Travel essentials</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {essentials
                  .filter((e) => site.publications[e.service] !== "HIDDEN")
                  .map((e) => (
                    <Link
                      key={e.href}
                      href={e.href}
                      onClick={onClose}
                      className="rounded-full px-3.5 py-1.5 text-sm text-forest-100 ring-1 ring-white/15 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      {e.label}
                    </Link>
                  ))}
              </div>
            </div>
          )}

          <div
            style={{ animationDelay: "400ms" }}
            className={cn("mt-auto grid grid-cols-2 gap-3 pt-10", open && "anim-rise")}
          >
            <Button href={accountHref} variant="outline" size="lg" onClick={onClose} className="border-white/25 px-4 text-bone-50 hover:bg-bone-50 hover:text-forest-900">
              {accountLabel}
            </Button>
            <Button href={site.publications.FLIGHT !== "HIDDEN" ? "/flights" : "/enquire"} variant="accent" size="lg" onClick={onClose} className="px-4">
              {site.publications.FLIGHT !== "HIDDEN" ? "Flight quote" : "Enquire"}
            </Button>
            {whatsapp ? (
              <a
                href={whatsapp}
                className="col-span-2 mt-1 flex items-center justify-center gap-2 text-sm text-forest-200 transition-colors hover:text-white"
              >
                <MessageCircle aria-hidden className="size-4" />
                Chat with us on WhatsApp{phone ? ` · ${phone}` : ""}
              </a>
            ) : null}
          </div>
        </Container>
      </div>
    </div>
  );
}
