import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseBusiness, Mountain, Users } from "lucide-react";
import { MeetingDirectory } from "@/components/booking/meeting-directory";
import { ServiceEnquiryForm } from "@/components/booking/service-enquiry-form";
import { PageHero, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Container, SectionHead } from "@/components/ui/primitives";
import { layouts } from "@/lib/meeting-directory";
import { publicBusinessVenueCatalogue } from "@/lib/business-venue-catalogue";
import { getPublications, requirePublicService } from "@/lib/publication";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Thrill Events & Business" },
  description: "Request a written proposal for corporate retreats, conferences and delegation travel in Rwanda.",
  alternates: { canonical: "/events-business" },
};

const services = [
  {
    title: "Retreats & offsites",
    description: "Bring your team together with meeting space, overnight stays, meals and time to explore Rwanda.",
    icon: Mountain,
  },
  {
    title: "Meetings & conferences",
    description: "Source a venue for your agenda, with breakout space, catering and accommodation where needed.",
    icon: Users,
  },
  {
    title: "Delegation travel",
    description: "Coordinate flight requests, room blocks, airport arrivals and scheduled transfers around your programme.",
    icon: BriefcaseBusiness,
  },
];

export default async function EventsBusinessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePublicService("EVENT");
  const [publications, catalogue] = await Promise.all([getPublications(), publicBusinessVenueCatalogue()]);
  const search = await searchParams;
  const selectedVenue = catalogue.venues.find(({ slug }) => slug === search.venue);
  const selectedRoom = catalogue.spaces.find(({ venue, id }) => venue === selectedVenue?.slug && id === search.room);
  const layout = layouts.find((value) => value === search.layout);
  const attendees = typeof search.attendees === "string" && /^\d{1,5}$/.test(search.attendees)
    ? Number(search.attendees)
    : 0;
  const preference = selectedVenue && (selectedRoom
    ? `${selectedRoom.name} at ${selectedVenue.name}`
    : selectedVenue.name);

  return (
    <PageShell>
      <PageHero
        title="Thrill Events & Business"
        lede="From Kigali conferences to lakeside retreats, one local team coordinates your venue, stays, transport and experiences."
        image="/media/photos/kigali-convention-centre-day.jpg"
        imagePosition="65% 35%"
        crumbs={[{ label: "Thrill Events & Business" }]}
      />
      <Container wide className="py-12 sm:py-16">
        <div className="flex flex-wrap gap-3">
          <Button href="#venues">Explore Kigali venues</Button>
          <Button href="#request" variant="outline">Request an event proposal</Button>
        </div>
        <ul className="mt-8 grid gap-5 md:grid-cols-3">
          {services.map(({ title, description, icon: Icon }) => (
            <li key={title} className="rounded-2xl border border-[var(--line)] p-6">
              <Icon aria-hidden className="mb-4 size-6 text-forest-700" />
              <h2 className="text-2xl">{title}</h2>
              <p className="mt-3">{description}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3">
          <Link href="/weddings" className="underline underline-offset-4">Planning a wedding?</Link>
          {publications.GROUP !== "HIDDEN" && (
            <Link href="/corporate" className="underline underline-offset-4">Arrange recurring business travel</Link>
          )}
        </div>
      </Container>
      <MeetingDirectory search={search} catalogue={catalogue} />
      <Container wide id="request" className="grid scroll-mt-28 gap-10 pb-16 lg:grid-cols-2">
        <div>
          <SectionHead title="Tell us what you’re planning" />
          <p className="mt-4">
            Share your dates, headcount and requirements. We check supplier options
            before sending a written proposal with the scope, costs and terms.
          </p>
          {preference && (
            <div className="mt-5">
              <p>Venue to check <strong>{preference}</strong></p>
              <Link href="/events-business#request" className="underline underline-offset-4">
                Start a general event request
              </Link>
            </div>
          )}
        </div>
        <ServiceEnquiryForm
          key={`${selectedVenue?.slug ?? "general"}-${selectedRoom?.id ?? ""}-${layout ?? ""}-${attendees}`}
          journey="BUSINESS_EVENT"
          submissionKey={randomUUID()}
          context={preference ? `Preferred meeting space: ${preference}${selectedRoom && layout ? ` (${layout} layout)` : ""}` : undefined}
          initial={selectedVenue ? {
            location: "Kigali",
            eventType: "Meeting or conference",
            ...(attendees > 0 && attendees <= 10000 ? { partySize: String(attendees) } : {}),
          } : undefined}
        />
      </Container>
    </PageShell>
  );
}
