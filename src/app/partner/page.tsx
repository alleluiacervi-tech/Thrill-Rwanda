import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
export const metadata: Metadata = {
  title: "Work with the travel desk",
  description:
    "Apply to discuss travel services, supplier requirements and commercial arrangements with Thrill Rwanda.",
  alternates: { canonical: "/partner" },
};
export default function Page() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Supplier enquiries"
        title="Let’s discuss what you offer"
        lede="Operate accommodation, tours or transport? Share your business and service details for review."
        crumbs={[{ label: "Suppliers" }]}
      />
      <Container className="max-w-3xl space-y-7 py-16">
        <h2 className="text-2xl">Start with a review</h2>
        <p>
          Applications do not establish an approved partnership or guarantee
          bookings. The team checks the service scope, applicable documentation,
          conditions and commercial arrangements before approval.
        </p>
        <h2 className="text-2xl">Agree how we work together</h2>
        <p>
          Rates, availability, customer support, cancellation handling and
          publication permissions need written agreement. Public use of your
          name, branding or offers requires separate approval.
        </p>
        <Button href="/provider/apply">Submit supplier details</Button>
      </Container>
    </PageShell>
  );
}
