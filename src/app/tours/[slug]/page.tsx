import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, Clock3, MapPin, ShieldCheck, Users, X } from "lucide-react";
import { ListingGallery } from "@/components/ui/listing-gallery";
import { PageShell, Breadcrumbs } from "@/components/layout/page-shell";
import { BookingPanel } from "@/components/booking/booking-panel";
import { TourCard } from "@/components/cards/listing-cards";
import {
  Badge,
  Container,
  Eyebrow,
  Rating,
  SectionHead,
} from "@/components/ui/primitives";
import { getTour, listTours } from "@/lib/catalogue";
import {
  RESIDENCY_HINTS,
  RESIDENCY_LABELS,
  allRates,
  hasTieredPricing,
} from "@/lib/residency";
import { getSiteSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/utils";

import { getSite } from "@/lib/settings";

// Prebuild the pages that exist now; any listing added later renders on its first visit.
export const revalidate = 300;

export async function generateStaticParams() {
  try {
    return (await listTours()).map((x) => ({ slug: x.slug }));
  } catch {
    // An unreachable database at build time should not fail the deploy.
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const site = await getSite();
  const { slug } = await params;
  const tour = await getTour(slug);
  if (!tour) return { title: "Tour not found" };

  return {
    title: tour.name,
    description: tour.summary,
    alternates: { canonical: `/tours/${tour.slug}` },
    openGraph: {
      title: `${tour.name} · ${site.name}`,
      description: tour.summary,
      type: "article",
    },
  };
}

export default async function TourDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const site = await getSite();
  const { slug } = await params;
  const tour = await getTour(slug);
  if (!tour) notFound();

  const itinerary = tour.itinerary.split(/\n+/).filter(Boolean).map((body,i)=>({day:i+1,title:`Day ${i+1}`,body}));
  const { depositPercent } = await getSiteSettings();
  const related = (await listTours()).filter((t) => t.slug !== tour.slug).slice(0, 3);

  /* Step 19: structured data so this page can win a rich result. */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: tour.name,
    description: tour.summary,
    touristType: "Safari",
    itinerary: {
      "@type": "ItemList",
      numberOfItems: tour.durationDays,
    },
    provider: {
      "@type": "TravelAgency",
      name: site.legalName,
      telephone: site.contact.phone,
      address: site.contact.address,
    },
    // Only real reviews: Google penalises structured ratings a page cannot back up.
    ...(tour.rating !== null
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: tour.rating, reviewCount: tour.reviews } }
      : {}),
  };

  return (
    <PageShell overHero>
      <script
        type="application/ld+json"
        // Data is authored above, not user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ---------------------------------------------------------- Gallery */}
      <section className="on-dark relative -mt-[4.5rem] bg-forest-950 lg:-mt-24">
        <ListingGallery
          seed={tour.slug}
          images={tour.images}
          alt={`${tour.name}, ${tour.destination}`}
          className="h-[62svh] min-h-[26rem] w-full"
        >
          <div aria-hidden className="scrim-t absolute inset-x-0 top-0 h-44" />
        </ListingGallery>
        <Container
          wide
          className="pointer-events-none absolute inset-x-0 bottom-0 pb-10"
        >
          <div className="pointer-events-auto">
            <Breadcrumbs
              items={[
                { label: "Tours & Safaris", href: "/tours" },
                { label: tour.name },
              ]}
              className="mb-6 text-bone-100/75"
            />
            <div className="flex flex-wrap items-center gap-3">
              {tour.badge ? <Badge tone="sun">{tour.badge}</Badge> : null}
              <span className="inline-flex items-center gap-1.5 text-sm text-bone-100">
                <MapPin className="size-4 text-sun-400" />
                {tour.destination}
              </span>
            </div>
            <h1 className="on-media mt-4 max-w-4xl text-display text-white">
              {tour.name}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-bone-100/80">
              {tour.rating !== null ? <Rating value={tour.rating} count={tour.reviews} /> : null}
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-4 text-sun-400" />
                {tour.durationDays} days
                {tour.nights > 0 ? ` / ${tour.nights} nights` : ""}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4 text-sun-400" />
                Max {tour.maxParticipants}
              </span>
            </div>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------ Body */}
      <Container wide className="grid gap-14 py-16 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
        <div className="min-w-0">
          <p className="text-lg leading-relaxed text-[var(--ink-muted)]">
            {tour.summary}
          </p>
          {tour.pickupInfo ? (
            <p className="mt-4 flex items-start gap-2 text-sm text-[var(--ink-muted)]">
              <MapPin className="mt-0.5 size-4 shrink-0 text-clay-600" />
              <span>{tour.pickupInfo}</span>
            </p>
          ) : null}

          <ul className="mt-8 flex flex-wrap gap-2">
            {tour.activities.map((a) => (
              <li
                key={a}
                className="rounded-full border border-[var(--line-strong)] px-4 py-1.5 text-sm text-[var(--ink-muted)]"
              >
                {a}
              </li>
            ))}
          </ul>

          {site.publications.TRIP === "DIRECT" && hasTieredPricing(tour) ? (
            <section className="mt-16">
              <Eyebrow>Rates</Eyebrow>
              <h2 className="mt-5 text-3xl">What it costs, per person</h2>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--ink-muted)]">
                Park fees differ by residency, so the price does too. Bring an ID or passport that
                matches — the operator checks it on the day.
              </p>
              <dl className="mt-8 grid gap-4 sm:grid-cols-3">
                {allRates(tour).map(({ residency, perPersonMinor }) => (
                  <div
                    key={residency}
                    className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-5"
                  >
                    <dt className="text-2xs uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                      {RESIDENCY_LABELS[residency]}
                    </dt>
                    <dd className="tnum mt-2 font-display text-2xl font-semibold">
                      {formatMoney(perPersonMinor)}
                    </dd>
                    <dd className="mt-1.5 text-2xs leading-relaxed text-[var(--ink-muted)]">
                      {RESIDENCY_HINTS[residency]}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <section className="mt-10"><h2 className="text-2xl">Who this trip suits</h2><p className="mt-3 whitespace-pre-wrap">{tour.suitability}</p></section>
          {itinerary.length ? (
            <section className="mt-16">
              <Eyebrow>Itinerary</Eyebrow>
              <h2 className="mt-5 text-3xl">Day by day</h2>
              <ol className="mt-8 space-y-0">
                {itinerary.map((day, i) => (
                  <li
                    key={day.day}
                    className="relative flex gap-6 pb-10 last:pb-0"
                  >
                    {/* connector line */}
                    {i < itinerary.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute left-[1.4375rem] top-12 h-[calc(100%-2.5rem)] w-px bg-[var(--line-strong)]"
                      />
                    )}
                    <span className="tnum relative z-10 grid size-12 shrink-0 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--paper-raised)] font-display text-lg font-semibold">
                      {day.day}
                    </span>
                    <div className="min-w-0 pt-1.5">
                      <h3 className="text-xl">{day.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
                        {day.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="mt-16 grid gap-10 sm:grid-cols-2">
            <div>
              <h3 className="text-xl">What&rsquo;s included</h3>
              <ul className="mt-5 space-y-3">
                {tour.inclusions.map((item) => (
                  <li key={item} className="flex gap-3 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-forest-600" />
                    <span className="text-[var(--ink-muted)]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xl">Not included</h3>
              <ul className="mt-5 space-y-3">
                {tour.exclusions.map((item) => (
                  <li key={item} className="flex gap-3 text-sm">
                    <X className="mt-0.5 size-4 shrink-0 text-[var(--ink-faint)]" />
                    <span className="text-[var(--ink-muted)]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="mt-16 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-sunken)] p-7">
            <h3 className="flex items-center gap-2.5 text-lg">
              <ShieldCheck className="size-5 text-clay-700" />
              Operated by {tour.provider}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
              Your written quote identifies the operator, applicable conditions and payment schedule. Availability and confirmation follow the checks for your arrangement.
            </p>
          </section>
        </div>

        {/* ---------------------------------------------------- Booking rail */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <BookingPanel
            title={tour.name}
            slug={tour.slug}
            unitLabel="per person"
            priceMinor={tour.priceFrom}
            maxGuests={tour.maxParticipants}
            durationDays={tour.durationDays}
            mode="TOUR"
            depositPercent={depositPercent}
            rates={{
              priceMinor: tour.priceMinor,
              priceResidentMinor: tour.priceResidentMinor,
              priceNonResidentMinor: tour.priceNonResidentMinor,
            }}
          />
        </aside>
      </Container>

      {/* --------------------------------------------------------- Related */}
      <section className="border-t border-[var(--line)] py-20">
        <Container wide>
          <SectionHead
            eyebrow="You might also like"
            title="Other departures"
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((t) => (
              <TourCard key={t.slug} tour={t} />
            ))}
          </div>
        </Container>
      </section>
    </PageShell>
  );
}

