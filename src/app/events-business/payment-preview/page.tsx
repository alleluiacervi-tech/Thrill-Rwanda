import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { UrubutoPreview } from "@/components/booking/urubuto-preview";
import { Container } from "@/components/ui/primitives";
import { requirePublicService } from "@/lib/publication";

export const metadata: Metadata = {
  title: "UrubutoPay checkout preview",
  robots: { index: false, follow: false },
};

export default async function PaymentPreviewPage() {
  if (!["development", "test"].includes(process.env.APP_ENV ?? "") || process.env.VERCEL_ENV === "production") notFound();
  await requirePublicService("EVENT");
  return (
    <PageShell>
      <Container className="pb-14 pt-8 sm:pt-12">
        <Link href="/events-business" className="inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4">
          <ArrowLeft className="size-4" aria-hidden /> Thrill Events & Business
        </Link>
        <h1 className="mt-4 text-4xl sm:text-5xl">UrubutoPay checkout preview</h1>
        <p className="mb-7 mt-3">Try the steps from payment method to a simulated result.</p>
        <UrubutoPreview amount="RWF 125,000" reference="EVENT-DEMO" description="Kigali meeting package · sample proposal" />
      </Container>
    </PageShell>
  );
}
