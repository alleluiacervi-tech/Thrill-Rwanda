import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin, Plane } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { JourneyIcon } from "@/components/journey/icons";
import { FaqList } from "@/components/journey/sections";
import { NextEdition } from "@/components/journey/editions";
import { TemberaBand } from "@/components/journey/tembera-band";
import { listEditions } from "@/lib/departures";
import {
  DestinationPanel,
  HotelCard,
  TourCard,
  VehicleCard,
} from "@/components/cards/listing-cards";
import { Button } from "@/components/ui/button";
import {
  Container,
  Eyebrow,
  Rating,
  SectionHead,
} from "@/components/ui/primitives";
import {
  destinationsWithCounts,
  listHotels,
  listTours,
  listVehicles,
  type CatalogueHotel,
  type CatalogueTour,
  type CatalogueVehicle,
} from "@/lib/catalogue";
import type { Destination } from "@/lib/content";
import { collections, doors, journeyImages } from "@/lib/journeys";
import type { Publications } from "@/lib/launch-rules";
import { heroClips, phoneHeroSequence, type HeroClip } from "@/lib/media";
import { platformRating, recentReviews, type PublicReview } from "@/lib/reviews";
import { HeroReel } from "@/components/home/hero-reel";
import {
  HeroSequence,
  HeroSequenceBackdrop,
  HeroSequenceControls,
} from "@/components/home/hero-sequence";
import { InMotion, TrailPhotos } from "@/components/home/media-sections";
import { getSite } from "@/lib/settings";
import { cn } from "@/lib/utils";

// Listings come from the database. Edits refresh this at once; this is only the safety net.
export const revalidate = 300;

export default async function HomePage() {
  const [site, tours, hotels, vehicles, destinations, rating, reviews, nextEdition] =
    await Promise.all([
      getSite(),
      listTours(),
      listHotels(),
      listVehicles(),
      destinationsWithCounts(),
      platformRating(),
      recentReviews(3),
      // The soonest Tembera edition, if one is scheduled. Never fails the page.
      listEditions(1).then((list) => list[0]).catch(() => undefined),
    ]);
  const { publications } = site;
  const flight = publications.FLIGHT !== "HIDDEN";
  const trips = publications.TRIP !== "HIDDEN";

  return (
    <PageShell overHero>
      <Hero
        title={site.heroTitle}
        subtitle={site.heroSubtitle}
        text={site.heroText}
        publications={publications}
      />
      {trips && <Journeys />}
      {trips && (
        <TemberaBand>{nextEdition ? <NextEdition edition={nextEdition} /> : null}</TemberaBand>
      )}
      {trips && <Destinations destinations={destinations} />}
      <FeaturedTours tours={tours} />
      <InMotion />
      <Occasions publications={publications} />
      <HowItWorks flight={flight} />
      <Stays hotels={hotels} />
      <Fleet vehicles={vehicles} />
      <TrailPhotos />
      <Testimonials rating={rating} reviews={reviews} />
      <Questions />
      <ClosingCall flight={flight} />
    </PageShell>
  );
}

/* ==================================================================== Hero */

/**
 * The hero is built from Thrill Rwanda's own footage. Desktop: type on the
 * left, a triptych of silent loops on the right. Phone: the three reels play
 * full-screen in sequence behind the type. The flight quote is the one gold
 * action; the service dock closes the section and stays on the first screen.
 */
