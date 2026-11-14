import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow, SectionHead } from "@/components/ui/primitives";
import { Media } from "@/components/ui/media";
import { whyUs } from "@/lib/content";
import { destinationImages } from "@/lib/images";
import { getSite } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  return {
    title: "About Us",
    description: site.description,
    alternates: { canonical: "/about" },
  };
}

export const revalidate = 300;

export default async function AboutPage() {
  const site = await getSite();
  return (
    <PageShell overHero>
      <PageHero
        eyebrow="About Us"
        title="A Rwanda travel platform in progress"
        lede={`${site.name} is a demo being adapted around Rwanda destinations. Listings, providers, prices, contacts and legal details still need to be configured and verified.`}
        crumbs={[{ label: "About" }]}
        image="/media/photos/volcanoes-trek.jpeg"
      />

      {/* ------------------------------------------------------------ Story */}
      <Container wide className="grid gap-14 py-20 lg:grid-cols-2 lg:gap-20">
        <div>
          <Eyebrow>Why we exist</Eyebrow>
          <h2 className="mt-2 text-display-sm">A starting point for exploring Rwanda</h2>
          <div className="mt-7 space-y-5 text-base leading-relaxed text-[var(--ink-muted)]">
            <p>
              Rwanda offers very different landscapes within a compact
              destination: the volcanic highlands of Volcanoes National Park,
              Nyungwe&apos;s rainforest and the savannah and lakes of Akagera.
            </p>
            <p>
              This project is an early booking-platform demo. Its existing
              catalogue, prices, provider records and legal copy are sample
              material and are not current offers from Thrill Rwanda.
            </p>
            <p>
              Rwanda listings, local provider agreements, payment options,
              terms and contact channels must be added and verified before the
              site can accept real bookings.
            </p>
          </div>
          <Button href="/contact" variant="primary" size="lg" className="mt-9">
            Talk to the team
          </Button>
        </div>

        <div className="relative">
          <Media
            seed="about-thrill-rwanda"
            src={destinationImages["volcanoes-national-park"]}
            alt="Sample travel photograph"
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="aspect-[4/5] rounded-[var(--radius-card)]"
          />
        </div>
      </Container>

      {/* ---------------------------------------------------------- Status */}
      <section className="on-dark relative overflow-hidden bg-forest-900 py-16">
        <div aria-hidden className="contours absolute inset-0 opacity-[0.07]" />
        <Container wide className="relative">
          <p className="mx-auto max-w-3xl text-center text-lg leading-relaxed text-forest-100">
            Rwanda experiences, real provider listings, locally reviewed legal
            terms, verified prices and business contacts are still being
            prepared.
          </p>
        </Container>
      </section>

      {/* --------------------------------------------------------- Promises */}
      <section className="py-20">
        <Container wide>
          <SectionHead
            eyebrow="How we work"
            title="What you can hold us to"
            align="center"
          />
          <ul className="mx-auto mt-12 grid max-w-5xl gap-x-12 gap-y-10 sm:grid-cols-2">
            {whyUs.map((item) => (
              <li key={item.title} className="border-t border-[var(--line-strong)] pt-6">
                <h3 className="text-xl">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* -------------------------------------------------------- Providers */}
      <section className="border-t border-[var(--line)] bg-[var(--paper-sunken)] py-20">
        <Container wide className="text-center">
          <Eyebrow className="justify-center">For providers</Eyebrow>
          <h2 className="mx-auto mt-2 max-w-2xl text-display-sm">
            Run a lodge, a fleet or a safari outfit?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[var(--ink-muted)]">
            List with us and get bookings that are already paid for, with a
            dashboard that shows exactly what is coming and when. We take a
            commission only on completed bookings.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button href="/partner" variant="accent" size="lg">
              Become a provider
            </Button>
            <Button href="/contact" variant="outline" size="lg">
              Ask a question
            </Button>
          </div>
        </Container>
      </section>
    </PageShell>
  );
}
