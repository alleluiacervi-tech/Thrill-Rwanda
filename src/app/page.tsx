import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Plane, MapPin, BedDouble, Car, Users } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { Container, Eyebrow, SectionHead } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { getSite } from "@/lib/settings";
import { destinationImages } from "@/lib/images";
import { listTours } from "@/lib/catalogue";
import { TourCard } from "@/components/cards/listing-cards";
import { type PublicService } from "@/lib/launch-rules";
export const revalidate = 300;
const services = [
  {
    service: "FLIGHT",
    title: "Flights",
    body: "Routes, travel dates and fare conditions checked before you decide.",
    href: "/flights",
    icon: Plane,
  },
  {
    service: "TRIP",
    title: "Tours & safaris",
    body: "Build a Rwanda itinerary around your interests, pace and group.",
    href: "/tours",
    icon: MapPin,
  },
  {
    service: "STAY",
    title: "Stays",
    body: "Ask about accommodation that fits your dates and preferences.",
    href: "/hotels",
    icon: BedDouble,
  },
  {
    service: "TRANSPORT",
    title: "Transport & transfers",
    body: "Plan airport pickups, onward journeys or car hire.",
    href: "/transfers",
    icon: Car,
  },
  {
    service: "GROUP",
    title: "Groups & corporate travel",
    body: "Share your brief for team travel, retreats and events.",
    href: "/corporate",
    icon: Users,
  },
] as const;
export default async function HomePage() {
  const site = await getSite();
  const tours = (await listTours()).slice(0, 3);
  const flight = site.publications.FLIGHT !== "HIDDEN";
  return (
    <PageShell overHero>
      <section className="on-dark relative isolate -mt-[4.5rem] lg:-mt-24 overflow-hidden bg-forest-950 pb-20 pt-40 sm:pb-28 sm:pt-48">
        <Image
          src={destinationImages["kigali"]}
          alt="Kigali, a starting point for journeys in Rwanda"
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-forest-950/95 via-forest-950/85 to-forest-950/55" />
        <Container wide>
          <div className="max-w-3xl">
            <Eyebrow className="text-sun-300">
              {flight
                ? "Flights · Rwanda · Thoughtful travel"
                : "Rwanda · Thoughtful travel"}
            </Eyebrow>
            <h1 className="mt-6 text-display text-bone-50">
              {site.heroTitle}
              <br />
              <span className="display-italic text-sun-300">
                {site.heroSubtitle}
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-bone-100">
              {site.heroText}
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Button
                href={flight ? "/flights" : "/enquire"}
                variant="accent"
                size="lg"
                data-service={flight ? "FLIGHT" : undefined}
                data-placement="HOME_HERO"
              >
                {flight ? "Request a flight quote" : "Plan your journey"}
                <ArrowRight className="size-4" />
              </Button>
              <Button
                href="/how-it-works"
                variant="outline"
                size="lg"
                className="border-bone-100/50 text-bone-50"
              >
                How it works
              </Button>
            </div>
            <p className="mt-6 text-sm text-bone-200">
              A request starts the conversation. Availability, payment and
              confirmation follow the checks in your quote.
            </p>
          </div>
        </Container>
      </section>
      <Container wide className="py-20">
        <SectionHead
          eyebrow="Start with your plans"
          title="One travel desk, from departure to arrival"
          lede="Choose what you need help with. Each service is subject to staff and supplier confirmation."
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services
            .filter(
              (s) => site.publications[s.service as PublicService] !== "HIDDEN",
            )
            .map((s) => (
              <Link
                key={s.service}
                href={s.href}
                data-service={s.service}
                data-placement="HOME_SERVICES"
                className="group rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-7 transition hover:border-forest-600"
              >
                <s.icon className="size-7 text-forest-700" />
                <h2 className="mt-5 text-2xl">{s.title}</h2>
                <p className="my-4 text-[var(--ink-muted)]">{s.body}</p>
                <span className="inline-flex items-center gap-2 font-semibold">
                  Explore options <ArrowRight className="size-4" />
                </span>
              </Link>
            ))}
        </div>
      </Container>
      <section className="border-y border-[var(--line)] bg-[var(--paper-sunken)] py-20">
        <Container wide>
          <SectionHead
            eyebrow="How it works"
            title="Clear steps before you commit"
          />
          <ol className="mt-10 grid gap-7 md:grid-cols-4">
            {[
              [
                "01",
                "Tell us your plans",
                "Share dates, preferences and how we can reach you.",
              ],
              [
                "02",
                "Review a written quote",
                "Check the total, service fee, validity and supplier conditions.",
              ],
              [
                "03",
                "Accept and arrange payment",
                "Use approved instructions. Finance verifies funds before supplier processing.",
              ],
              [
                "04",
                "Receive confirmation",
                "Supplier checks and confirmed references complete the arrangement.",
              ],
            ].map(([n, t, b]) => (
              <li key={n}>
                <span className="font-display text-3xl text-clay-600">{n}</span>
                <h3 className="mt-4 text-xl">{t}</h3>
                <p className="mt-3 text-[var(--ink-muted)]">{b}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>
      {tours.length > 0 && (
        <Container wide className="py-20">
          <SectionHead
            eyebrow="Explore Rwanda"
            title="Itineraries to start a conversation"
            lede="Review the offer details, then ask for a quote for your dates."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {tours.map((t) => (
              <TourCard key={t.id} tour={t} />
            ))}
          </div>
        </Container>
      )}
      <Container className="py-20">
        <SectionHead eyebrow="Before you enquire" title="Questions, answered" />
        <div className="mt-8 space-y-4">
          {[
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
          ].map(([q, a]) => (
            <details
              key={q}
              className="rounded-xl border border-[var(--line)] p-5"
            >
              <summary className="cursor-pointer font-semibold">{q}</summary>
              <p className="mt-3 text-[var(--ink-muted)]">{a}</p>
            </details>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-5">
          <Link href="/support" className="underline">
            Support & changes
          </Link>
          <Link href="/legal/cancellation" className="underline">
            Cancellation terms
          </Link>
          <Link href="/legal/privacy" className="underline">
            Privacy notice
          </Link>
        </div>
      </Container>
    </PageShell>
  );
}
