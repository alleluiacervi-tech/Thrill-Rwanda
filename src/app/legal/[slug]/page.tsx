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
    summary: "How requests, quotations and confirmations are handled.",
    sections: [
      {
        heading: "Requests and confirmation",
        body: [
          "An enquiry does not reserve availability or create a confirmed service. Review the written quotation, its validity, supplier conditions and payment deadlines before accepting. Confirmation follows payment verification and supplier checks.",
        ],
      },
      {
        heading: "Prices, fees and payment",
        body: [
          "The written quotation states currency, supplier charges, service fee, tax treatment and exclusions. Use the approved payment instructions for your case. No general credit facility or payment method is promised by this draft.",
        ],
      },
      {
        heading: "Travel responsibilities",
        body: [
          "Check names, dates, visas, entry requirements and travel documents before acceptance. Tell the desk about accessibility, age, health or other suitability requirements so these can be checked with suppliers.",
        ],
      },
      {
        heading: "Approval status",
        body: [
          `Final company details, contractual responsibilities and governing terms require business and legal approval. Ask ${site.contact.email} for the approved terms for your proposed arrangement.`,
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    summary: "Information used to handle travel requests and support.",
    sections: [
      {
        heading: "Enquiries and operations",
        body: [
          "Enquiry forms collect the contact and travel information you provide, consent wording/version and a saved reference. Staff use scoped access to prepare quotations, record acceptance, reconcile payments and handle support. Existing account and booking records remain separate.",
        ],
      },
      {
        heading: "Interaction counts",
        body: [
          "Selected public enquiry links increment aggregate daily service and placement counters. This counter does not collect contact details, itinerary, IP address, visitor identifier or cookies. It measures clicks, including repeat clicks, rather than individual visitors.",
        ],
      },
      {
        heading: "Private documents",
        body: [
          "Document collection is enabled only after approval of a necessary purpose and retention period. Authorized customers, assigned providers and administrators have restricted access. Reads, uploads and deletions leave audit evidence. Expired documents cannot be downloaded; stored copies and backups require the retention procedure to be followed.",
        ],
      },
      {
        heading: "Your questions",
        body: [
          `Contact ${site.contact.email} about access, correction, deletion or the handling of your information. Final retention schedules, processors, transfers and statutory rights require business and legal review.`,
        ],
      },
    ],
  },
  cancellation: {
    title: "Cancellation Policy",
    summary:
      "Changes and refunds depend on the terms of your accepted quotation.",
    sections: [
      {
        heading: "Changes and cancellation",
        body: [
          "Contact the desk promptly with your reference. Availability, supplier fare rules, cancellation charges, non-refundable items and service-fee treatment must be stated in the accepted quotation. This draft does not promise free cancellation or a standard refund period.",
        ],
      },
      {
        heading: "Refund review and payout",
        body: [
          "A cancellation request does not mean a refund is approved or paid. The team checks the agreed terms and supplier position, records any approved obligation and tracks actual payouts separately. Ask the desk for the status of your case.",
        ],
      },
      {
        heading: "Contact and evidence",
        body: [
          `Use ${site.contact.email} or ${site.contact.phone} with your enquiry or booking reference. Keep your quotation, acceptance and confirmation records. Payment and supplier rules need to be checked for each arrangement.`,
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
    robots: saved
      ? { index: true, follow: true }
      : { index: false, follow: true },
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
              ? new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "long",
                  timeZone: "UTC",
                }).format(saved.updatedAt)
              : null}
          </p>
        ) : (
          <p className="mb-12 flex items-start gap-3 rounded-[var(--radius-card)] border border-clay-300 bg-clay-100 p-5 text-sm leading-relaxed text-clay-900">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <span>
              <strong className="font-semibold">
                Draft — not yet reviewed.
              </strong>{" "}
              This document is a working draft written to get the structure in
              place. It is not legal advice and must be reviewed by a Rwandan
              advocate before launch.
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
                <p
                  key={i}
                  className="whitespace-pre-line text-base leading-relaxed text-[var(--ink-muted)]"
                >
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
                    <p
                      key={i}
                      className="text-base leading-relaxed text-[var(--ink-muted)]"
                    >
                      {p}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="mt-16 border-t border-[var(--line)] pt-6 text-2xs text-[var(--ink-faint)]">
          Questions about this document? Email{" "}
          <a className="underline" href={`mailto:${site.contact.email}`}>
            {site.contact.email}
          </a>
          .
        </p>
      </Container>
    </PageShell>
  );
}
