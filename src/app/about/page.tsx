import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { getSite } from "@/lib/settings";
export const metadata: Metadata = {
  title: "About Thrill Rwanda",
  description:
    "A travel desk for flight quotations and considered Rwanda travel plans.",
  alternates: { canonical: "/about" },
};
export default async function Page() {
  const site = await getSite();
  return (
    <PageShell>
      <PageHero
        eyebrow={`About ${site.name}`}
        title="Travel plans deserve a thoughtful start"
        lede="A conversation, a checked quotation and clear confirmation steps — from your next flight to your time in Rwanda."
        crumbs={[{ label: "About" }]}
      />
      <Container className="max-w-3xl space-y-8 py-16">
        <section>
          <h2 className="text-2xl">A clear process</h2>
          <p className="mt-4">
            Share your travel needs with the desk. We review the brief, check
            supplier options and explain the scope, fees and conditions in
            writing before you decide.
          </p>
        </section>
        <section>
          <h2 className="text-2xl">Planning around you</h2>
          <p className="mt-4">
            Flight enquiries, Rwanda itineraries, stays, transport and group
            arrangements can start here. Availability and suitability depend on
            your dates, preferences and the suppliers involved.
          </p>
        </section>
        <section>
          <h2 className="text-2xl">Know your next step</h2>
          <p className="mt-4">
            Your reference connects the request, accepted quotation, payment
            verification and supplier confirmation. For changes or support,
            contact the desk with that reference.
          </p>
        </section>
        <div className="flex flex-wrap gap-4">
          <Button href="/enquire">Share your plans</Button>
          <Button href="/how-it-works" variant="outline">
            How it works
          </Button>
        </div>
      </Container>
    </PageShell>
  );
}
