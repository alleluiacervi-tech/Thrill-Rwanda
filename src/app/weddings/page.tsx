import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarCheck, MapPin, ReceiptText, ShieldCheck, Users, UsersRound } from "lucide-react";
import { Breadcrumbs, HillsEdge, PageShell } from "@/components/layout/page-shell";
import { VenueKinds, WeddingDateChecker } from "@/components/booking/wedding-date-checker";
import { WeddingRequestForm } from "@/components/booking/wedding-request-form";
import {
  Arranges,
  FaqSection,
  PairWith,
  RequestSection,
  Story,
} from "@/components/journey/sections";
import { Button } from "@/components/ui/button";
import { Media } from "@/components/ui/media";
import { Badge, Container, Eyebrow } from "@/components/ui/primitives";
import { todayInRwanda } from "@/lib/flight-enquiry-schema";
import { journeyImages, type Faq, type Point } from "@/lib/journeys";
import { requirePublicService } from "@/lib/publication";
import { getSite } from "@/lib/settings";
import { capacityLabel, venueContext } from "@/lib/venue-rules";
import { listVenues, publishedVenue } from "@/lib/venues";

// The request form needs a fresh submission token on every load.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wedding venues & events in Rwanda",
  description:
    "Reserve a wedding venue in Rwanda with guest transport, rooms and the honeymoon planned by one travel desk. Dates checked and confirmed by written quote.",
  alternates: { canonical: "/weddings" },
};

/** Under the date checker: what a request sets in motion. */
const assurances = [
  { icon: CalendarCheck, title: "Your date, checked", body: "With venues that are free that day" },
  { icon: UsersRound, title: "Every guest looked after", body: "Transport and rooms around the day" },
  { icon: ReceiptText, title: "One written quote", body: "Costs, inclusions and venue terms" },
  { icon: ShieldCheck, title: "Nothing reserved or charged", body: "Until you accept" },
];

const arranges: Point[] = [
  { icon: "calendar", title: "The venue, for your date", body: "We check the date with the venue and confirm the reservation and its terms in writing." },
  { icon: "users", title: "Space for your guest list", body: "Capacity, layout and timings checked against the number of people you are expecting." },
  { icon: "utensils", title: "Catering and décor", body: "Coordinated with the venue and its suppliers, and itemised on your quote." },
  { icon: "bus", title: "Guest transport", body: "Coaches and cars timed around the ceremony, the reception and the airport." },
  { icon: "bed", title: "Rooms for your guests", body: "Rooms requested near the venue for the family and friends travelling in." },
  { icon: "heart", title: "The honeymoon", body: "Planned alongside the wedding, so the day after is already taken care of." },
];

const occasions = [
  "Weddings",
  "Introductions & engagements",
  "Anniversaries",
  "Family celebrations",
  "Receptions & gala dinners",
];

const faqs: Faq[] = [
  ["Do you own the venues?", "We reserve venues on your behalf. Your quote names the venue, what the reservation covers and the venue's own terms."],
  ["Does sending a request hold our date?", "No. A request starts the check. The date is held only once the venue confirms it and the payment stated in your quote has been received."],
  ["Can you look after guests arriving from abroad?", "Yes. Flights, airport pickups and rooms can be added to the same request and returned on the same quote."],
  ["How early should we ask?", "As early as you can. Popular dates go first, so send your preferred date and one or two alternatives."],
  ["Can you plan the honeymoon too?", "Yes. Tell us in your request and we plan it alongside the wedding, with one desk that knows the dates."],
];

