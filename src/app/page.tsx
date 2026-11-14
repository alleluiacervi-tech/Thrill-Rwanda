import {
  ArrowRight,
  Clock3,
  MapPin,
  Plane,
  PlaneLanding,
} from "lucide-react";
import { AnnouncementBar } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { WhatsAppButton } from "@/components/layout/whatsapp-button";
import { SearchPanel } from "@/components/search/search-panel";
import {
  DestinationPanel,
  HotelCard,
  TourCard,
  VehicleCard,
} from "@/components/cards/listing-cards";
import { Button } from "@/components/ui/button";
import {
  Badge,
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
import { whyUs, type Destination } from "@/lib/content";
import { platformRating, recentReviews, type PublicReview } from "@/lib/reviews";
import { heroClips, phoneHeroSequence, type HeroClip } from "@/lib/media";
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
  const [tours, hotels, vehicles, destinations, rating, reviews] = await Promise.all([
    listTours(),
    listHotels(),
    listVehicles(),
    destinationsWithCounts(),
    platformRating(),
    recentReviews(3),
  ]);

  return (
    <>
      <AnnouncementBar />
      <SiteHeader overHero />
      <main id="main">
        <Hero hotels={hotels} tours={tours} vehicles={vehicles} />
        <TrustStrip />
        <Destinations destinations={destinations} />
        <FeaturedTours tours={tours} />
        <Stays hotels={hotels} />
        <Fleet vehicles={vehicles} />
        <InMotion />
        <TrailPhotos />
        <Transfers />
        <WhyUs />
        <Testimonials rating={rating} reviews={reviews} />
      </main>
      <SiteFooter />
      <WhatsAppButton />
    </>
  );
}

/* ==================================================================== Hero */

/**
 * The hero is built from Thrill Rwanda's own footage rather than a stock
 * landscape. Desktop: type on the left, a triptych of silent loops on the
 * right. Phone: the three reels play full-screen in sequence behind the type,
 * because a vertical clip is exactly the shape of a phone. The search panel closes the
 * section either way and stays on the first screen.
 */
async function Hero({
  hotels,
  tours,
  vehicles,
}: {
  hotels: CatalogueHotel[];
  tours: CatalogueTour[];
  vehicles: CatalogueVehicle[];
}) {
  const site = await getSite();
  return (
    <section className="on-dark relative -mt-[4.5rem] overflow-hidden bg-forest-950 lg:-mt-24">
      <HeroSequence clips={phoneHeroSequence}>
        {/* Phone ground: the three clips in sequence, then a scrim heaviest where the type and panel sit. */}
        <HeroSequenceBackdrop className="absolute inset-0 lg:hidden" />
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
        <div aria-hidden className="contours-light absolute inset-0 hidden opacity-[0.05] lg:block" />

        <Container wide className="relative pb-6 pt-[clamp(7.5rem,15vh,10.5rem)] sm:pb-10 lg:pb-12">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.98fr)] lg:items-center lg:gap-14">
            <div className="max-w-2xl">
              <p className="anim-fade [animation-delay:120ms]">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-bone-50 ring-1 ring-white/20 backdrop-blur-md">
                  <span aria-hidden className="size-1.5 rounded-full bg-sun-500" />
                  The Land of a Thousand Hills
                </span>
              </p>

              <h1 className="on-media mt-5 text-display-lg text-white lg:mt-7 lg:[text-shadow:none]">
                <span className="reveal-line">
                  <span className="pb-[0.14em] [animation-delay:200ms]">{site.heroTitle}</span>
                </span>
                <span className="reveal-line">
                  <em className="pb-[0.1em] text-[0.62em] leading-[1.05] text-sun-400 [animation-delay:320ms]">
                    {site.heroSubtitle}
                  </em>
                </span>
              </h1>

              <p className="on-media anim-rise mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-white/90 [animation-delay:520ms] lg:mt-6 lg:text-lg lg:text-forest-100/90 lg:[text-shadow:none]">
                {site.heroText}
              </p>

              <HeroSequenceControls className="mt-5 lg:hidden" />
            </div>

            <HeroTriptych />
          </div>

          <div className="anim-rise mt-8 [animation-delay:660ms] lg:mt-12">
            {/* Each tab suggests its own places: hotel towns for stays, destinations for safaris. */}
            <SearchPanel
              hotelPlaces={[...new Set([...hotels.map((h) => h.location), ...hotels.map((h) => h.name)])]}
              safariPlaces={[...new Set([...tours.map((t) => t.destination), ...tours.map((t) => t.name)])]}
              transferZones={[]}
              cars={vehicles.map((v) => ({
                slug: v.slug,
                name: `${v.make} ${v.model}`,
                category: v.category,
              }))}
            />
          </div>
        </Container>
      </HeroSequence>
    </section>
  );
}

