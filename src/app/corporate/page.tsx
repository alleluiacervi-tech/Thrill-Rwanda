import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import {
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  Plane,
  Presentation,
  ReceiptText,
  Tent,
  X,
} from "lucide-react";
import { PageShell, PageHero } from "@/components/layout/page-shell";
import { CorporateRateForm } from "@/components/booking/corporate-rate-form";
import { WhatsAppIcon } from "@/components/layout/whatsapp-button";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow, SectionHead } from "@/components/ui/primitives";
import { getSite } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Corporate & Events",
  description:
    "Corporate ground transport in Rwanda: fixed per-vehicle rates, one monthly invoice, vetted drivers and live WhatsApp trip updates for visiting teams, conferences and incentive trips.",
  alternates: { canonical: "/corporate" },
};

// Dropped into public/docs, it appears on the page with no code change.
const PROFILE_PDF = "/docs/company-profile.pdf";
const hasProfilePdf = existsSync(join(process.cwd(), "public", PROFILE_PDF));

const trust = ["One monthly invoice", "Fixed rates", "KRA/NTSA compliant", "Live WhatsApp updates"];

const audiences = [
  {
    icon: Plane,
    title: "Visiting teams & consultants",
    body: "Kigali airport pickups, hotel transfers, daily office shuttles. Same driver, same car, every day.",
  },
  {
    icon: Presentation,
    title: "Conferences & events",
    body: "20–200 pax. Branded buses, vans, executive cars. On-site coordinator and a live WhatsApp group.",
  },
  {
    icon: Tent,
    title: "Incentive trips & retreats",
    body: "Volcanoes, Nyungwe, Akagera and Lake Kivu. Full ground handling: park permits, lodges, transfers. One supplier.",
  },
];

const STANDARD = "Driver, fuel, parking, flight tracking";
const rateCard = [
  { from: "Kigali Airport", to: "Kigali city centre", price: "$30", includes: STANDARD },
  { from: "Kigali Airport", to: "Kigali Convention Centre", price: "$35", includes: STANDARD },
  { from: "Kigali", to: "Musanze (Volcanoes)", price: "$130", includes: `${STANDARD}, park coordination` },
  { from: "Kigali", to: "Akagera National Park", price: "$150", includes: STANDARD },
];

const monthEnd = [
  { icon: ReceiptText, text: "One PDF invoice, KRA ETR compliant" },
  { icon: FileSpreadsheet, text: "Excel trip sheet: date, staff, route, driver, cost" },
  { icon: FileText, text: "No cash receipts to chase" },
];

const comparison = [
  { label: "Driver", them: "A different driver every trip", us: "The same vetted drivers" },
  { label: "Price", them: "Surge pricing at busy times", us: "A fixed rate card" },
  { label: "Billing", them: "A receipt per ride", us: "One monthly invoice" },
  { label: "Compliance", them: "No documents on file", us: "KRA, NTSA, insurance and good-conduct docs on file" },
];

const compliance = [
  "KRA ETR invoice + PIN",
  "NTSA licensed, speed governor compliant",
  "Comprehensive insurance, passengers covered",
  "Driver good conduct, PSV licence, ID",
  "LPO accepted · 30-day credit for approved companies",
  "Dedicated account manager on WhatsApp",
];

