import type { Metadata } from "next";
import { BadgeCheck, CalendarCheck, Coins, LineChart } from "lucide-react";
import { PageShell, PageHero } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow, SectionHead } from "@/components/ui/primitives";
import { getSite } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Become a Provider",
  description:
    "List your lodge, camp, safari operation or vehicle fleet with us. Verified bookings, paid deposits and a dashboard that shows what's coming.",
  alternates: { canonical: "/partner" },
};

const benefits = [
  {
    icon: Coins,
    title: "Paid before arrival",
    body: "Deposits are collected at booking and released to you on delivery. No chasing customers for the balance at the gate.",
  },
  {
    icon: CalendarCheck,
    title: "Availability you control",
    body: "Set units, block dates and adjust per-day pricing. The platform never sells a room, seat or vehicle you have not made available.",
  },
  {
    icon: LineChart,
    title: "One dashboard",
    body: "Every booking, its status and its payment in one place — with only your own listings visible to you.",
  },
  {
    icon: BadgeCheck,
    title: "Verified badge",
    body: "Once your licence and insurance check out, your listings carry a verified mark. Travellers book verified providers first.",
  },
];

const steps = [
  {
    title: "Apply",
    body: "Send us your business name, what you operate and where. Two minutes.",
  },
  {
    title: "Verification",
    body: "We check your licence, insurance and KRA PIN, and visit the property or inspect the fleet.",
  },
  {
    title: "Build your listings",
    body: "Add photos, rooms or vehicles, pricing and availability in the provider dashboard.",
  },
  {
    title: "Go live",
    body: "Your listings appear in search. You confirm or decline each booking as it arrives.",
  },
];

export default async function PartnerPage() {
  const site = await getSite();
  return (
    <PageShell overHero>
      <PageHero
        eyebrow="For providers"
        title="Bookings that are already paid for"
        lede="List your lodge, camp, safari operation or fleet alongside verified Rwandan partners — and get confirmed bookings instead of enquiries."
        crumbs={[{ label: "Become a Provider" }]}
      />

      <Container wide className="py-20">
        <SectionHead
          eyebrow="Why list with us"
          title="Commission only on completed bookings"
          lede="No listing fee, no monthly subscription. We take a commission when a booking is delivered and the customer is satisfied — our incentive is the same as yours."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-7"
            >
              <span className="grid size-11 place-items-center rounded-full bg-forest-800 text-bone-50">
                <b.icon className="size-5" />
              </span>
              <h3 className="mt-5 text-xl">{b.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
                {b.body}
              </p>
            </div>
          ))}
        </div>
      </Container>

      {/* ------------------------------------------------------------ Steps */}
      <section className="border-y border-[var(--line)] bg-[var(--paper-sunken)] py-20">
        <Container wide>
          <Eyebrow>Getting listed</Eyebrow>
          <h2 className="mt-5 max-w-2xl text-display-sm">
            Four steps, usually under two weeks
          </h2>

          <ol className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="relative">
                <span
                  aria-hidden
                  className="font-display text-6xl font-semibold leading-none text-clay-200"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 text-xl">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* -------------------------------------------------------------- CTA */}
      <section className="on-dark relative overflow-hidden bg-forest-950 py-24">
        <div aria-hidden className="contours absolute inset-0 opacity-[0.08]" />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ember-500/12 blur-[120px]"
        />
        <Container className="relative text-center">
          <h2 className="mx-auto max-w-2xl text-display-sm text-bone-50">
            Tell us what you run
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-forest-100/80">
            We review every application ourselves. If you operate in Rwanda and
            hold current licence and insurance, we would like to hear from you.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button
              href="/contact?subject=Provider%20application"
              variant="accent"
              size="lg"
            >
              Apply to list
            </Button>
            <Button
              href={site.contact.whatsapp}
              variant="outline"
              size="lg"
              className="border-forest-400/40 text-bone-50 hover:bg-bone-50 hover:text-forest-900"
            >
              WhatsApp us
            </Button>
          </div>
        </Container>
      </section>
    </PageShell>
  );
}