export default async function WeddingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePublicService("EVENT");
  const params = await searchParams;
  const [{ publications }, venues, chosen] = await Promise.all([
    getSite(),
    listVenues(),
    // A venue card links back here with `?venue=`, so the request starts from that venue.
    typeof params.venue === "string" ? publishedVenue(params.venue) : null,
  ]);

  return (
    <PageShell overHero>
      <section className="on-dark relative -mt-[4.5rem] bg-[#0b1611] pb-20 pt-[7.5rem] sm:pb-24 lg:-mt-24 lg:pb-28 lg:pt-44">
        {/* On narrow screens the photograph stays in the top band, so it is not blown up behind the checker. */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-[36rem] overflow-hidden sm:h-[44rem] lg:inset-0 lg:h-auto">
          <Image src={journeyImages.weddings} alt="" fill preload sizes="100vw" className="object-cover object-[center_45%]" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgb(11 22 17 / 0.85) 0%, rgb(11 22 17 / 0.5) 45%, rgb(11 22 17 / 0.1) 100%), linear-gradient(to top, rgb(11 22 17 / 0.92) 0%, rgb(11 22 17 / 0.3) 45%, transparent 70%)",
            }}
          />
          <div className="scrim-t absolute inset-x-0 top-0 h-40" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-linear-to-t from-[#0b1611] to-transparent lg:hidden" />
        </div>

        <Container wide className="relative">
          <Breadcrumbs items={[{ label: "Weddings & Events" }]} className="on-media mb-7 text-white/90" />
          <Eyebrow className="on-media text-sun-300">Weddings & events</Eyebrow>
          <h1 className="on-media mt-3 max-w-[14ch] text-display text-white">
            Your wedding, <em className="text-sun-400">held in the hills.</em>
          </h1>
          <p className="on-media mt-5 max-w-xl text-base leading-relaxed text-white/90 sm:text-lg">
            Tell us the date and the day you imagine. We reserve the venue, bring your guests to it and look after them, through to the honeymoon.
          </p>

          <div className="mt-10 sm:mt-12">
            <WeddingDateChecker today={todayInRwanda()} />
          </div>

          <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
            {assurances.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-sun-400 ring-1 ring-white/15">
                  <Icon className="size-[1.1rem]" aria-hidden />
                </span>
                <span className="on-media pt-0.5">
                  <span className="block text-[0.95rem] font-semibold leading-snug text-white">{title}</span>
                  <span className="mt-0.5 block text-sm leading-snug text-white/75">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </Container>
        <HillsEdge />
      </section>

      {/* ---------------------------------------------------------- Venues */}
      <section id="venues" className="scroll-mt-24 py-20 sm:py-28">
        <Container wide>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-10">
            <div className="max-w-2xl">
              <Eyebrow>Kinds of venue</Eyebrow>
              <h2 className="mt-3 text-display-sm">
                Find the setting <em>that feels like you</em>
              </h2>
              <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-[var(--ink-muted)]">
                Choose the kind of place you picture and we start your request
                with it. We come back with venues that are free on your date.
              </p>
            </div>
            <Button href="#request" variant="outline" className="shrink-0">
              Check a date
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>

          <div className="mt-12 lg:mt-16">
            <VenueKinds />
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------ Catalogue */}
      {venues.length > 0 ? (
        <section className="on-dark relative overflow-hidden bg-forest-950 py-20 sm:py-28">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(50% 70% at 88% 0%, rgb(47 128 96 / 0.5), transparent 70%)",
            }}
          />
          <div aria-hidden className="contours-light absolute inset-0 opacity-[0.05]" />
          <Container wide className="relative">
            <div className="max-w-2xl">
              <Eyebrow>Venues</Eyebrow>
              <h2 className="mt-3 text-display-sm text-white">
                Places we can <em className="text-sun-400">reserve for you</em>
              </h2>
              <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-forest-100/80">
                Choose one to ask about. We check your date with the venue and
                come back with what is included, the cost and the terms, in
                writing.
              </p>
            </div>

            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-6">
              {venues.map((venue) => (
                <li key={venue.slug} className="flex">
                  <article className="group relative flex w-full flex-col overflow-hidden rounded-[var(--radius-panel)] bg-white text-[var(--color-bone-900)] ring-1 ring-white/10 transition-transform duration-500 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-1">
                    <Media
                      seed={venue.slug}
                      src={venue.image}
                      alt={venue.name}
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="aspect-[4/3] w-full shrink-0"
                    >
                      <Badge tone="sun" className="absolute left-4 top-4">
                        {venue.kind}
                      </Badge>
                    </Media>

                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="text-[1.625rem] leading-[1.1] text-bone-900">
                        <Link
                          href={`/weddings?venue=${venue.slug}#request`}
                          className="after:absolute after:inset-0"
                        >
                          {venue.name}
                        </Link>
                      </h3>
                      <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-bone-600">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-4 text-clay-600" aria-hidden />
                          {venue.location}
                        </span>
                        <span className="tnum inline-flex items-center gap-1.5">
                          <Users className="size-4 text-clay-600" aria-hidden />
                          {capacityLabel(venue.capacity)}
                        </span>
                      </p>
                      <p className="mt-3 line-clamp-3 text-[0.9375rem] leading-relaxed text-bone-600">
                        {venue.description}
                      </p>

                      {venue.features.length ? (
                        <ul className="mt-4 flex flex-wrap gap-1.5">
                          {venue.features.slice(0, 4).map((feature) => (
                            <li
                              key={feature}
                              className="rounded-full bg-bone-100 px-2.5 py-1 text-xs text-bone-700"
                            >
                              {feature}
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      <p className="mt-auto flex items-center gap-1.5 pt-6 text-sm font-semibold text-forest-800">
                        Check a date here
                        <ArrowRight
                          className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                          aria-hidden
                        />
                      </p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      <Arranges
        eyebrow="What we arrange"
        title={
          <>
            The venue, and <em>everyone coming to it</em>
          </>
        }
        lede="A wedding is a venue and a hundred journeys. We handle both, and put every part on one written quote."
        points={arranges}
      />

      <Story
        eyebrow="And afterwards"
        heading="From the vows"
        headingEm="to the honeymoon."
        body={[
          "The same desk that reserves your venue can plan the days that follow: a lakeshore room on Kivu, a lodge above the forest, a morning with the gorillas.",
          "Because we already know your dates and your guests' flights, the honeymoon is one more line on a plan that is already in hand.",
        ]}
        list={[
          "One request for the wedding and the honeymoon",
          "Guest flights, transfers and rooms on the same quote",
          "One person to call, before and after the day",
        ]}
        image="/media/photos/lake-kivu-fishermen.jpg"
        imageAlt="A fishing boat beside an island on Lake Kivu"
        imagePosition="center 55%"
        caption="Lake Kivu"
        flip
      >
        {publications.TRIP !== "HIDDEN" ? (
          <Button href="/experiences/honeymoon" variant="primary" className="mt-8">
            See honeymoons
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : null}
      </Story>

      {/* ------------------------------------------------------- Occasions */}
      <section className="border-y border-[var(--line)] py-12">
        <Container wide className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-10">
          <p className="shrink-0 font-display text-2xl leading-tight">
            Not only weddings.
          </p>
          <ul className="flex flex-wrap gap-2.5">
            {occasions.map((occasion) => (
              <li
                key={occasion}
                className="rounded-full border border-[var(--line-strong)] px-4 py-2 text-sm"
              >
                {occasion}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <RequestSection
        title={
          <>
            Tell us the date, <em>and the day you imagine</em>
          </>
        }
        lede="Your preferred date, the number of guests and the kind of venue are enough to begin. A request does not reserve a venue or take a payment."
        steps={[
          ["Send your date and guest list", "Add one or two alternative dates if you can."],
          ["We check venues, then quote", "Availability, what is included, fees and the venue's terms, in writing."],
          ["You decide", "The date is held once you accept and the stated payment is received."],
        ]}
      >
        {chosen ? (
          <p className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-forest-300 bg-forest-100 px-5 py-4 text-[0.9375rem] text-forest-900">
            <span>
              You are asking about <strong>{chosen.name}</strong>, {chosen.location}.
            </span>
            <Link href="/weddings#request" className="font-medium underline underline-offset-4">
              Ask about any venue instead
            </Link>
          </p>
        ) : null}
        <WeddingRequestForm
          // A different venue is a different request: start the form afresh.
          key={chosen?.slug ?? "any"}
          submissionKey={randomUUID()}
          today={todayInRwanda()}
          context={chosen ? venueContext(chosen) : "Wedding venue reservation"}
          initial={chosen ? { venueStyle: chosen.kind, location: chosen.location } : undefined}
        />
      </RequestSection>

      <PairWith
        keys={["honeymoon", "flights", "transport"]}
        publications={publications}
      />

      <FaqSection items={faqs} />
    </PageShell>
  );
}
