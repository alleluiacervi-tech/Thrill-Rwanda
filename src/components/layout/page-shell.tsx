import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { WhatsAppButton } from "@/components/layout/whatsapp-button";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { getSite } from "@/lib/settings";
import { cn } from "@/lib/utils";

/** Admin → Settings: a message across the top of every public page, e.g. holiday hours or an offer. */
export async function AnnouncementBar() {
  const { announcement } = await getSite();
  if (!announcement) return null;
  return (
    <div role="status" className="relative z-50 bg-ember-500 px-4 py-2 text-center text-2xs font-semibold text-[#2a1605] sm:text-sm">
      {announcement}
    </div>
  );
}

/** Header + footer wrapper so interior pages don't repeat the chrome. */
export function PageShell({
  children,
  overHero = false,
}: {
  children: React.ReactNode;
  overHero?: boolean;
}) {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader overHero={overHero} />
      <main id="main">{children}</main>
      <SiteFooter />
      <WhatsAppButton />
    </>
  );
}

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-2xs">
        <li>
          <Link href="/" className="opacity-65 transition-opacity hover:opacity-100">
            Home
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <ChevronRight className="size-3 opacity-40" aria-hidden />
            {item.href && i < items.length - 1 ? (
              <Link
                href={item.href}
                className="opacity-65 transition-opacity hover:opacity-100"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Compact banner for interior pages. Each page brings its own photograph, so they stop reading as one template.
export function PageHero({
  eyebrow,
  title,
  lede,
  crumbs,
  image,
  imagePosition = "center",
  children,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  crumbs?: Crumb[];
  /** Background photograph. Without one the banner falls back to the plain forest ground. */
  image?: string;
  imagePosition?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "on-dark relative -mt-[4.5rem] overflow-hidden bg-forest-900 pb-14 pt-[8.5rem] lg:-mt-24 lg:pt-44",
        className,
      )}
    >
      {image ? (
        <>
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: imagePosition }}
          />
          {/* Heavier at the top for the nav and on the left where the type sits. */}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-forest-950/90 via-forest-950/65 to-forest-950/25" />
          <div aria-hidden className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-forest-950/70 to-transparent" />
        </>
      ) : (
        <div aria-hidden className="absolute inset-0 bg-forest-900" />
      )}

      <Container wide className="relative">
        {crumbs ? (
          <Breadcrumbs items={crumbs} className="mb-8 text-forest-200" />
        ) : null}
        {eyebrow ? <Eyebrow className="text-ember-400">{eyebrow}</Eyebrow> : null}
        {/* Not cn(): tailwind-merge reads text-display-sm and text-bone-50 as two colours and drops the size. */}
        <h1 className={`max-w-3xl text-display-sm text-bone-50 ${eyebrow ? "mt-2" : ""}`}>{title}</h1>
        {lede ? (
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-forest-100/80 sm:text-lg">
            {lede}
          </p>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
