import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Image from "next/image";
import { PageShell } from "@/components/layout/page-shell";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { FlightEnquiryForm } from "@/components/booking/flight-enquiry-form";
import { todayInRwanda } from "@/lib/flight-enquiry-schema";
import { requirePublicService } from "@/lib/publication";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Flights",
  description: "Plan your flight with Thrill Rwanda. Choose your route and request a written fare from our travel desk.",
  alternates: { canonical: "/flights" },
};

export default async function FlightsPage() {
  await requirePublicService("FLIGHT");
  return (
    <PageShell>
      <div className="bg-bone-50">
        <header className="relative isolate overflow-hidden bg-forest-950">
          <div className="absolute inset-y-0 right-0 -z-10 w-[75%] sm:w-[60%]">
            <Image src="/media/photos/rwandair-rcb.jpg" alt="RwandAir aircraft over the clouds" fill preload sizes="(min-width: 640px) 60vw, 75vw" className="object-cover object-[center_48%]" />
            <div className="absolute inset-0 bg-linear-to-r from-forest-950 via-forest-950/40 to-transparent sm:via-forest-950/10" />
          </div>
          <Container className="relative pb-16 pt-8 sm:pb-20 sm:pt-12">
            <Eyebrow className="text-sun-300">Thrill Concierge</Eyebrow>
            <h1 className="my-2 text-[clamp(3rem,6vw,5.5rem)] leading-none text-white">Flights</h1>
            <p className="mt-3 max-w-[22ch] text-sm leading-relaxed text-white sm:max-w-sm sm:text-base">Plan your route. Our Kigali desk will check fares for your dates.</p>
          </Container>
        </header>
        <Container id="flight-request" className="relative -mt-7 scroll-mt-28 pb-14 sm:-mt-9 sm:pb-20">
          <FlightEnquiryForm submissionKey={randomUUID()} today={todayInRwanda()} />
        </Container>
      </div>
    </PageShell>
  );
}
