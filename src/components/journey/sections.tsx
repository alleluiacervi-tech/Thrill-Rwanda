import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { PageHero, type Crumb } from "@/components/layout/page-shell";
import { JourneyIcon } from "@/components/journey/icons";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/primitives";
import {
  pairs,
  type Fact,
  type Faq,
  type PairKey,
  type Point,
} from "@/lib/journeys";
import type { PublicService, Publications } from "@/lib/launch-rules";
import { cn } from "@/lib/utils";

/**
 * The sections every product page is assembled from. Each page chooses its
 * own order and adds its own signature section, so the pages share a voice
 * without reading as one template.
 */

/* -------------------------------------------------------------------- Hero */

export type HeroAction = {
  href: string;
  label: string;
  /** Counted by the interaction counter when set. */
  service?: PublicService;
};

export function JourneyHero({
  eyebrow,
  title,
  titleEm,
  lede,
  image,
  imagePosition,
  crumbs,
  facts,
  primary,
  secondary,
  lang,
}: {
  eyebrow: string;
  title: string;
  titleEm: string;
  lede: string;
  image: string;
  imagePosition?: string;
  crumbs: Crumb[];
  facts?: Fact[];
  primary: HeroAction;
  secondary?: HeroAction;
  /** Set when the headline is not in English, e.g. "rw". */
  lang?: string;
}) {
  return (
    <PageHero
      eyebrow={eyebrow}
      title={
        <span lang={lang}>
          {title}{" "}
          <em className="text-sun-400">{titleEm}</em>
        </span>
      }
      lede={lede}
      crumbs={crumbs}
      image={image}
      imagePosition={imagePosition}
      className="pb-24 sm:pb-32 lg:pt-52"
    >
      <div className="mt-9 flex flex-wrap gap-3">
        <Button
          href={primary.href}
          variant="accent"
          size="lg"
          data-service={primary.service}
          data-placement={primary.service ? "SERVICE_REQUEST" : undefined}
        >
          {primary.label}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
        {secondary ? (
          <Button
            href={secondary.href}
            variant="outline"
            size="lg"
            className="border-white/45 text-white hover:border-bone-50 hover:bg-bone-50 hover:text-forest-950"
          >
            {secondary.label}
          </Button>
        ) : null}
      </div>

      {facts?.length ? (
        <dl className="mt-12 grid max-w-3xl gap-3 sm:grid-cols-3">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="rounded-2xl bg-white/10 px-5 py-4 ring-1 ring-white/20 backdrop-blur-md"
            >
              <dt className="text-2xs font-semibold uppercase tracking-[0.16em] text-sun-300">
                {fact.label}
              </dt>
              <dd className="mt-1.5 font-display text-xl leading-tight text-white">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </PageHero>
  );
}

/* ---------------------------------------------------------------- Arranges */

/** What the travel desk takes care of: a numbered grid of short promises. */
export function Arranges({
  eyebrow,
  title,
  lede,
  points,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: string;
  points: Point[];
  className?: string;
}) {
  return (
    <section className={cn("relative overflow-hidden bg-bone-100 py-20 sm:py-28", className)}>
      <div aria-hidden className="imigongo absolute inset-0 opacity-[0.035]" />
      <Container wide className="relative">
        <div className="max-w-2xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-3 text-display-sm">{title}</h2>
          {lede ? (
            <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-[var(--ink-muted)]">
              {lede}
            </p>
          ) : null}
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-5">
          {points.map((point, i) => (
            <li
              key={point.title}
              className="group relative flex flex-col rounded-[var(--radius-card)] border border-[var(--line)] bg-white p-6 transition-[transform,box-shadow,border-color] duration-500 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-1 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-float)] sm:p-7"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-full bg-forest-100 text-forest-800 transition-colors duration-500 group-hover:bg-forest-800 group-hover:text-sun-400">
                  <JourneyIcon name={point.icon} className="size-5" />
                </span>
                <span
                  aria-hidden
                  className="display-italic tnum font-display text-2xl text-bone-400"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-6 text-[1.375rem] leading-[1.15]">{point.title}</h3>
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
                {point.body}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------- Story */

/** An editorial passage beside a tall photograph. */
export function Story({
  eyebrow,
  heading,
  headingEm,
  body,
  list,
  image,
  imageAlt,
  imagePosition,
  caption,
  flip = false,
  children,
}: {
  eyebrow: string;
  heading: string;
  headingEm: string;
  body: string[];
  list?: string[];
  image: string;
  imageAlt: string;
  imagePosition?: string;
  /** A short label pinned to the photograph. */
  caption?: string;
  /** Photograph on the right instead of the left. */
  flip?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="py-20 sm:py-28">
      <Container
        wide
        className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20"
      >
        <figure
          className={cn(
            "group relative aspect-[4/5] overflow-hidden rounded-[var(--radius-panel)] bg-forest-950 sm:aspect-[5/4] lg:aspect-[4/5]",
            flip && "lg:order-2",
          )}
        >
          <Image
            src={image}
            alt={imageAlt}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-[1.04]"
            style={imagePosition ? { objectPosition: imagePosition } : undefined}
          />
          {caption ? (
            <>
              <div aria-hidden className="scrim-b absolute inset-0" />
              <figcaption className="on-media absolute inset-x-0 bottom-0 flex items-center gap-2 p-6 text-sm font-semibold text-white">
                <span aria-hidden className="h-0.5 w-6 rounded-full bg-sun-500" />
                {caption}
              </figcaption>
            </>
          ) : null}
        </figure>

        <div className="max-w-xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-3 text-display-sm">
            {heading} <em>{headingEm}</em>
          </h2>
          {body.map((paragraph) => (
            <p
              key={paragraph}
              className="mt-5 text-[1.0625rem] leading-relaxed text-[var(--ink-muted)]"
            >
              {paragraph}
            </p>
          ))}
          {list?.length ? (
            <ul className="mt-8 space-y-3.5 border-t border-[var(--line)] pt-8">
              {list.map((item) => (
                <li key={item} className="flex items-start gap-3.5">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-sun-500 text-forest-950">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                  </span>
                  <span className="text-[0.9375rem] leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {children}
        </div>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------------- PairWith */

/** "Goes well with": the other doors that belong on the same plan. */
export function PairWith({
  keys,
  publications,
  eyebrow = "Goes well with",
  title = (
    <>
      One plan, <em>one travel desk</em>
    </>
  ),
  lede = "Add any of these to the same request. We check them together and return one written quote.",
}: {
  keys: PairKey[];
  publications: Publications;
  eyebrow?: string;
  title?: React.ReactNode;
  lede?: string;
}) {
  const shown = keys
    .map((key) => ({ key, ...pairs[key] }))
    .filter((pair) => publications[pair.service] !== "HIDDEN");
  if (shown.length === 0) return null;

  return (
    <section className="on-dark relative overflow-hidden bg-forest-950 py-20 sm:py-28">
      <div aria-hidden className="contours absolute inset-0 opacity-[0.06]" />
      <Container wide className="relative">
        <div className="max-w-2xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-3 text-display-sm text-white">{title}</h2>
          <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-forest-100/80">
            {lede}
          </p>
        </div>

        <ul
          className={cn(
            "no-bar -mx-5 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 lg:mt-16 lg:gap-5",
            shown.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
          )}
        >
          {shown.map((pair) => (
            <li
              key={pair.key}
              className="w-[80vw] max-w-[22rem] shrink-0 snap-center sm:w-auto sm:max-w-none"
            >
              <Link
                href={pair.href}
                data-service={pair.service}
                data-placement="SERVICE_REQUEST"
                className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[var(--radius-card)] bg-forest-900 p-6 text-white ring-1 ring-white/10 sm:aspect-[3/4] lg:aspect-[4/5]"
              >
                <Image
                  src={pair.image}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 33vw, 80vw"
                  className="object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-105"
                />
                <span aria-hidden className="scrim-b absolute inset-0" />
                <span
                  aria-hidden
                  className="absolute right-5 top-5 grid size-10 place-items-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur-md transition-colors duration-500 group-hover:bg-sun-500 group-hover:text-forest-950"
                >
                  <ArrowUpRight className="size-4" />
                </span>
                <span className="on-media relative font-display text-[1.625rem] leading-[1.08]">
                  {pair.title}
                </span>
                <span className="relative mt-2.5 text-[0.9375rem] leading-relaxed text-white/85">
                  {pair.body}
                </span>
                <span className="relative mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-sun-300">
                  {pair.cta}
                  <ArrowRight
                    className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* --------------------------------------------------------------------- FAQ */

export function FaqList({ items }: { items: readonly Faq[] }) {
  return (
    <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
      {items.map(([question, answer]) => (
        <details key={question} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-xl leading-snug [&::-webkit-details-marker]:hidden">
            {question}
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-full border border-[var(--line-strong)] text-lg leading-none transition-[transform,background-color,border-color] duration-300 group-open:rotate-45 group-open:border-forest-800 group-open:bg-forest-800 group-open:text-bone-50"
            >
              +
            </span>
          </summary>
          <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
            {answer}
          </p>
        </details>
      ))}
    </div>
  );
}

export function FaqSection({
  eyebrow = "Before you ask",
  title = "Questions, answered",
  items,
  children,
}: {
  eyebrow?: string;
  title?: React.ReactNode;
  items: readonly Faq[];
  /** Extra links under the heading. */
  children?: React.ReactNode;
}) {
  return (
    <section className="py-20 sm:py-28">
      <Container
        wide
        className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:gap-20"
      >
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-3 text-display-sm">{title}</h2>
          {children}
        </div>
        <FaqList items={items} />
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------- RequestSection */

const defaultSteps = [
  ["Send your request", "Tell us your dates, your party and what matters to you."],
  ["We check, then quote", "Availability, inclusions, fees and terms come back in writing."],
  ["You decide", "Nothing is booked or charged until you accept the quote."],
] as const;

/** The request form, with what happens next beside it. */
export function RequestSection({
  id = "request",
  eyebrow = "Start here",
  title,
  lede,
  steps = defaultSteps,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title: React.ReactNode;
  lede: string;
  steps?: readonly (readonly [string, string])[];
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="relative scroll-mt-24 overflow-hidden border-y border-[var(--line)] bg-bone-100 py-20 sm:py-28"
    >
      <div aria-hidden className="imigongo absolute inset-0 opacity-[0.035]" />
      <Container
        wide
        className="relative grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20"
      >
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-3 text-display-sm">{title}</h2>
          <p className="mt-5 max-w-md text-[1.0625rem] leading-relaxed text-[var(--ink-muted)]">
            {lede}
          </p>

          <ol className="mt-10 space-y-6">
            {steps.map(([heading, body], i) => (
              <li key={heading} className="flex gap-5">
                <span
                  aria-hidden
                  className="tnum grid size-11 shrink-0 place-items-center rounded-full border border-[var(--line-strong)] bg-white font-display text-lg"
                >
                  {i + 1}
                </span>
                <div className="pt-1">
                  <h3 className="text-lg leading-snug">{heading}</h3>
                  <p className="mt-1 text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="min-w-0">{children}</div>
      </Container>
    </section>
  );
}
