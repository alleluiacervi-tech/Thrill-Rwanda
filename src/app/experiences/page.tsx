import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { ServiceEnquiryForm } from "@/components/booking/service-enquiry-form";
import { DestinationPanel, TourCard } from "@/components/cards/listing-cards";
import {
  JourneyHero,
  PairWith,
  RequestSection,
} from "@/components/journey/sections";
import { NextEdition } from "@/components/journey/editions";
import { TemberaBand } from "@/components/journey/tembera-band";
import { listEditions } from "@/lib/departures";
import { Button } from "@/components/ui/button";
import { Container, SectionHead } from "@/components/ui/primitives";
import { destinationsWithCounts, listTours } from "@/lib/catalogue";
import { collections, journeyImages } from "@/lib/journeys";
import { requirePublicService } from "@/lib/publication";
import { getSite } from "@/lib/settings";
import { cn } from "@/lib/utils";

// The request form needs a fresh submission token on every load.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tours & Experiences in Rwanda",
  description:
    "Private and luxury tours, honeymoons, Kigali city tours and safaris across Rwanda, planned by one travel desk and confirmed by written quote.",
  alternates: { canonical: "/experiences" },
};

/** The bento: each way to travel as a photograph you can walk into. */
const ways = [
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
    name: "Gorillas, chimpanzees and the Big Five",
    blurb: "Approved itineraries across the national parks",
    image: journeyImages.safari,
    position: "center 40%",
  },
];

// Wide, narrow, narrow, wide: the row weights swap so the grid never reads as a table.
const spans = ["lg:col-span-7", "lg:col-span-5", "lg:col-span-5", "lg:col-span-7"];

export default async function ExperiencesPage() {
  await requirePublicService("TRIP");
  const [{ publications }, tours, destinations, nextEdition] = await Promise.all([
    getSite(),
    listTours(),
    destinationsWithCounts(),
    listEditions(1).then((list) => list[0]).catch(() => undefined),
  ]);

  return (
    <PageShell overHero>
      <JourneyHero
        eyebrow="Tours & Experiences"
        title="Every way to see"
        titleEm="the thousand hills."
        lede="Travel privately, celebrate a marriage, spend a day in Kigali or go looking for gorillas. Choose how you want to travel and we shape the journey around it."
        image={journeyImages.volcano}
        imagePosition="center 80%"
        crumbs={[{ label: "Tours & Experiences" }]}
        primary={{ href: "#request", label: "Plan a journey", service: "TRIP" }}
        secondary={{ href: "#ways", label: "Ways to travel" }}
      />

      {/* ------------------------------------------------------------ Ways */}
      <section id="ways" className="scroll-mt-24 py-20 sm:py-28">
        <Container wide>
          <SectionHead
            eyebrow="Ways to travel"
            title={
              <>
                Choose the journey <em>that fits you</em>
              </>
            }
            lede="Four ways in. Each one is planned for your dates and confirmed in a written quote."
          />

          <ul className="mt-12 grid gap-4 lg:mt-16 lg:grid-cols-12 lg:gap-5">
            {ways.map((way, i) => (
              <li key={way.href} className={spans[i % spans.length]}>
                <Link
                  href={way.href}
                  className="group relative flex min-h-[22rem] flex-col justify-end overflow-hidden rounded-[var(--radius-panel)] bg-forest-950 p-6 text-white sm:min-h-[26rem] sm:p-8 lg:min-h-[30rem]"
                >
                  <Image
                    src={way.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 58vw, 100vw"
                    preload={i === 0}
                    className="object-cover transition-transform duration-[1.6s] ease-out group-hover:scale-105"
                    style={way.position ? { objectPosition: way.position } : undefined}
                  />
                  <span aria-hidden className="scrim-deep absolute inset-0" />
                  <span aria-hidden className="scrim-t absolute inset-x-0 top-0 h-28" />

                  <span className="absolute inset-x-0 top-0 flex items-center justify-between p-6 sm:p-8">
                    <span className="tnum text-xs font-semibold text-white/85">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      aria-hidden
                      className="grid size-11 place-items-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur-md transition-colors duration-500 group-hover:bg-sun-500 group-hover:text-forest-950"
                    >
                      <ArrowUpRight className="size-[1.125rem]" />
                    </span>
                  </span>

                  <span className="relative text-2xs font-semibold uppercase tracking-[0.16em] text-sun-300">
                    {way.eyebrow}
                  </span>
                  <span
                    className={cn(
                      "on-media relative mt-2 max-w-xl font-display leading-[1.04]",
                      i % 4 === 0 || i % 4 === 3 ? "text-[2.25rem] sm:text-5xl" : "text-[2rem] sm:text-4xl",
                    )}
                  >
                    {way.name}
                  </span>
                  <span className="relative mt-3 flex items-center gap-2 text-[0.9375rem] text-white/85">
                    {way.blurb}
                    <ArrowRight
                      className="size-4 shrink-0 text-sun-400 transition-transform duration-300 group-hover:translate-x-1"
                      aria-hidden
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <TemberaBand>{nextEdition ? <NextEdition edition={nextEdition} /> : null}</TemberaBand>

      {/* ----------------------------------------------------- Destinations */}
      <section className="overflow-hidden py-20 sm:py-28">
        <Container wide>
          <SectionHead
            eyebrow="Where to go"
            title="Rwanda's parks and places"
            lede="Small enough to cross in a day, varied enough to fill a fortnight."
            action={
              <Button href="/tours" variant="outline">
                All tours & safaris
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            }
          />
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

      {/* ------------------------------------------------- Approved offers */}
      {tours.length > 0 ? (
        <section className="relative overflow-hidden bg-bone-100 py-20 sm:py-28">
          <div aria-hidden className="imigongo absolute inset-0 opacity-[0.035]" />
          <Container wide className="relative">
            <SectionHead
              eyebrow="Ready-made itineraries"
              title={
                <>
                  A place to <em>start the conversation</em>
                </>
              }
              lede="Review an itinerary, then ask for a quote for your dates."
              action={
                <Button href="/tours" variant="primary">
                  Browse all
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              }
            />
            <div className="no-bar -mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:mt-14 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0 lg:pb-0">
              {tours.slice(0, 3).map((tour) => (
                <TourCard key={tour.slug} tour={tour} className="w-[84vw] max-w-[22rem] shrink-0 snap-center sm:w-[44vw] lg:w-auto lg:max-w-none" />
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      <RequestSection
        title={
          <>
            Not sure yet? <em>Tell us the outline.</em>
          </>
        }
        lede="Dates, who is travelling and what you hope to see are enough to begin. A request does not reserve anything or take a payment."
      >
        <ServiceEnquiryForm submissionKey={randomUUID()} journey="SAFARI" />
      </RequestSection>

      <PairWith keys={["flights", "weddings", "groups"]} publications={publications} />
    </PageShell>
  );
}
