import { requirePublicService } from "@/lib/publication";
import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, CalendarDays, ClipboardCheck, Plane } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { FlightEnquiryForm } from "@/components/booking/flight-enquiry-form";
import { todayInRwanda } from "@/lib/flight-enquiry-schema";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Request a flight quote",
  description:
    "Tell us your route, dates and travel preferences. Request a checked written flight quote without booking or paying online.",
  alternates: { canonical: "/flights" },
};

const quoteSteps = [
  {
    title: "Share your travel plans",
    description: "Tell us your route, dates, travelers and cabin preferences.",
    icon: CalendarDays,
  },
  {
    title: "Review your written quote",
    description: "We check flight options and set out the total, service fee, expiry and applicable fare terms.",
    icon: ClipboardCheck,
  },
  {
    title: "Decide whether to fly",
    description: "After you accept, the travel desk coordinates payment and supplier checks before ticketing.",
    icon: Plane,
  },
];

export default async function FlightsPage() {
  await requirePublicService("FLIGHT");
  return (
    <PageShell>
      <Container wide className="pb-6 pt-5 sm:pt-8">
        <section className="overflow-hidden rounded-3xl bg-forest-950 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="on-dark relative flex flex-col items-start justify-center px-6 py-9 text-bone-50 sm:px-12 sm:py-14 xl:px-16">
            <div aria-hidden className="pointer-events-none absolute inset-0 contours-light opacity-5" />
            <Eyebrow className="relative text-sun-300">Thrill Concierge · Flights</Eyebrow>
            <h1 className="relative mt-4 max-w-[16ch] text-[clamp(2.5rem,4.5vw,4.5rem)] leading-[1.02] text-white">
              Your next flight starts here.
            </h1>
            <p className="relative mt-5 max-w-md text-base leading-relaxed text-bone-100/90 sm:text-lg">
              Flying into Kigali or heading abroad? Tell us your route and dates.
              Our travel desk checks the options and sends a written quote.
            </p>
            <a href="#flight-request" className={`relative mt-7 ${buttonVariants({ variant: "accent" })}`}>
              Request a flight quote <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
          <div className="relative aspect-[5/3] overflow-hidden bg-sky-300 lg:aspect-auto lg:min-h-[26rem]">
            <Image
              src="/media/photos/rwandair-rcb.jpg"
              alt="A RwandAir passenger aircraft in flight against a blue sky"
              fill
              preload
              unoptimized
              className="object-cover object-[center_44%]"
            />
          </div>
        </section>
      </Container>
      <Container id="flight-request" className="grid scroll-mt-28 gap-x-12 gap-y-8 pb-16 pt-8 lg:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)] lg:pt-12">
        <section>
          <h2 className="text-3xl">Request a written flight quote</h2>
          <p className="mb-5 mt-2">Start with your itinerary and the best way to reach you.</p>
          <FlightEnquiryForm submissionKey={randomUUID()} today={todayInRwanda()} />
        </section>
        <aside>
          <h2 className="text-2xl">What happens next</h2>
          <ol className="mt-5 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] px-5">
            {quoteSteps.map(({ title, description, icon: Icon }) => (
              <li key={title} className="flex gap-4 py-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest-100 text-forest-900">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed">{description}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm">A quote request does not reserve a seat or take a payment.</p>
        </aside>
      </Container>
    </PageShell>
  );
}
