import { requirePublicService } from "@/lib/publication";
import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/primitives";
import { FlightEnquiryForm } from "@/components/booking/flight-enquiry-form";
import { todayInRwanda } from "@/lib/flight-enquiry-schema";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Request a flight quote",
  description:
    "Tell us your route, dates and travel preferences. Request a checked written flight quote without booking or paying online.",
  alternates: { canonical: "/flights" },
};

export default async function FlightsPage() {
  await requirePublicService("FLIGHT");
  return (
    <PageShell>
      <PageHero
        eyebrow="Flight enquiries"
        title="Let’s plan your flight"
        lede="Share your travel plans. Our team will review your request and check options before providing a written quotation."
        crumbs={[{ label: "Flights" }]}
        image="/media/photos/rwandair-takeoff.jpg"
        imagePosition="center 60%"
      />
      <Container className="grid gap-10 py-12 lg:grid-cols-[1fr_2fr]">
        <aside className="space-y-5">
          <h2 className="text-2xl">A request, then a checked quote</h2>
          <ol className="list-decimal space-y-4 pl-5">
            <li>Send your route, dates and preferences.</li>
            <li>
              We check options and explain the total, service fee, validity and
              applicable terms in a written quote.
            </li>
            <li>
              Confirmation and ticketing follow your acceptance, approved
              payment and supplier checks.
            </li>
          </ol>
          <p>
            No live fares, guaranteed holds or instant ticket issuance are
            offered here. Sending this form does not reserve a seat.
          </p>
        </aside>
        <FlightEnquiryForm
          submissionKey={randomUUID()}
          today={todayInRwanda()}
        />
      </Container>
    </PageShell>
  );
}
