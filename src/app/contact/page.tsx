import type { Metadata } from "next";
import { Suspense } from "react";
import { Clock3, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { PageShell, PageHero } from "@/components/layout/page-shell";
import { EnquiryForm } from "@/components/booking/enquiry-form";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { getSite } from "@/lib/settings";
import { destinationImages } from "@/lib/images";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  return {
    title: "Contact",
    description: `Contact ${site.name} about Rwanda travel experiences.`,
    alternates: { canonical: "/contact" },
  };
}

export default async function ContactPage() {
  const site = await getSite();
  const channels = [
    {
      icon: Phone,
      label: "Call us",
      value: site.contact.phone,
      href: site.contact.phoneHref,
      alt: site.contact.phoneAlt,
      note: "Daily, 7am – 9pm EAT",
    },
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: site.contact.phone,
      href: site.contact.whatsapp,
      alt: undefined as string | undefined,
      note: "Fastest for a quick question",
    },
    {
      icon: Mail,
      label: "Email",
      value: site.contact.email,
      href: `mailto:${site.contact.email}`,
      alt: undefined as string | undefined,
      note: "We reply within one working day",
    },
  ].filter((channel) => channel.value && channel.href);

  return (
    <PageShell overHero>
      <PageHero
        eyebrow="Contact"
        title="Get in touch"
        lede="Our contact channels are being set up. Please check back when Thrill Rwanda is ready to take enquiries."
        crumbs={[{ label: "Contact" }]}
        image={destinationImages["kigali"]}
      />

      <Container wide className="grid gap-14 py-16 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
        {/* ------------------------------------------------------- Channels */}
        <div className="min-w-0">
          <Eyebrow>Direct lines</Eyebrow>
          {channels.length ? <ul className="mt-8 space-y-4">
            {channels.map((c) => (
              <li key={c.label}>
                <a
                  href={c.href}
                  className="group flex items-start gap-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-5 transition-all duration-400 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-lift)]"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-forest-800 text-bone-50 transition-colors group-hover:bg-ember-500 group-hover:text-[#2a1605]">
                    <c.icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                      {c.label}
                    </span>
                    <span className="mt-1 block truncate font-display text-lg font-semibold">
                      {c.value}
                    </span>
                    {c.alt ? (
                      <span className="block truncate font-display text-lg font-semibold">
                        {c.alt}
                      </span>
                    ) : null}
                    <span className="mt-0.5 block text-2xs text-[var(--ink-faint)]">
                      {c.note}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul> : <p className="mt-8 text-sm text-[var(--ink-muted)]">Phone, WhatsApp and email details have not been configured.</p>}

          {site.contact.address || site.contact.hours ? (
            <div className="mt-10 space-y-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-sunken)] p-6">
              {site.contact.address ? (
                <p className="flex items-start gap-3 text-sm text-[var(--ink-muted)]">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-clay-700" />
                  <span>
                    <span className="block font-medium text-[var(--ink)]">{site.legalName}</span>
                    {site.contact.address}
                  </span>
                </p>
              ) : null}
              {site.contact.hours ? (
                <p className="flex items-start gap-3 text-sm text-[var(--ink-muted)]">
                  <Clock3 className="mt-0.5 size-4 shrink-0 text-clay-700" />
                  <span>{site.contact.hours}</span>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ----------------------------------------------------------- Form */}
        <div className="min-w-0">
          <Eyebrow>Send an enquiry</Eyebrow>
          <h2 className="mt-5 text-3xl">What can we plan for you?</h2>
          {site.contact.email ? (
            <div className="mt-8">
              <Suspense
                fallback={
                  <div className="h-[32rem] rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)]" />
                }
              >
                <EnquiryForm />
              </Suspense>
            </div>
          ) : (
            <p className="mt-8 text-sm text-[var(--ink-muted)]">The enquiry form will be available once a business email is configured.</p>
          )}
        </div>
      </Container>
    </PageShell>
  );
}
