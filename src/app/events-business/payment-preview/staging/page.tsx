import type { Metadata } from "next";
import { UrubutoStagingForm } from "@/components/booking/urubuto-staging-form";
import { PageHero, PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/session";
import { urubutoTestConfig } from "@/lib/urubuto-pay";

export const metadata: Metadata = {
  title: "UrubutoPay staging verification",
  robots: { index: false, follow: false },
};

export default async function UrubutoStagingPage() {
  await requireAdmin("/events-business/payment-preview/staging");
  return (
    <PageShell>
      <PageHero title="UrubutoPay staging verification" lede="Submit a test transaction and verify the result directly with UrubutoPay." />
      <Container className="max-w-3xl py-10">
        <p className="mb-5">Use merchant-approved test payer details. Each staging attempt tests RWF 125,000.</p>
        {urubutoTestConfig() ? <UrubutoStagingForm /> : <p>Merchant test credentials are required to enable the staging form.</p>}
      </Container>
    </PageShell>
  );
}
