import Image from "next/image";
import {
  ArrowRight,
  Clock3,
  Plane,
} from "lucide-react";
import { AnnouncementBar } from "@/components/layout/page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { WhatsAppButton } from "@/components/layout/whatsapp-button";
import { SearchPanel } from "@/components/search/search-panel";
import {
  DestinationTile,
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
import { heroImage } from "@/lib/images";
import { getSite } from "@/lib/settings";

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
        <StaysAndFleet hotels={hotels} vehicles={vehicles} />
        <Transfers />
        <WhyUs />
        <Testimonials rating={rating} reviews={reviews} />
        <ClosingCta />
      </main>
      <SiteFooter />
      <WhatsAppButton />
    </>
  );
}

/* ==================================================================== Hero */

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
    <section className="on-dark relative -mt-[4.5rem] flex min-h-[92svh] flex-col justify-end overflow-hidden bg-forest-900 pt-[clamp(6.5rem,13vh,10rem)] lg:-mt-24">
      {/* Photograph first, then the brand gradient over it. The gradient is
          translucent rather than opaque so the palette still reads as ours
          while the type keeps its contrast. */}
      <Image
        src={heroImage}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* A directional scrim, not a blanket. Heavy on the left where the
          headline and search panel sit, clearing to the right so the
          photograph is actually visible — an image you can't see is worse
          than no image, it just costs bandwidth. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(100deg, rgb(15 58 44 / 0.94) 0%, rgb(15 58 44 / 0.82) 28%, rgb(21 74 56 / 0.45) 58%, rgb(21 74 56 / 0.18) 100%)",
        }}
      />
      {/* Low-opacity forest tint keeps the palette ours across the whole frame. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-forest-900/25 mix-blend-multiply"
      />
      <div
        aria-hidden
        className="contours absolute inset-0 opacity-[0.09] [background-size:760px_760px]"
      />
      {/* Low sun */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-4 size-[34rem] rounded-full bg-ember-500/20 blur-[110px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-forest-950 to-transparent"
      />

      <Container wide className="relative pb-10">
        <div className="max-w-4xl">
          <p className="anim-fade [animation-delay:120ms]">
            <Eyebrow className="text-forest-200">Rwanda</Eyebrow>
          </p>

          <h1 className="mt-[clamp(0.75rem,2.2vh,1.75rem)] text-display-lg text-bone-50">
            <span className="reveal-line">
              <span className="pb-[0.16em] [animation-delay:200ms]">{site.heroTitle}</span>
            </span>
            {/* Smaller, so the long line stays on one row on a laptop. */}
            <span className="reveal-line">
              <span className="pb-[0.12em] text-[0.62em] italic text-ember-500 [animation-delay:320ms]">
                {site.heroSubtitle}
              </span>
            </span>
          </h1>

          <p className="anim-rise mt-[clamp(0.75rem,2.2vh,1.75rem)] max-w-2xl text-base leading-relaxed text-forest-100/85 [animation-delay:520ms] sm:text-lg lg:text-xl">
            {site.heroText}
          </p>
        </div>

        <div className="anim-rise mt-[clamp(1.25rem,3.5vh,3rem)] [animation-delay:660ms]">
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
    </section>
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
    <section className="border-b border-[var(--line)] bg-[var(--paper-sunken)]">
      <Container wide>
        <ul className="grid gap-x-8 gap-y-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <li
              key={item.label}
              className="flex items-center gap-3 text-sm text-[var(--ink-muted)]"
            >
              <item.icon className="size-4 shrink-0 text-clay-700" />
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
  const [hero, ...rest] = destinations;
  return (
    <section className="py-24 sm:py-32">
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

        {/* Asymmetric editorial grid. Cell maths: a 4x3 grid is 12 cells —
            the hero tile takes 4 (2x2), six tiles take one each, and the
            last tile takes 2. That fills the grid exactly, with no ragged
            hole, while still reading as composed rather than uniform. */}
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-3">
          <DestinationTile
            destination={hero}
            size="lg"
            className="min-h-[22rem] sm:col-span-2 lg:row-span-2 lg:min-h-[30rem]"
          />
          {rest.map((d, i) => (
            <DestinationTile
              key={d.slug}
              destination={d}
              size={i === rest.length - 1 ? "lg" : "sm"}
              className={
                i === rest.length - 1
                  ? "min-h-[15rem] sm:col-span-2"
                  : "min-h-[15rem]"
              }
            />
          ))}
        </div>
      </Container>
    </section>
  );
}

/* =========================================================== FeaturedTours */

function FeaturedTours({ tours }: { tours: CatalogueTour[] }) {
  return (
    <section className="on-dark relative overflow-hidden bg-forest-900 py-24 sm:py-32">
      <div aria-hidden className="contours absolute inset-0 opacity-[0.07]" />
      <Container wide className="relative">
        <SectionHead
          eyebrow="Tours & Safaris"
          title="Guided by people who live there"
          lede="These are sample listings for development only. Provider details, permissions, availability and prices must be verified before launch."
          action={
            <Button
              href="/tours"
              variant="outline"
              className="border-forest-400/40 text-bone-50 hover:bg-bone-50 hover:text-forest-900"
            >
              Browse all safaris
              <ArrowRight className="size-4" />
            </Button>
          }
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tours.slice(0, 3).map((tour, i) => (
            <TourCard
              key={tour.slug}
              tour={tour}
              priority={i === 0}

            />
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ========================================================== StaysAndFleet */

function StaysAndFleet({
  hotels,
  vehicles,
}: {
  hotels: CatalogueHotel[];
  vehicles: CatalogueVehicle[];
}) {
  return (
    <section className="py-24 sm:py-32">
      <Container wide className="grid gap-16 lg:grid-cols-2 lg:gap-12">
        <div>
          <SectionHead
            eyebrow="Hotels & Concierge"
            title="Somewhere good to land"
            lede="Beach lodges, tented camps and city apartments, with our concierge desk behind every stay."
          />
          <div className="mt-10 flex flex-col gap-4">
            {hotels.slice(0, 3).map((hotel) => (
              <HotelCard key={hotel.slug} hotel={hotel} />
            ))}
          </div>
          <Button href="/hotels" variant="quiet" className="mt-8">
            See all stays
            <ArrowRight className="size-4" />
          </Button>
        </div>

        <div>
          <SectionHead
            eyebrow="Car Hire"
            title="A vehicle that suits the road"
            lede="Self-drive or chauffeured, from compact city SUVs to safari-rigged 4x4s."
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {vehicles.slice(0, 4).map((v) => (
              <VehicleCard key={v.slug} vehicle={v} />
            ))}
          </div>
          <Button href="/cars" variant="quiet" className="mt-8">
            See the full fleet
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </Container>
    </section>
  );
}

/* =============================================================== Transfers */

function Transfers() {
  return (
    <section className="relative overflow-hidden bg-clay-100 py-24 sm:py-32">
      <div
        aria-hidden
        className="contours absolute inset-0 opacity-[0.05] [background-size:800px_800px]"
      />
      <Container wide className="relative grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <Eyebrow>Airport Transfers</Eyebrow>
          <h2 className="mt-5 text-display-sm text-clay-900">
            Someone is already waiting when you land
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-clay-800/80">
            Rwanda airport routes, providers and prices are still being
            configured. No transfer service is available to book yet.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/contact" variant="primary" size="lg">
              Get launch updates
            </Button>
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-clay-700/15 bg-bone-50/80 p-8 text-center text-sm text-bone-700">
          Rwanda transfer zones and RWF rates will be added after local
          providers and prices are confirmed.
        </div>
      </Container>
    </section>
  );
}

/* =================================================================== WhyUs */

function WhyUs() {
  return (
    <section className="py-24 sm:py-32">
      <Container wide>
        <SectionHead
          eyebrow="Why book with us"
          title="A Booking That Actually Holds — Guaranteed."
          align="center"
          lede="This booking platform is being adapted for Rwanda. Provider checks, payment and fulfilment processes must be confirmed before launch."
        />

        <ul className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {whyUs.map((item) => (
            <li key={item.title} className="border-t border-[var(--line-strong)] pt-6">
              <h3 className="text-xl">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
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
    <section className="border-y border-[var(--line)] bg-[var(--paper-sunken)] py-24 sm:py-32">
      <Container wide>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow>Reviews</Eyebrow>
            <h2 className="mt-2 text-display-sm">What travellers told us</h2>
          </div>
          <Rating value={rating.value} count={rating.count} className="text-base" />
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {reviews.map((r) => (
            <figure
              key={r.id}
              className="flex flex-col rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-7"
            >
              <Rating value={r.rating} />
              <blockquote className="mt-4 flex-1 text-[0.9375rem] leading-relaxed text-[var(--ink)]">
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

/* ============================================================== ClosingCta */

async function ClosingCta() {
  return (
    <section className="on-dark relative overflow-hidden bg-forest-950 py-28 sm:py-36">
      <div aria-hidden className="contours absolute inset-0 opacity-[0.08]" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ember-500/12 blur-[130px]"
      />
      <Container className="relative text-center">
        <Badge tone="ember">Free to enquire · No booking fee</Badge>
        <h2 className="mx-auto mt-7 max-w-3xl text-display text-bone-50">
          Share your dates. We handle the rest.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-forest-100/80">
          Rwanda itinerary ideas are in progress. This preview uses sample
          listings and is not accepting real bookings yet.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button href="/tours" variant="accent" size="lg">
            Start planning
            <ArrowRight className="size-4" />
          </Button>
          <Button
            href="/contact"
            variant="outline"
            size="lg"
            className="border-forest-400/40 text-bone-50 hover:bg-bone-50 hover:text-forest-900"
          >
            Talk to a person
          </Button>
        </div>
        <p className="mt-8 text-sm text-forest-300">
          Contact and booking channels are not configured.
        </p>
      </Container>
    </section>
  );
}