function Hero({
  title,
  subtitle,
  text,
  publications,
}: {
  title: string;
  subtitle: string;
  text: string;
  publications: Publications;
}) {
  const flight = publications.FLIGHT !== "HIDDEN";
  return (
    <section className="on-dark relative -mt-[4.5rem] overflow-hidden bg-forest-950 lg:-mt-24">
      <HeroSequence clips={phoneHeroSequence}>
        {/* Phone ground: the clips in sequence, framed to the first screen and faded into the ground below. */}
        <HeroSequenceBackdrop className="absolute inset-x-0 top-0 h-[100svh] max-h-full [mask-image:linear-gradient(to_bottom,#000_72%,transparent)] lg:hidden" />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-forest-950/75 via-forest-950/45 to-forest-950 lg:hidden"
        />

        {/* Desktop ground: the brand green, lit from the upper right, with the contour motif. */}
        <div
          aria-hidden
          className="absolute inset-0 hidden lg:block"
          style={{
            background:
              "radial-gradient(60% 70% at 78% 30%, rgb(47 128 96 / 0.55), transparent 70%), linear-gradient(180deg, var(--color-forest-950), var(--color-forest-900))",
          }}
        />
        <div
          aria-hidden
          className="contours-light absolute inset-0 hidden opacity-[0.05] lg:block"
        />

        <Container
          wide
          className="relative pb-8 pt-[clamp(7.5rem,15vh,10.5rem)] sm:pb-10 lg:pb-14"
        >
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.98fr)] lg:items-center lg:gap-14">
            <div className="max-w-2xl">
              <p className="anim-fade [animation-delay:120ms]">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-bone-50 ring-1 ring-white/20 backdrop-blur-md">
                  <span aria-hidden className="size-1.5 rounded-full bg-sun-500" />
                  {flight
                    ? "Flights · Safaris · The Land of a Thousand Hills"
                    : "The Land of a Thousand Hills"}
                </span>
              </p>

              <h1 className="on-media mt-5 text-display-lg text-white lg:mt-7 lg:[text-shadow:none]">
                <span className="reveal-line">
                  <span className="pb-[0.14em] [animation-delay:200ms]">{title}</span>
                </span>
                <span className="reveal-line">
                  <em className="pb-[0.1em] text-[0.62em] leading-[1.05] text-sun-400 [animation-delay:320ms]">
                    {subtitle}
                  </em>
                </span>
              </h1>

              <p className="on-media anim-rise mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-white/90 [animation-delay:520ms] lg:mt-6 lg:text-lg lg:text-forest-100/90 lg:[text-shadow:none]">
                {text}
              </p>

              <div className="anim-rise mt-7 flex flex-wrap gap-3 [animation-delay:600ms]">
                <Button
                  href={flight ? "/flights" : "/enquire"}
                  variant="accent"
                  size="lg"
                  data-service={flight ? "FLIGHT" : undefined}
                  data-placement="HOME_HERO"
                >
                  {flight ? (
                    <Plane className="size-4" aria-hidden />
                  ) : null}
                  {flight ? "Request a flight quote" : "Plan your journey"}
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
                <Button
                  href={flight ? "/enquire" : "/how-it-works"}
                  variant="outline"
                  size="lg"
                  className="border-white/40 text-white hover:border-bone-50 hover:bg-bone-50 hover:text-forest-950"
                >
                  {flight ? "Plan a Rwanda trip" : "How it works"}
                </Button>
              </div>
              <p className="on-media anim-rise mt-5 max-w-md text-sm leading-relaxed text-white/75 [animation-delay:680ms] lg:[text-shadow:none]">
                A request starts the conversation. Availability, payment and
                confirmation follow the checks in your written quote.
              </p>
              <HeroSequenceControls className="mt-5 lg:hidden" />
            </div>

            <HeroTriptych />
          </div>

          <ServiceDock publications={publications} />
        </Container>
      </HeroSequence>
    </section>
  );
}

/** Three film panels, staggered like frames pinned to a wall. Desktop only; decorative. */
function HeroTriptych() {
  const panels: {
    clip: HeroClip;
    frame: string;
    drift: string;
    delay: string;
    eager?: boolean;
  }[] = [
    { clip: heroClips.gorilla, frame: "h-[78%] translate-y-[9%]", drift: "[--drift-to:-8px]", delay: "[animation-delay:420ms]" },
    { clip: heroClips.kivu, frame: "h-full", eager: true, drift: "[--drift-from:-6px] [--drift-to:6px] [animation-delay:-2s]", delay: "[animation-delay:300ms]" },
    { clip: heroClips.crater, frame: "h-[78%] -translate-y-[9%]", drift: "[--drift-to:10px] [animation-delay:-4s]", delay: "[animation-delay:540ms]" },
  ];
  return (
    <div className="hidden h-[min(52vh,32rem)] grid-cols-[1fr_1.3fr_1fr] items-center gap-3 lg:grid xl:gap-4">
      {panels.map(({ clip, frame, drift, delay, eager }) => (
        <div key={clip.src} className={cn("anim-rise", frame, delay)}>
          <HeroReel
            {...clip}
            media="(min-width: 1024px)"
            sizes="(min-width: 1024px) 18vw, 1px"
            eager={eager}
            className={cn(
              "drift h-full rounded-[1.5rem] shadow-[0_30px_60px_-30px_rgb(4_14_10/0.8)] ring-1 ring-white/15",
              drift,
            )}
          >
            <div aria-hidden className="scrim-b absolute inset-0" />
            <p className="on-media absolute inset-x-0 bottom-0 flex items-center gap-1.5 p-4 text-xs font-semibold text-white">
              <MapPin className="size-3.5 shrink-0 text-sun-400" aria-hidden />
              {clip.place}
            </p>
          </HeroReel>
        </div>
      ))}
    </div>
  );
}

