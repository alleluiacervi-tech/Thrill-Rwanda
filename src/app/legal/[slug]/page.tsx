import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { PageShell, PageHero } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/primitives";
import { getLegalDoc } from "@/lib/legal";
import { getSite } from "@/lib/settings";
import { buildSite, type SiteInfo } from "@/lib/site-config";

/**
 * DRAFT legal pages.
 *
 * These exist so the footer has no dead links and so the structure is in
 * place. They are NOT legal advice and have not been reviewed by a Rwandan
 * advocate. Replace the body copy before launch — the notice at the top of
 * each page is deliberate and should stay until that review happens.
 */

type Doc = {
  title: string;
  summary: string;
  sections: { heading: string; body: string[] }[];
};

// The built-in drafts, with the company's current name and contacts.
const draftDocs = (site: SiteInfo): Record<string, Doc> => ({
  terms: {
    title: "Terms of Service",
    summary:
      `The agreement between you and ${site.legalName} when you book through this platform.`,
    sections: [
      {
        heading: "1. Who we are",
        body: [
          `${site.legalName} is a company registered in Rwanda, operating from ${site.contact.address}. We act as a booking agent between travellers and independent providers — safari operators, hotels, and licensed transport partners.`,
          "Where a service is delivered by a third-party provider, your contract for that service is with the provider. Our responsibility is to take the booking accurately, hold your payment securely, and hold providers to the standards we publish.",
        ],
      },
      {
        heading: "2. Bookings and confirmation",
        body: [
          "A booking is confirmed only when we send you a written confirmation carrying a booking reference. A request submitted through the website, or a payment made without confirmation, does not by itself create a confirmed booking.",
          "We check availability with the provider before confirming. If the service becomes unavailable between your request and our confirmation, we will offer an alternative or refund you in full.",
        ],
      },
      {
        heading: "3. Prices and payment",
        body: [
          "Prices are shown in US dollars and include applicable taxes unless stated otherwise. The price you are quoted at booking is the price you pay — we do not adjust a confirmed booking's price.",
          "A deposit is usually required to confirm. The balance is due before the service date, on the schedule stated in your confirmation. Payments are accepted by mobile money, Visa and Mastercard.",
        ],
      },
      {
        heading: "4. Your responsibilities",
        body: [
          "You are responsible for the accuracy of the details you give us, for holding valid travel documents and any required visas, and for arriving at the stated time and place.",
          "For car hire, you must hold a valid driving licence held for at least two years and present it at collection along with photographic identification.",
        ],
      },
      {
        heading: "5. Liability",
        body: [
          "We are not liable for loss or damage caused by events outside our reasonable control, including weather, road closures, civil disruption, flight delays or wildlife behaviour.",
          "Nothing in these terms limits liability for death or personal injury caused by negligence, or for fraud, where such limitation is not permitted by Rwandan law.",
        ],
      },
      {
        heading: "6. Governing law",
        body: [
          "These terms are governed by the laws of Rwanda, and the courts of Rwanda have exclusive jurisdiction over any dispute arising from them.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    summary:
      "What personal data we collect, why we collect it, and what you can ask us to do with it.",
    sections: [
      {
        heading: "1. What we collect",
        body: [
          "Account and booking details: your name, email address, phone number, and the details of the services you book.",
          "Payment records: the amount, method, transaction reference and status. We do not store full card numbers — those are handled by our payment gateway.",
          "Technical data: IP address, device and browser type, and pages visited, used to keep the service secure and to understand what people look for.",
        ],
      },
      {
        heading: "2. Why we use it",
        body: [
          "To take and fulfil your booking, to pass the details a provider needs in order to deliver your service, to take payment, to contact you about your booking, and to meet our legal and tax obligations.",
          "We do not sell your data, and we do not share it with anyone other than the provider delivering your booking and the processors we rely on to operate — payment gateway, email delivery and hosting.",
        ],
      },
      {
        heading: "3. How long we keep it",
        body: [
          "Booking and payment records are kept for seven years to meet Rwandan tax and accounting requirements. Marketing preferences are kept until you withdraw them.",
        ],
      },
      {
        heading: "4. Your rights",
        body: [
          "Under Rwanda's data protection law (Law No. 058/2021) you may ask for a copy of the personal data we hold about you, ask us to correct it, ask us to delete it where we are not required to keep it, and object to processing.",
          `To exercise any of these, email ${site.contact.email}. We respond within the statutory period.`,
        ],
      },
    ],
  },
  cancellation: {
    title: "Cancellation Policy",
    summary:
      "When you can cancel, what it costs, and how refunds are processed.",
    sections: [
      {
        heading: "1. Standard terms",
        body: [
          "Free cancellation up to 72 hours before the service start date, with a full refund of anything you have paid.",
          "Between 72 and 24 hours before the start date, the deposit is retained and the balance refunded.",
          "Within 24 hours of the start date, or in the case of a no-show, the booking is charged in full.",
        ],
      },
      {
        heading: "2. Provider-specific terms",
        body: [
          "Some lodges and camps operate stricter terms, particularly over peak season and the migration months. Where that applies, the terms are shown on the listing and repeated in your booking confirmation, and they take precedence over the standard terms above.",
        ],
      },
      {
        heading: "3. If we or the provider cancel",
        body: [
          "If a confirmed booking cannot be delivered, we will offer a comparable alternative or refund you in full, at your choice. Where the cancellation is our fault or the provider's, you are not charged any fee.",
        ],
      },
      {
        heading: "4. Refunds",
        body: [
          "Refunds are returned by the method you paid with. Mobile money refunds typically settle within three working days; card refunds can take up to ten working days depending on your bank.",
        ],
      },
      {
        heading: "5. How to cancel",
        body: [
          `Cancel from your bookings dashboard, or contact us on ${site.contact.phone} or ${site.contact.email} quoting your booking reference. The cancellation takes effect when we acknowledge it in writing.`,
        ],
      },
    ],
  },
});

export function generateStaticParams() {
  return Object.keys(draftDocs(buildSite(null))).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = draftDocs(await getSite())[slug];
  if (!doc) return { title: "Not found" };
  const saved = await getLegalDoc(slug);

  return {
    title: saved?.title ?? doc.title,
    description: doc.summary,
    alternates: { canonical: `/legal/${slug}` },
    // The shipped drafts stay out of search; the client's own copy belongs in it.
    robots: saved ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getSite();
  const doc = draftDocs(site)[slug];
  if (!doc) notFound();

  // The client's own copy once an admin has saved it; the draft until then.
  const saved = await getLegalDoc(slug);

  return (
    <PageShell overHero>
      <PageHero
        eyebrow="Legal"
        title={saved?.title ?? doc.title}
        lede={doc.summary}
        crumbs={[{ label: saved?.title ?? doc.title }]}
      />

      <Container className="py-16">
        {saved ? (
          <p className="mb-12 text-2xs text-[var(--ink-faint)]">
            Version {saved.version} ·{" "}
            {saved.updatedAt
              ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(
                  saved.updatedAt,
                )
              : null}
          </p>
        ) : (
          <p className="mb-12 flex items-start gap-3 rounded-[var(--radius-card)] border border-clay-300 bg-clay-100 p-5 text-sm leading-relaxed text-clay-900">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <span>
              <strong className="font-semibold">Draft — not yet reviewed.</strong> This document is
              a working draft written to get the structure in place. It is not legal advice and must
              be reviewed by a Rwandan advocate before launch.
            </span>
          </p>
        )}

        {saved ? (
          <div className="space-y-5">
            {saved.blocks.map((block, i) =>
              block.kind === "heading" ? (
                <h2 key={i} className="pt-7 text-2xl first:pt-0">
                  {block.text}
                </h2>
              ) : (
                <p key={i} className="whitespace-pre-line text-base leading-relaxed text-[var(--ink-muted)]">
                  {block.text}
                </p>
              ),
            )}
          </div>
        ) : (
          <div className="space-y-12">
            {doc.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-2xl">{section.heading}</h2>
                <div className="mt-4 space-y-4">
                  {section.body.map((p, i) => (
                    <p key={i} className="text-base leading-relaxed text-[var(--ink-muted)]">
                      {p}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="mt-16 border-t border-[var(--line)] pt-6 text-2xs text-[var(--ink-faint)]">
          Questions about this document? Email {site.contact.email}.
        </p>
      </Container>
    </PageShell>
  );
}
