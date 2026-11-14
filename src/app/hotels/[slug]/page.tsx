import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, ShieldCheck, Users } from "lucide-react";
import { ListingGallery } from "@/components/ui/listing-gallery";
import { PageShell, Breadcrumbs } from "@/components/layout/page-shell";
import { BookingPanel } from "@/components/booking/booking-panel";
import { HotelCard } from "@/components/cards/listing-cards";
import {
  Badge,
  Container,
  Eyebrow,
  Rating,
  SectionHead,
} from "@/components/ui/primitives";
import { ChooseRoomButton } from "@/components/booking/choose-room-button";
import { getHotel, listHotels } from "@/lib/catalogue";
import { getSiteSettings } from "@/lib/settings";
import { getSite } from "@/lib/settings";
import { formatMoney } from "@/lib/utils";

// Prebuild the pages that exist now; any listing added later renders on its first visit.
export const revalidate = 300;

export async function generateStaticParams() {
  try {
    return (await listHotels()).map((x) => ({ slug: x.slug }));
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
  const hotel = await getHotel(slug);
  if (!hotel) return { title: "Property not found" };

  return {
    title: hotel.name,
    description: hotel.summary,
    alternates: { canonical: `/hotels/${hotel.slug}` },
    openGraph: { title: `${hotel.name} · ${site.name}`, description: hotel.summary },
  };
}

export default async function HotelDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const site = await getSite();
  const { slug } = await params;
  const hotel = await getHotel(slug);
  if (!hotel) notFound();

  const rooms = hotel.rooms;
  const { depositPercent } = await getSiteSettings();
  const related = (await listHotels()).filter((h) => h.slug !== hotel.slug).slice(0, 2);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: hotel.name,
    description: hotel.summary,
    ...(hotel.stars ? { starRating: { "@type": "Rating", ratingValue: hotel.stars } } : {}),
    address: { "@type": "PostalAddress", addressLocality: hotel.location, addressCountry: "KE" },
    amenityFeature: hotel.amenities.map((a) => ({
      "@type": "LocationFeatureSpecification",
      name: a,
    })),
    ...(hotel.rating !== null
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: hotel.rating, reviewCount: hotel.reviews } }
      : {}),
  };

  return (
    <PageShell overHero>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="on-dark relative -mt-[4.5rem] bg-forest-950 lg:-mt-24">
        <ListingGallery
          seed={hotel.slug}
          images={hotel.images}
          alt={hotel.name}
          className="h-[58svh] min-h-[24rem] w-full"
        >
          <div aria-hidden className="scrim-t absolute inset-x-0 top-0 h-44" />
        </ListingGallery>
        <Container
          wide
          className="pointer-events-none absolute inset-x-0 bottom-0 pb-10"
        >
          <div className="pointer-events-auto">
            <Breadcrumbs
              items={[{ label: "Hotels", href: "/hotels" }, { label: hotel.name }]}
              className="mb-6 text-bone-100/75"
            />
            <div className="flex flex-wrap items-center gap-3">
              {hotel.badge ? <Badge tone="sun">{hotel.badge}</Badge> : null}
              {hotel.stars ? (
                <span className="text-sm text-sun-400" aria-label={`${hotel.stars} star`}>
                  {"★".repeat(hotel.stars)}
                </span>
              ) : null}
            </div>
            <h1 className="on-media mt-4 max-w-4xl text-display text-white">
              {hotel.name}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-bone-100/80">
              {hotel.rating !== null ? <Rating value={hotel.rating} count={hotel.reviews} /> : null}
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4 text-sun-400" />
                {hotel.location}
              </span>
            </div>
          </div>
        </Container>
      </section>

      <Container wide className="grid gap-14 py-16 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
        <div className="min-w-0">
          <p className="text-lg leading-relaxed text-[var(--ink-muted)]">
            {hotel.summary}
          </p>

          <section className="mt-14">
            <Eyebrow>Amenities</Eyebrow>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {hotel.amenities.map((a) => (
                <li
                  key={a}
                  className="rounded-[var(--radius-inset)] border border-[var(--line)] px-4 py-3 text-sm text-[var(--ink-muted)]"
                >
                  {a}
                </li>
              ))}
            </ul>
          </section>

          {rooms.length > 0 ? (
            <section className="mt-16">
              <Eyebrow>Rooms</Eyebrow>
              <h2 className="mt-5 text-3xl">Choose a room</h2>
              <div className="mt-8 space-y-4">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xl">{room.name}</h3>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="size-3.5" />
                          Sleeps {room.capacity}
                        </span>
                      </p>
                      <ul className="mt-4 flex flex-wrap gap-1.5">
                        {room.features.map((f) => (
                          <li
                            key={f}
                            className="rounded-full bg-[color-mix(in_oklab,var(--ink)_5%,transparent)] px-2.5 py-1 text-2xs text-[var(--ink-muted)]"
                          >
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tnum font-display text-2xl font-semibold">
                        {formatMoney(room.pricePerNight)}
                      </p>
                      <p className="text-2xs text-[var(--ink-faint)]">
                        per night
                      </p>
                      <ChooseRoomButton roomId={room.id} roomName={room.name} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-16 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-sunken)] p-7">
            <h3 className="flex items-center gap-2.5 text-lg">
              <ShieldCheck className="size-5 text-clay-700" />
              Managed by {hotel.provider}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
              Licence and insurance verified by {site.name}. Rooms are
              held against live availability, and your payment is released to
              the property only after check-in.
            </p>
          </section>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <BookingPanel
            title={hotel.name}
            slug={hotel.slug}
            unitLabel="per night"
            priceMinor={hotel.priceFrom}
            maxGuests={hotel.maxGuests}
            mode="ROOM"
            depositPercent={depositPercent}
            rooms={rooms.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity, pricePerNight: r.pricePerNight }))}
          />
        </aside>
      </Container>

      <section className="border-t border-[var(--line)] py-20">
        <Container wide>
          <SectionHead eyebrow="Nearby" title="Other places to stay" />
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {related.map((h) => (
              <HotelCard key={h.slug} hotel={h} />
            ))}
          </div>
        </Container>
      </section>
    </PageShell>
  );
}
