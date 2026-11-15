import { getPublications } from "@/lib/publication";
import { serviceFor } from "@/lib/launch-rules";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/primitives";
import { ServiceEnquiryForm } from "@/components/booking/service-enquiry-form";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Plan a trip",
  description:
    "Request assistance with trips, stays, transport and group travel. All services are subject to staff and supplier checks.",
  alternates: { canonical: "/enquire" },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const service =
    ["TRIP", "STAY", "TRANSPORT", "GROUP", "EVENT"].find(
      (s) => s === params.service,
    ) ?? "GENERAL";
  const selected = serviceFor(service);
  if (selected && (await getPublications())[selected] === "HIDDEN") notFound();
  return (
    <PageShell>
      <PageHero
        eyebrow="Travel enquiries"
        title="What can we plan for you?"
        lede="Share your plans and preferences. This request does not confirm availability or create a booking."
        crumbs={[{ label: "Plan a trip" }]}
      />
      <Container className="max-w-3xl py-12">
        <ServiceEnquiryForm
          submissionKey={randomUUID()}
          initialService={service}
          context={
            typeof params.subject === "string"
              ? params.subject.slice(0, 1000)
              : ""
          }
        />
      </Container>
    </PageShell>
  );
}
