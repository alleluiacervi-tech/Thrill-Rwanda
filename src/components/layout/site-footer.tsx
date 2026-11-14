import Link from "next/link";
import { Clock3, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/ui/primitives";
import { PaymentLogos } from "@/components/ui/payment-logos";
import { footerNav } from "@/lib/site";
import { getSite } from "@/lib/settings";

export async function SiteFooter() {
  const site = await getSite();
  return (
    <footer className="on-dark relative overflow-hidden bg-forest-950 text-bone-100">
      <div className="contours absolute inset-0 opacity-[0.06]" aria-hidden />
      {/* warm horizon glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[60rem] -translate-x-1/2 rounded-full bg-ember-500/10 blur-[100px]"
      />

      <Container wide className="relative">
        <div className="grid gap-14 py-20 lg:grid-cols-[1.4fr_2fr]">
          <div className="max-w-sm">
            <Logo tone="dark" className="h-16 lg:h-20" />
            <p className="mt-6 text-sm leading-relaxed text-forest-200">
              {site.description}
            </p>

            <ul className="mt-8 space-y-3 text-sm">
              <li>
                {site.contact.phone && site.contact.phoneHref ? (
                  <a
                    href={site.contact.phoneHref}
                    className="link-draw inline-flex items-center gap-3 text-forest-100 hover:text-ember-400"
                  >
                    <Phone className="size-4 shrink-0 text-ember-500" />
                    {site.contact.phone}
                  </a>
                ) : null}
              </li>
              {/* The second line only when the admin has one. */}
              {site.contact.phoneAlt && site.contact.phoneAltHref ? (
                <li>
                  <a
                    href={site.contact.phoneAltHref}
                    className="link-draw inline-flex items-center gap-3 text-forest-100 hover:text-ember-400"
                  >
                    <Phone className="size-4 shrink-0 text-ember-500" />
                    {site.contact.phoneAlt}
                  </a>
                </li>
              ) : null}
              {site.contact.email ? (
                <li>
                  <a
                    href={`mailto:${site.contact.email}`}
                    className="link-draw inline-flex items-center gap-3 text-forest-100 hover:text-ember-400"
                  >
                    <Mail className="size-4 shrink-0 text-ember-500" />
                    {site.contact.email}
                  </a>
                </li>
              ) : null}
              {site.contact.address ? (
                <li className="inline-flex items-start gap-3 text-forest-200">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-ember-500" />
                  {site.contact.address}
                </li>
              ) : null}
              {site.contact.hours ? (
                <li className="inline-flex items-start gap-3 text-forest-200">
                  <Clock3 className="mt-0.5 size-4 shrink-0 text-ember-500" />
                  {site.contact.hours}
                </li>
              ) : null}
            </ul>

            {/* Only the networks the admin has filled in. */}
            {site.socials.length ? (
              <ul className="mt-6 flex flex-wrap gap-2" aria-label="Social media">
                {site.socials.map((link) => (
                  <li key={link.key}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center rounded-full border border-forest-400/30 px-4 text-2xs font-semibold text-forest-100 transition-colors hover:border-ember-400 hover:text-ember-400"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            {Object.entries(footerNav).map(([heading, links]) => (
              <nav key={heading} aria-label={heading}>
                <h3 className="font-sans text-2xs font-semibold uppercase tracking-[0.22em] text-forest-300">
                  {heading}
                </h3>
                <ul className="mt-5 space-y-3">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="link-draw text-sm text-forest-100/80 hover:text-bone-50"
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

        <div className="flex flex-col gap-4 border-t border-forest-400/15 pt-7 pb-24 text-2xs text-forest-300 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.legalName}. All rights reserved.
          </p>
          <p className="flex flex-wrap items-center gap-2">
            <span>Secure payments by</span>
            <PaymentLogos marks={["pesapal", "mpesa", "airtel", "visa", "mastercard"]} size="sm" />
          </p>
        </div>
      </Container>
    </footer>
  );
}
