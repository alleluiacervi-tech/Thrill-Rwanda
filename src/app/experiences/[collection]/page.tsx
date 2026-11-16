import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { ServiceEnquiryForm } from "@/components/booking/service-enquiry-form";
import {
  Arranges,
  FaqSection,
  JourneyHero,
  PairWith,
  RequestSection,
  Story,
} from "@/components/journey/sections";
import { TourCard } from "@/components/cards/listing-cards";
import { Button } from "@/components/ui/button";
import { Container, SectionHead } from "@/components/ui/primitives";
import { listTours } from "@/lib/catalogue";
import { collectionBySlug } from "@/lib/journeys";
import { requirePublicService } from "@/lib/publication";
import { getSite } from "@/lib/settings";

// The request form needs a fresh submission token on every load.
export const dynamic = "force-dynamic";

type Params = Promise<{ collection: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { collection: slug } = await params;
  const collection = collectionBySlug(slug);
  if (!collection) return { title: "Experience not found" };
  return {
    title: `${collection.name} in Rwanda`,
    description: collection.lede,
    alternates: { canonical: `/experiences/${collection.slug}` },
  };
}

export default async function CollectionPage({ params }: { params: Params }) {
  const { collection: slug } = await params;
  const collection = collectionBySlug(slug);
  if (!collection) notFound();
  await requirePublicService("TRIP");
  const [{ publications }, tours] = await Promise.all([getSite(), listTours()]);
  // Approved offers filed under this collection in the tour form.
  const offers = tours.filter((tour) => tour.collection === collection.journey);

  return (
    <PageShell overHero>
      <JourneyHero
        eyebrow={collection.eyebrow}
        title={collection.title}
        titleEm={collection.titleEm}
        lede={collection.lede}
        image={collection.image}
        imagePosition={collection.imagePosition}
        crumbs={[
          { label: "Tours & Experiences", href: "/experiences" },
          { label: collection.name },
        ]}
        facts={collection.facts}
        primary={{ href: "#request", label: "Start your request", service: "TRIP" }}
        secondary={{ href: "/how-it-works", label: "How it works" }}
      />

      <Story
        eyebrow="The idea"
        heading={collection.story.heading}
        headingEm={collection.story.headingEm}
        body={collection.story.body}
        list={collection.story.list}
        image={collection.story.image}
        imageAlt={collection.story.imageAlt}
        imagePosition={collection.story.imagePosition}
        caption={collection.story.caption}
      />

      <Arranges
        eyebrow="What we arrange"
        title={
          <>
            Every detail, <em>checked for your dates</em>
          </>
        }
        lede="Each part below is requested from the supplier, confirmed in writing and listed on your quote before you commit."
        points={collection.arranges}
      />

      {offers.length > 0 ? (
        <section className="py-20 sm:py-28">
          <Container wide>
            <SectionHead
              eyebrow="Ready-made"
              title={
                <>
                  A place to <em>start</em>
                </>
              }
              lede="Use one of these as it stands, or as the outline for something of your own."
              action={
                offers.length > 3 ? (
                  <Button href={`/tours?collection=${collection.journey}`} variant="outline">
                    See all {offers.length}
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                ) : undefined
              }
            />
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-6">
              {offers.slice(0, 3).map((tour) => (
                <TourCard key={tour.slug} tour={tour} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      <RequestSection
        title={
          <>
            Tell us what <em>you have in mind</em>
          </>
        }
        lede="A request starts the conversation. It does not reserve anything or take a payment."
      >
        <ServiceEnquiryForm
          submissionKey={randomUUID()}
          journey={collection.journey}
          context={collection.requestContext}
        />
      </RequestSection>

      <PairWith keys={collection.pairs} publications={publications} />

      <FaqSection items={collection.faqs} />
    </PageShell>
  );
}
