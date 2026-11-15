import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/layout/page-shell";
import { CorporateRateForm } from "@/components/booking/corporate-rate-form";
import { Container, SectionHead } from "@/components/ui/primitives";
import { requirePublicService } from "@/lib/publication";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Corporate & group travel",
  description:
    "Request a checked proposal for team travel, conferences, retreats and events in Rwanda.",
  alternates: { canonical: "/corporate" },
};
export default async function CorporatePage() {
  await requirePublicService("GROUP");
  return (
    <PageShell>
      <PageHero
        eyebrow="Groups & corporate travel"
        title="A travel plan built around your brief"
        lede="Tell us about your team, dates, destinations and requirements. We check supplier options before preparing a written proposal."
        crumbs={[{ label: "Corporate & groups" }]}
      />
      <Container wide className="grid gap-12 py-16 lg:grid-cols-2">
        <div>
          <SectionHead
            eyebrow="Plan together"
            title="From visiting teams to Rwanda retreats"
          />
          <ul className="mt-7 list-disc space-y-4 pl-5">
            <li>Airport pickups and onward transport</li>
            <li>Accommodation and meeting requirements</li>
            <li>Group itineraries, activities and event logistics</li>
          </ul>
          <h2 className="mt-10 text-2xl">Agree the details before travel</h2>
          <p className="mt-4">
            Your proposal sets out the service scope, available suppliers,
            price, fees and payment schedule. Vehicle, staffing, billing and
            reporting arrangements depend on the agreed scope.
          </p>
          <p className="mt-4">
            Supplier documentation can be discussed during review. Credit,
            monthly billing and specific compliance credentials are subject to
            separate verification and written approval.
          </p>
        </div>
        <div id="rate-card-form">
          <CorporateRateForm />
        </div>
      </Container>
    </PageShell>
  );
}
