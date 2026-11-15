import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/layout/page-shell";
import { ServiceEnquiryForm } from "@/components/booking/service-enquiry-form";
import { TransferForm } from "@/components/booking/transfer-form";
import { Container } from "@/components/ui/primitives";
import { requirePublicService } from "@/lib/publication";
import { listActiveZones } from "@/lib/transfers";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Airport transfers & transport",
  description:
    "Request a checked transfer quote for Kigali airport and journeys within Rwanda. Pickup details, vehicle, inclusions and price follow supplier checks.",
  alternates: { canonical: "/transfers" },
};
export default async function Page() {
  const mode = await requirePublicService("TRANSPORT");
  return (
    <PageShell>
      <PageHero
        eyebrow="Transport & transfers"
        title="A considered start to your journey"
        lede="Share your arrival, pickup and destination details. We confirm the vehicle, meeting point, luggage allowance, waiting terms and full price in your written quote."
        crumbs={[{ label: "Transfers" }]}
      />
      <Container className="max-w-3xl py-14">
        {mode === "DIRECT" ? (
          <TransferForm zones={await listActiveZones()} />
        ) : (
          <ServiceEnquiryForm
            submissionKey={randomUUID()}
            initialService="TRANSPORT"
            context="Airport transfer enquiry"
          />
        )}
        <p className="mt-8">
          Sending an enquiry does not reserve a driver. For a delay, change or
          existing arrangement, contact support with your reference.
        </p>
      </Container>
    </PageShell>
  );
}
