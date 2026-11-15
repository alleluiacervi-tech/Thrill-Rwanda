import { getPublications } from "@/lib/publication";
import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, PageHero } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/primitives";
export const metadata: Metadata = {
  title: "How it works",
  description:
    "From enquiry and written quotation to payment verification, supplier confirmation and travel support.",
  alternates: { canonical: "/how-it-works" },
};
export default async function Page() {
  const flights = (await getPublications()).FLIGHT !== "HIDDEN";
  return (
    <PageShell>
      <PageHero
        eyebrow="Plan with clarity"
        title="From your first request to your confirmed plans"
        crumbs={[{ label: "How it works" }]}
      />
      <Container className="max-w-3xl space-y-9 py-16">
        {[
          [
            "Send your request",
            "Share the route or service, dates, group size and preferences. You receive a saved enquiry reference; a request does not hold a fare, room or vehicle.",
          ],
          [
            "Review the written quotation",
            "We check options and provide the scope, supplier charges, service fee, currency, validity, deadlines and change/cancellation conditions. Ask about anything unclear before accepting.",
          ],
          [
            "Confirm your acceptance",
            "The team records acceptance of the exact quote version. A revised quote needs its own acceptance. Travel document, visa and entry requirements must be checked for your itinerary.",
          ],
          [
            "Arrange approved payment",
            "Use the approved instructions supplied for your case. A screenshot is not proof of cleared funds; finance reconciles actual receipt before releasing supplier processing at the agreed funding threshold.",
          ],
          [
            "Receive supplier confirmation",
            "Operations checks supplier references before marking the arrangement confirmed. Flights are issued through the authorized ticketing partner. Check names, dates and all supplied documents promptly.",
          ],
          [
            "Get support",
            "Contact the desk with your enquiry or booking reference for changes, service issues or cancellation. Refund approval and actual payout are tracked separately; timing and eligibility depend on the agreed terms.",
          ],
        ].map(([t, b], i) => (
          <section key={t}>
            <h2 className="text-2xl">
              {i + 1}. {t}
            </h2>
            <p className="mt-3">{b}</p>
          </section>
        ))}
        <p>
          <Link href={flights ? "/flights" : "/enquire"} className="underline">
            {flights ? "Request a flight quote" : "Plan your journey"}
          </Link>{" "}
          ·{" "}
          <Link href="/support" className="underline">
            Contact support
          </Link>{" "}
          ·{" "}
          <Link href="/legal/cancellation" className="underline">
            Cancellation terms
          </Link>
        </p>
      </Container>
    </PageShell>
  );
}