/**
 * One travel desk, five front doors. A glass rail across the foot of the
 * hero: flights lead in gold, the rest follow in menu order (the product map
 * in src/lib/journeys.ts). A swipe rail on phones, one row on desktop.
 */
function ServiceDock({ publications }: { publications: Publications }) {
  const shown = doors.filter((s) => publications[s.service] !== "HIDDEN");
  if (shown.length === 0) return null;
  return (
    <nav
      aria-label="What we arrange"
      className="anim-rise mt-10 [animation-delay:760ms] lg:mt-14"
    >
      <ul className="no-bar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:auto-cols-fr lg:grid-flow-col lg:overflow-visible lg:px-0 lg:pb-0">
        {shown.map((s) => {
          const lead = s.key === "flights";
          return (
            <li
              key={s.key}
              className="w-[68vw] max-w-[17rem] shrink-0 snap-start lg:w-auto lg:max-w-none"
            >
              <Link
                href={s.href}
                data-service={s.service}
                data-placement="HOME_SERVICES"
                className={cn(
                  "group flex h-full flex-col rounded-[1.25rem] p-5 ring-1 backdrop-blur-md transition duration-300 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-1",
                  lead
                    ? "bg-sun-500 text-forest-950 ring-sun-300 hover:bg-sun-300"
                    : "bg-white/[0.07] text-bone-50 ring-white/15 hover:bg-white/[0.14] hover:ring-white/30",
                )}
              >
                <span className="flex items-center justify-between">
                  <span
                    className={cn(
                      "grid size-10 place-items-center rounded-full",
                      lead ? "bg-forest-950 text-sun-400" : "bg-white/10 text-sun-400",
                    )}
                  >
                    <JourneyIcon name={s.icon} className="size-[1.125rem]" />
                  </span>
                  <ArrowUpRight
                    className={cn(
                      "size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5",
                      lead ? "text-forest-950/70" : "text-white/50",
                    )}
                    aria-hidden
                  />
                </span>
                <span className="mt-4 font-display text-xl leading-tight">
                  {s.label}
                </span>
                <span
                  className={cn(
                    "mt-1.5 text-[0.8125rem] leading-snug",
                    lead ? "text-forest-950/80" : "text-white/70",
                  )}
                >
                  {s.blurb}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ================================================================ Journeys */

/** The ways to travel, as four tall frames: three collections and the safaris. */
function Journeys() {
  const frames = [
    ...collections.map((c) => ({
      href: `/experiences/${c.slug}`,
      eyebrow: c.eyebrow,
      name: c.name,
      blurb: c.blurb,
      image: c.image,
      position: c.imagePosition,
    })),
    {
      href: "/tours",
      eyebrow: "Tours & safaris",
      name: "Into the parks",
      blurb: "Gorillas, chimpanzees and the Big Five",
      image: journeyImages.safari,
      position: "center 40%",
    },
  ];
  return (
    <section className="overflow-hidden py-20 sm:py-28">
      <Container wide>
        <SectionHead
          eyebrow="Tours & Experiences"
          title={
            <>
              Choose your <em>kind of journey</em>
            </>
          }
          lede="Private or shared, a day or a fortnight. Each one is planned for your dates and confirmed in a written quote."
          action={
            <Button href="/experiences" variant="outline">
              All experiences
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          }
        />

        <ul className="no-bar -mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:mt-14 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0">
          {frames.map((frame, i) => (
            <li
              key={frame.href}
              className={cn(
                "w-[76vw] max-w-[21rem] shrink-0 snap-center lg:w-auto lg:max-w-none",
                // Alternate frames sit a little lower, so the row reads as hung by hand.
                i % 2 === 1 && "lg:mt-10",
              )}
            >
              <Link
                href={frame.href}
                className="group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-[var(--radius-panel)] bg-forest-950 p-6 text-white"
              >
                <Image
                  src={frame.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 25vw, 76vw"
                  className="object-cover transition-transform duration-[1.6s] ease-out group-hover:scale-105"
                  style={frame.position ? { objectPosition: frame.position } : undefined}
                />
                <span aria-hidden className="scrim-b absolute inset-0" />
                <span
                  aria-hidden
                  className="absolute right-5 top-5 grid size-10 place-items-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur-md transition-colors duration-500 group-hover:bg-sun-500 group-hover:text-forest-950"
                >
                  <ArrowUpRight className="size-4" />
                </span>
                <span className="relative text-2xs font-semibold uppercase tracking-[0.16em] text-sun-300">
                  {frame.eyebrow}
                </span>
                <span className="on-media relative mt-2 font-display text-[1.875rem] leading-[1.05]">
                  {frame.name}
                </span>
                <span className="relative mt-2 text-[0.9375rem] leading-snug text-white/85">
                  {frame.blurb}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* =============================================================== Occasions */

const occasions = [
  {
    service: "EVENT" as const,
    href: "/weddings",
    eyebrow: "Weddings & events",
    title: "Your wedding,",
    titleEm: "held in the hills.",
    body: "We reserve the venue for your date, bring your guests to it and plan the honeymoon that follows.",
    cta: "Check a date",
    image: journeyImages.weddings,
    position: "center 60%",
  },
  {
    service: "GROUP" as const,
    href: "/groups",
    eyebrow: "Groups & schools",
    title: "Travel together,",
    titleEm: "planned as one.",
    body: "School trips, teams and associations: one brief, one quote and a journey for everyone on it.",
    cta: "Plan a group trip",
    image: journeyImages.groups,
    position: "center 45%",
  },
];

/** The two occasions people travel for together. Each hides with its service. */
function Occasions({ publications }: { publications: Publications }) {
  const shown = occasions.filter((o) => publications[o.service] !== "HIDDEN");
  if (shown.length === 0) return null;
  return (
    <section className="py-20 sm:py-28">
      <Container wide>
        <SectionHead
          eyebrow="For the days that matter"
          title={
            <>
              When everyone <em>travels together</em>
            </>
          }
          lede="A marriage, a class, a team. The same desk plans the journey for all of them."
        />
        <ul className={cn("mt-10 grid gap-4 lg:mt-14 lg:gap-5", shown.length > 1 && "lg:grid-cols-2")}>
          {shown.map((o) => (
            <li key={o.href}>
              <Link
                href={o.href}
                data-service={o.service}
                data-placement="HOME_SERVICES"
                className="group relative flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-[var(--radius-panel)] bg-forest-950 p-7 text-white sm:min-h-[32rem] sm:p-10"
              >
                <Image
                  src={o.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover transition-transform duration-[1.6s] ease-out group-hover:scale-105"
                  style={{ objectPosition: o.position }}
                />
                <span aria-hidden className="scrim-deep absolute inset-0" />
                <span className="relative text-2xs font-semibold uppercase tracking-[0.16em] text-sun-300">
                  {o.eyebrow}
                </span>
                <span className="on-media relative mt-3 font-display text-[2.25rem] leading-[1.02] sm:text-5xl">
                  {o.title} <em className="text-sun-400">{o.titleEm}</em>
                </span>
                <span className="relative mt-4 max-w-md text-[1.0625rem] leading-relaxed text-white/88">
                  {o.body}
                </span>
                <span className="relative mt-7 inline-flex h-12 w-fit items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-forest-950 transition-colors duration-300 group-hover:bg-sun-500">
                  {o.cta}
                  <ArrowRight
                    className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* ============================================================== HowItWorks */

const steps = [
  ["Tell us your plans", "Share dates, preferences and how we can reach you."],
  ["Review a written quote", "Check the total, service fee, validity and supplier conditions."],
  ["Accept and arrange payment", "Use approved instructions. Finance verifies funds before supplier processing."],
  ["Receive confirmation", "Supplier checks and confirmed references complete the arrangement."],
] as const;

function HowItWorks({ flight }: { flight: boolean }) {
  return (
    <section className="border-b border-[var(--line)] bg-bone-100 py-20 sm:py-28">
      <Container
        wide
        className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:gap-20"
      >
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-3 text-display-sm">
            Clear steps <em>before you commit</em>
          </h2>
          <p className="mt-5 max-w-md text-[1.0625rem] leading-relaxed text-[var(--ink-muted)]">
            {flight
              ? "Whether it is a flight into Kigali or a week on safari, the same travel desk checks every detail and puts it in writing first."
              : "One travel desk checks every detail of your journey and puts it in writing first."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {flight ? (
              <Button
                href="/flights"
                variant="primary"
                data-service="FLIGHT"
                data-placement="HOME_SERVICES"
              >
                <Plane className="size-4" aria-hidden />
                Start a flight request
              </Button>
            ) : null}
            <Button href="/how-it-works" variant="outline">
              The full process
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>

        <ol className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
          {steps.map(([title, body], i) => (
            <li key={title} className="border-t border-[var(--line-strong)] pt-6">
              <span
                aria-hidden
                className="display-italic tnum font-display text-2xl text-clay-600"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-4 text-2xl">{title}</h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
                {body}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

/* ============================================================ Destinations */

function Destinations({ destinations }: { destinations: Destination[] }) {
  return (
    <section className="overflow-hidden py-20 sm:py-28">
      <Container wide>
        <SectionHead
          eyebrow="Destinations"
          title="Rwanda's parks and places"
          lede="From the gorilla slopes of Volcanoes National Park to Nyungwe's canopy, Akagera's savannah and Kigali's hills."
          action={
            <Button href="/tours" variant="outline">
              All destinations
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          }
        />

        {/* A swipe rail on phones; on desktop one row where the panel under the pointer widens. */}
        <ul className="dest-rail no-bar -mx-5 mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 sm:-mx-8 sm:px-8 lg:mx-0 lg:mt-14 lg:h-[34rem] lg:gap-3 lg:overflow-visible lg:px-0">
          {destinations.map((d, i) => (
            <li
              key={d.slug}
              className="h-[27rem] w-[78vw] max-w-[22rem] shrink-0 snap-center lg:h-auto lg:w-auto lg:max-w-none lg:shrink"
            >
              <DestinationPanel destination={d} index={i} className="h-full" />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* =========================================================== FeaturedTours */

// Approved, published offers only. With none, the section stays off the page.
function FeaturedTours({ tours }: { tours: CatalogueTour[] }) {
  if (tours.length === 0) return null;
  return (
    <section className="relative overflow-hidden bg-bone-100 py-20 sm:py-28">
      <div aria-hidden className="contours absolute inset-0 opacity-[0.035]" />
      <Container wide className="relative">
        <SectionHead
          eyebrow="Tours & Safaris"
          title={
            <>
              Itineraries to start <em>a conversation</em>
            </>
          }
          lede="Review the offer details, then ask for a quote for your dates."
          action={
            <Button href="/tours" variant="primary">
              Browse all safaris
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          }
        />

        {/* Swipe rail on phones, so three trips don't cost three screens of scrolling. */}
        <div className="no-bar -mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:mt-14 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0 lg:pb-0">
          {tours.slice(0, 3).map((tour, i) => (
            <TourCard
              key={tour.slug}
              tour={tour}
              priority={i === 0}
              className="w-[84vw] max-w-[22rem] shrink-0 snap-center sm:w-[44vw] lg:w-auto lg:max-w-none"
            />
          ))}
        </div>
      </Container>
    </section>
  );
}

/* =================================================================== Stays */

function Stays({ hotels }: { hotels: CatalogueHotel[] }) {
  if (hotels.length === 0) return null;
  return (
    <section className="py-20 sm:py-28">
      <Container
        wide
        className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:gap-20"
      >
        {/* The heading holds still while the list scrolls past it. */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHead
            eyebrow="Hotels & Concierge"
            title="Somewhere good to land"
            lede="Lodges, lakeside stays and city suites, with the travel desk behind every enquiry."
          />
          <Button href="/hotels" variant="outline" className="mt-8">
            See all stays
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="flex flex-col gap-5">
          {hotels.slice(0, 3).map((hotel) => (
            <HotelCard key={hotel.slug} hotel={hotel} />
          ))}
        </div>
      </Container>
    </section>
  );
}

/* =================================================================== Fleet */

function Fleet({ vehicles }: { vehicles: CatalogueVehicle[] }) {
  if (vehicles.length === 0) return null;
  return (
    <section className="border-t border-[var(--line)] bg-bone-100 py-20 sm:py-28">
      <Container wide>
        <SectionHead
          eyebrow="Car Hire"
          title="A vehicle that suits the road"
          lede="Self-drive or chauffeured, from compact city SUVs to safari-rigged 4x4s."
          action={
            <Button href="/cars" variant="outline">
              See the full fleet
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          }
        />
        <div className="no-bar -mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:mt-14 lg:grid-cols-4 lg:gap-6">
          {vehicles.slice(0, 4).map((v) => (
            <VehicleCard
              key={v.slug}
              vehicle={v}
              className="w-[78vw] max-w-[20rem] shrink-0 snap-center sm:w-auto sm:max-w-none"
            />
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ============================================================ Testimonials */

// Published reviews only. Until there are some, the section stays off the page rather than showing invented quotes.
function Testimonials({
  rating,
  reviews,
}: {
  rating: { value: number | null; count: number };
  reviews: PublicReview[];
}) {
  if (reviews.length === 0 || rating.value === null) return null;

  return (
    <section className="border-y border-[var(--line)] bg-bone-100 py-20 sm:py-28">
      <Container wide>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow>Reviews</Eyebrow>
            <h2 className="mt-3 text-display-sm">What travellers told us</h2>
          </div>
          <Rating value={rating.value} count={rating.count} className="text-base" />
        </div>

        <div className="mt-10 grid gap-5 lg:mt-14 lg:grid-cols-3 lg:gap-6">
          {reviews.map((r) => (
            <figure
              key={r.id}
              className="flex flex-col rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-7"
            >
              <Rating value={r.rating} />
              <blockquote className="mt-5 flex-1 font-display text-xl leading-snug text-[var(--ink)]">
                {r.comment}
              </blockquote>
              <figcaption className="mt-6 border-t border-[var(--line)] pt-5">
                <p className="font-medium">{r.authorName}</p>
                <p className="mt-0.5 text-sm text-[var(--ink-faint)]">{r.subject}</p>
              </figcaption>
            </figure>
          ))}
        </div>
        <Button href="/reviews" variant="quiet" className="mt-8">
          Read all reviews
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </Container>
    </section>
  );
}

/* =============================================================== Questions */

const questions = [
  [
    "Does an enquiry reserve a flight or service?",
    "No. We check options first. A written quote states its validity and any supplier conditions; confirmation follows acceptance, payment verification and supplier checks.",
  ],
  [
    "What is included in the price?",
    "Your quote separates supplier charges and our service fee, with taxes, exclusions and payment deadlines stated for your arrangement.",
  ],
  [
    "Can I change or cancel?",
    "Contact the travel desk with your reference. Changes, cancellation charges and refund eligibility depend on the terms of your accepted quote and the supplier.",
  ],
  [
    "How do I get help after confirmation?",
    "Use the contact details on the Support page and include your reference. The team records an owner and next action for your case.",
  ],
] as const;

function Questions() {
  return (
    <section className="py-20 sm:py-28">
      <Container
        wide
        className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:gap-20"
      >
        <div>
          <Eyebrow>Before you enquire</Eyebrow>
          <h2 className="mt-3 text-display-sm">Questions, answered</h2>
          <ul className="mt-8 space-y-3 text-[0.9375rem] font-medium">
            {[
              ["Support & changes", "/support"],
              ["Cancellation terms", "/legal/cancellation"],
              ["Privacy notice", "/legal/privacy"],
            ].map(([label, href]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-flex items-center gap-2 underline decoration-[var(--line-strong)] underline-offset-4 transition-colors hover:decoration-forest-700"
                >
                  {label}
                  <ArrowUpRight className="size-3.5 text-forest-700" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <FaqList items={questions} />
      </Container>
    </section>
  );
}

/* ============================================================= ClosingCall */

function ClosingCall({ flight }: { flight: boolean }) {
  return (
    <section className="on-dark relative overflow-hidden bg-forest-950 py-20 sm:py-28">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(55% 90% at 85% 10%, rgb(47 128 96 / 0.5), transparent 70%)",
        }}
      />
      <div aria-hidden className="contours-light absolute inset-0 opacity-[0.05]" />
      <Container wide className="relative">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Eyebrow className="text-sun-300">Ready when you are</Eyebrow>
            <h2 className="mt-3 text-display-sm text-white">
              Tell us where you are going. <em className="text-sun-400">We will take it from there.</em>
            </h2>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Button
              href={flight ? "/flights" : "/enquire"}
              variant="accent"
              size="lg"
              data-service={flight ? "FLIGHT" : undefined}
              data-placement="HOME_SERVICES"
            >
              {flight ? "Request a flight quote" : "Plan your journey"}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            {flight ? (
              <Button
                href="/enquire"
                variant="outline"
                size="lg"
                className="border-white/40 text-white hover:border-bone-50 hover:bg-bone-50 hover:text-forest-950"
              >
                Plan a Rwanda trip
              </Button>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
