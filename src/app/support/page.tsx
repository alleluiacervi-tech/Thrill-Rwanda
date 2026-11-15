import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSite } from "@/lib/settings";
import { PageShell, PageHero } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/primitives";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Travel support & changes",
  description:
    "Contact the travel desk about an existing arrangement, changes, supplier issues or refund queries.",
  alternates: { canonical: "/support" },
};
export default async function Page() {
  const [site, policy] = await Promise.all([
    getSite(),
    db.operationsPolicy.findUnique({ where: { id: 1 } }),
  ]);
  return (
    <PageShell>
      <PageHero
        eyebrow="Here for your next step"
        title="Support for your travel plans"
        lede="Include your enquiry or booking reference and a short description of what you need. Avoid sending identity documents or payment credentials through public messages."
        crumbs={[{ label: "Support" }]}
      />
      <Container className="max-w-3xl space-y-7 py-14">
        <section>
          <h2 className="text-2xl">Reach the travel desk</h2>
          <ul className="mt-4 space-y-3">
            <li>
              <a href={`mailto:${site.contact.email}`} className="underline">
                {site.contact.email}
              </a>
            </li>
            <li>
              <a href={site.contact.phoneHref} className="underline">
                {site.contact.phone}
              </a>
            </li>
            <li>
              <a href={site.contact.whatsapp} className="underline">
                WhatsApp the desk
              </a>
            </li>
          </ul>
          <p className="mt-4">
            {policy?.supportHours ??
              site.contact.hours ??
              "Ask the desk about current staffed hours. A response time has not been published."}
          </p>
        </section>
        <section>
          <h2 className="text-2xl">
            Changes, cancellations and service issues
          </h2>
          <p className="mt-3">
            The team records a responsible owner, next action and outcome.
            Changes remain subject to availability and the supplier terms in
            your accepted quotation. A request to cancel does not establish
            refund eligibility or mean a payout has been made.
          </p>
        </section>
        <section>
          <h2 className="text-2xl">Escalation and urgent help</h2>
          <p className="mt-3">
            {policy?.escalation ??
              "Contact the desk using the channels above and identify any time-sensitive departure or service issue."}
          </p>
          <p className="mt-3">
            {policy?.emergencyNotice ??
              "This desk is not an emergency service. For immediate danger or a medical emergency, use local emergency assistance and your insurer's emergency contact. Out-of-hours coverage has not been confirmed."}
          </p>
        </section>
        <Link className="underline" href="/legal/cancellation">
          Read the cancellation notice
        </Link>
      </Container>
    </PageShell>
  );
}
