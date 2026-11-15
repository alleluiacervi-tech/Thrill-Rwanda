import Link from "next/link";
import { ArrowRight, Clock3, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";

import { visiblePath } from "@/lib/launch-rules";
import { footerNav as allFooterNav } from "@/lib/site";
import { getSite } from "@/lib/settings";

/**
 * Three bands, top to bottom:
 *  1. A welcome in Kinyarwanda and the one thing to do next.
 *  2. An Imigongo seam, then the directory: brand and contacts, four link columns.
 *  3. Legal line, payment marks and the flag ribbon closing the page.
 */
export async function SiteFooter() {
  const site = await getSite();
  const footerNav = Object.fromEntries(Object.entries(allFooterNav).map(([k,v]) => [k,v.filter(n=>visiblePath(n.href,site.publications))]));
  const contacts = [
    site.contact.phone && site.contact.phoneHref
      ? { icon: Phone, label: site.contact.phone, href: site.contact.phoneHref }
      : null,
    site.contact.phoneAlt && site.contact.phoneAltHref
      ? { icon: Phone, label: site.contact.phoneAlt, href: site.contact.phoneAltHref }
      : null,
    site.contact.email ? { icon: Mail, label: site.contact.email, href: `mailto:${site.contact.email}` } : null,
    site.contact.address ? { icon: MapPin, label: site.contact.address } : null,
    site.contact.hours ? { icon: Clock3, label: site.contact.hours } : null,
  ].filter((c): c is { icon: typeof Phone; label: string; href?: string } => c !== null);

  return (
    <footer className="on-dark relative overflow-hidden bg-forest-950 text-bone-100">
      {/* ------------------------------------------------------- Welcome
          A light band, so it never merges with a dark closing section above. */}
      <div className="relative border-t border-bone-300 bg-bone-100 text-bone-900">
        <div aria-hidden className="imigongo absolute inset-0 opacity-[0.05]" />
        <Container wide className="relative grid gap-8 py-16 sm:py-20 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-16">
          <div>
            <p className="display-italic font-display text-2xl text-lake-700 sm:text-3xl" lang="rw">
              Murakaza neza.
            </p>
            <p className="mt-3 max-w-3xl font-display text-[clamp(2rem,1.3rem+2.8vw,3.5rem)] leading-[1.05] tracking-[-0.02em] text-forest-950">
              The Land of a Thousand Hills, planned by people who call it home.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <Button href="/enquire" variant="accent" size="lg">
              Plan a trip
              <ArrowRight className="size-4" />
            </Button>
            {site.contact.whatsapp ? (
              <Button
                href={site.contact.whatsapp}
                variant="outline"
                size="lg"
                className="border-forest-800/30 text-forest-900 hover:border-forest-800 hover:bg-forest-800 hover:text-white"
              >
                <MessageCircle className="size-4" />
                WhatsApp us
              </Button>
            ) : null}
          </div>
        </Container>
      </div>

      <div aria-hidden className="imigongo-band opacity-90" />

      {/* ----------------------------------------------------- Directory */}
      <Container wide className="relative">
        <div className="grid gap-12 py-14 sm:py-16 lg:grid-cols-[1.2fr_2fr] lg:gap-16">
          <div className="max-w-sm">
            <Logo tone="dark" className="h-14 lg:h-16" />
            <p className="mt-6 text-sm leading-relaxed text-forest-200">{site.description}</p>

            {contacts.length ? (
              <ul className="mt-8 space-y-3.5 text-sm">
                {contacts.map((c) => (
                  <li key={c.label} className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/8 ring-1 ring-white/10">
                      <c.icon className="size-3.5 text-sun-400" aria-hidden />
                    </span>
                    {c.href ? (
                      <a href={c.href} className="link-draw mt-1.5 text-forest-100 hover:text-white">
                        {c.label}
                      </a>
                    ) : (
                      <span className="mt-1.5 text-forest-200">{c.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}

            {/* Only the networks the admin has filled in. */}
            {site.socials.length ? (
              <ul className="mt-7 flex flex-wrap gap-2" aria-label="Social media">
                {site.socials.map((link) => (
                  <li key={link.key}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center rounded-full border border-white/15 px-4 text-xs font-semibold text-forest-100 transition-colors hover:border-sun-400 hover:text-sun-300"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
            {Object.entries(footerNav).map(([heading, links]) => (
              <nav key={heading} aria-label={heading}>
                <h3 className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-sun-300">
                  {heading}
                </h3>
                <ul className="mt-5 space-y-3">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="link-draw text-[0.9375rem] text-forest-100/85 hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/10 py-7 pb-24 text-xs text-forest-300 sm:flex-row sm:items-center sm:justify-between sm:pb-8">
          <p>
            © {new Date().getFullYear()} {site.legalName}. Made in Kigali.
          </p>
          <p className="flex flex-wrap items-center gap-2">
            <Link href="/how-it-works" className="underline">Payment instructions follow your checked quote</Link>
          </p>
        </div>
      </Container>
      <div aria-hidden className="flag-ribbon" />
    </footer>
  );
}