/** Three film panels, staggered like frames pinned to a wall. Desktop only; decorative. */
function HeroTriptych() {
  const panels: { clip: HeroClip; frame: string; drift: string; delay: string; eager?: boolean }[] = [
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

/* ============================================================= TrustStrip */

function TrustStrip() {
  const items = [
    { icon: Plane, label: "Rwanda destination ideas" },
    { icon: Clock3, label: "Sample catalogue only" },
    { icon: Clock3, label: "Prices and payment setup pending" },
    { icon: Clock3, label: "Business contacts pending" },
  ];
  return (
    <section className="border-b border-[var(--line)] bg-bone-100">
      <Container wide>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-4 py-5 lg:grid-cols-4 lg:py-6">
          {items.map((item) => (
            <li
              key={item.label}
              className="flex items-center gap-3 text-sm font-medium leading-snug text-bone-700"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-forest-700 ring-1 ring-bone-300">
                <item.icon className="size-4" aria-hidden />
              </span>
              {item.label}
            </li>
          ))}
        </ul>
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
          lede="Explore destination ideas from Volcanoes National Park to Nyungwe, Akagera and Kigali. Live listings are still being prepared."
          action={
            <Button href="/tours" variant="outline">
              All destinations
              <ArrowRight className="size-4" />
            </Button>
          }
        />

        {/* A swipe rail on phones; on desktop one row where the panel under
            the pointer widens. Works for any number of destinations, so there
            is never a hole in the grid when one is added or removed. */}
        <ul className="dest-rail no-bar -mx-5 mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 sm:-mx-8 sm:px-8 lg:mx-0 lg:mt-14 lg:h-[34rem] lg:gap-3 lg:overflow-visible lg:px-0">
          {destinations.map((d, i) => (
            <li key={d.slug} className="h-[27rem] w-[78vw] max-w-[22rem] shrink-0 snap-center lg:h-auto lg:w-auto lg:max-w-none lg:shrink">
              <DestinationPanel destination={d} index={i} className="h-full" />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* =========================================================== FeaturedTours */

function FeaturedTours({ tours }: { tours: CatalogueTour[] }) {
  return (
    <section className="relative overflow-hidden bg-bone-100 py-20 sm:py-28">
      <div aria-hidden className="contours absolute inset-0 opacity-[0.035]" />
      <Container wide className="relative">
        <SectionHead
          eyebrow="Tours & Safaris"
          title={
            <>
              Guided by people <em>who live there</em>
            </>
          }
          lede="These are sample listings for development only. Provider details, permissions, availability and prices must be verified before launch."
          action={
            <Button href="/tours" variant="primary">
              Browse all safaris
              <ArrowRight className="size-4" />
            </Button>
          }
        />

        {/* Swipe rail on phones, so three trips don't cost three screens of scrolling. */}
        <div className="no-bar -mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 sm:grid-cols-2 sm:gap-5 lg:mt-14 lg:grid-cols-3 lg:gap-6">
          {tours.slice(0, 3).map((tour, i) => (
            <TourCard key={tour.slug} tour={tour} priority={i === 0} className="w-[84vw] max-w-[22rem] shrink-0 snap-center sm:w-auto sm:max-w-none" />
          ))}
        </div>
      </Container>
    </section>
  );
}

/* =================================================================== Stays */

function Stays({ hotels }: { hotels: CatalogueHotel[] }) {
  return (
    <section className="py-20 sm:py-28">
      <Container wide className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:gap-20">
        {/* The heading holds still while the list scrolls past it. */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHead
            eyebrow="Hotels & Concierge"
            title="Somewhere good to land"
            lede="Beach lodges, tented camps and city apartments, with our concierge desk behind every stay."
          />
          <Button href="/hotels" variant="outline" className="mt-8">
            See all stays
            <ArrowRight className="size-4" />
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
              <ArrowRight className="size-4" />
            </Button>
          }
        />
        <div className="no-bar -mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 sm:grid-cols-2 sm:gap-5 lg:mt-14 lg:grid-cols-4 lg:gap-6">
          {vehicles.slice(0, 4).map((v) => (
            <VehicleCard key={v.slug} vehicle={v} className="w-[78vw] max-w-[20rem] shrink-0 snap-center sm:w-auto sm:max-w-none" />
          ))}
        </div>
      </Container>
    </section>
  );
}

/* =============================================================== Transfers */

function Transfers() {
  return (
    <section className="relative overflow-hidden bg-clay-100 py-20 sm:py-28">
      <div
        aria-hidden
        className="contours absolute inset-0 opacity-[0.05]"
      />
      <Container wide className="relative grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-20">
        <div>
          <Eyebrow>Airport Transfers</Eyebrow>
          <h2 className="mt-3 text-display-sm text-clay-900">
            Someone is already waiting <em>when you land</em>
          </h2>
          <p className="mt-5 max-w-lg text-[1.0625rem] leading-relaxed text-clay-900/75">
            Rwanda airport routes, providers and prices are still being
            configured. No transfer service is available to book yet.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/contact" variant="primary" size="lg">
              Get launch updates
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="rounded-[var(--radius-panel)] bg-white p-6 shadow-[var(--shadow-lift)] ring-1 ring-clay-700/10 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <span className="grid size-12 place-items-center rounded-full bg-clay-100 text-clay-700">
              <PlaneLanding className="size-5" aria-hidden />
            </span>
            <Badge tone="clay">In preparation</Badge>
          </div>
          <p className="mt-6 font-display text-2xl leading-tight text-clay-900">
            Transfer zones and fixed rates
          </p>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-bone-700">
            Rwanda transfer zones and RWF rates will be added after local
            providers and prices are confirmed.
          </p>
        </div>
      </Container>
    </section>
  );
}

/* =================================================================== WhyUs */

function WhyUs() {
  return (
    <section className="py-20 sm:py-28">
      <Container wide>
        <SectionHead
          eyebrow="Why book with us"
          title="A Booking That Actually Holds — Guaranteed."
          lede="This booking platform is being adapted for Rwanda. Provider checks, payment and fulfilment processes must be confirmed before launch."
        />

        <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {whyUs.map((item, i) => (
            <li key={item.title} className="border-t border-[var(--line-strong)] pt-6">
              <span aria-hidden className="display-italic tnum font-display text-2xl text-lake-600">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-4 text-2xl">{item.title}</h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
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
          <ArrowRight className="size-4" />
        </Button>
      </Container>
    </section>
  );
}