export default async function CorporatePage() {
  const site = await getSite();
  const whatsapp = `${site.contact.whatsapp}?text=${encodeURIComponent(`Hi ${site.name}, I need a corporate rate card for `)}`;

  return (
    <PageShell overHero>
      {/* ------------------------------------------------------------ Hero */}
      <PageHero
        eyebrow="Corporate & Events"
        title="Ground logistics your finance team won't argue with"
        lede="One invoice. Fixed rates. No cash handling. We move your visiting teams, conference delegates & incentive trips across Rwanda — with vetted drivers and live trip reports on WhatsApp."
        crumbs={[{ label: "Corporate & Events" }]}
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="#rate-card-form" variant="accent" size="lg">
            Get corporate rates
          </Button>
          <Button
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            size="lg"
            className="gap-2 border-forest-400/40 text-bone-50 hover:bg-bone-50 hover:text-forest-900"
          >
            <WhatsAppIcon className="size-5 fill-current" />
            WhatsApp us: {site.contact.whatsappNumber}
          </Button>
        </div>
      </PageHero>

      {/* ------------------------------------------------------- Trust bar */}
      <div className="border-b border-[var(--line)] bg-[var(--paper-sunken)]">
        <Container wide>
          <ul className="flex flex-wrap justify-center gap-x-8 gap-y-2 py-4 text-sm font-medium">
            {trust.map((t) => (
              <li key={t} className="inline-flex items-center gap-2">
                <Check className="size-4 text-forest-700" />
                {t}
              </li>
            ))}
          </ul>
        </Container>
      </div>

      {/* --------------------------------------------------- Who we serve */}
      <Container wide className="py-20">
        <SectionHead eyebrow="Who we serve" title="Built for teams who can't afford delays" />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {audiences.map((a) => (
            <div
              key={a.title}
              className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-7 transition-all duration-500 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
            >
              <span className="grid size-11 place-items-center rounded-full bg-forest-800 text-bone-50">
                <a.icon className="size-5" />
              </span>
              <h3 className="mt-5 text-xl">{a.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">{a.body}</p>
            </div>
          ))}
        </div>
      </Container>

      {/* ---------------------------------------------------- How we work */}
      <section className="border-y border-[var(--line)] bg-[var(--paper-sunken)] py-20">
        <Container wide className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
          <div className="min-w-0">
            <SectionHead eyebrow="How we work" title="Uber-style pricing. Corporate-grade reporting." />
            {/* Scrolls sideways on a phone rather than squeezing four columns. */}
            <div className="mt-10 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)]">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="bg-forest-900 text-bone-50">
                  <tr>
                    <th className="px-5 py-3.5 font-medium">From → To</th>
                    <th className="px-5 py-3.5 font-medium">Fixed price</th>
                    <th className="px-5 py-3.5 font-medium">Includes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {rateCard.map((r) => (
                    <tr key={`${r.from}-${r.to}`}>
                      <td className="whitespace-nowrap px-5 py-4 font-medium">
                        {r.from} <span className="text-clay-500" aria-hidden>→</span> {r.to}
                      </td>
                      <td className="tnum whitespace-nowrap px-5 py-4 font-display text-lg font-semibold">{r.price}</td>
                      <td className="px-5 py-4 text-[var(--ink-muted)]">{r.includes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-[var(--ink-muted)]">
              No surge. No per-person charges. Rate is per vehicle.
            </p>
          </div>

          <div className="min-w-0 self-center rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-7">
            <Eyebrow>Delivered at month end</Eyebrow>
            <ul className="mt-5 space-y-4">
              {monthEnd.map((m) => (
                <li key={m.text} className="flex items-start gap-3 text-sm leading-relaxed">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-clay-100 text-clay-700">
                    <m.icon className="size-4" />
                  </span>
                  <span className="pt-2">{m.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------- Why switch */}
      <Container wide className="py-20">
        <SectionHead eyebrow="Why switch" title="Why corporates switch to us" />
        <div className="mt-10 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)]">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="px-5 py-3.5" />
                <th className="px-5 py-3.5 font-medium text-[var(--ink-muted)]">Ride-hailing apps &amp; street taxis</th>
                <th className="bg-forest-900 px-5 py-3.5 font-medium text-bone-50">{site.name}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {comparison.map((c) => (
                <tr key={c.label}>
                  <th scope="row" className="px-5 py-4 font-medium">{c.label}</th>
                  <td className="px-5 py-4 text-[var(--ink-muted)]">
                    <span className="inline-flex items-start gap-2">
                      <X className="mt-0.5 size-4 shrink-0 text-red-600" />
                      {c.them}
                    </span>
                  </td>
                  <td className="bg-forest-100/50 px-5 py-4">
                    <span className="inline-flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-forest-700" />
                      {c.us}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-8 grid gap-4 text-sm leading-relaxed text-[var(--ink-muted)] md:grid-cols-2">
          <p>
            <strong className="text-[var(--ink)]">Every driver:</strong> NTSA licensed, PSV, defensive driving,
            fluent English, uniform and ID.
          </p>
          <p>
            <strong className="text-[var(--ink)]">Every vehicle:</strong> tracker, dashcam, insurance, speed governor.
          </p>
        </div>
      </Container>

      {/* --------------------------------------------------- Compliance */}
      <section className="border-y border-[var(--line)] bg-[var(--paper-sunken)] py-20">
        <Container wide className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="min-w-0">
            <SectionHead
              eyebrow="For finance & HR"
              title="Finance & HR approved"
              lede="Everything your procurement checklist asks for, on file before the first trip."
            />
            {hasProfilePdf ? (
              <Button href={PROFILE_PDF} download variant="primary" size="lg" className="mt-8 h-auto min-h-14 gap-2 whitespace-normal py-3 text-center">
                <Download className="size-5 shrink-0" />
                Download company profile + compliance docs
              </Button>
            ) : (
              <Button
                href={`${site.contact.whatsapp}?text=${encodeURIComponent(`Hi ${site.name}, please send your company profile and compliance documents.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                variant="primary"
                size="lg"
                className="mt-8 h-auto min-h-14 gap-2 whitespace-normal py-3 text-center"
              >
                <FileText className="size-5 shrink-0" />
                Request company profile + compliance docs
              </Button>
            )}
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {compliance.map((c) => (
              <li
                key={c}
                className="flex items-start gap-3 rounded-[var(--radius-inset)] border border-[var(--line)] bg-[var(--paper-raised)] p-4 text-sm font-medium leading-snug"
              >
                <Check className="mt-0.5 size-4 shrink-0 text-forest-700" />
                {c}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ------------------------------------------------------ Final CTA */}
      <section id="rate-card-form" className="on-dark relative scroll-mt-20 overflow-hidden bg-forest-900 py-20">
        <div aria-hidden className="contours absolute inset-0 opacity-[0.07]" />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 size-[36rem] -translate-x-1/2 rounded-full bg-ember-500/10 blur-[120px]"
        />
        <Container className="relative grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <Eyebrow className="text-forest-200">Open an account</Eyebrow>
            <h2 className="mt-4 max-w-xl text-display-sm text-bone-50">Get your fixed rate card in 10 minutes</h2>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-forest-100/80">
              Send us your frequent routes, we send back fixed prices. No calls, no negotiations.
            </p>
          </div>
          <CorporateRateForm />
        </Container>
      </section>
    </PageShell>
  );
}
