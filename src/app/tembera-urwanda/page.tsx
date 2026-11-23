import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, MapPin, Users } from "lucide-react";
import {
  Breadcrumbs,
  HillsEdge,
  PageShell,
} from "@/components/layout/page-shell";
import { TemberaRequestForm } from "@/components/booking/tembera-request-form";
import { JourneyIcon } from "@/components/journey/icons";
import {
  FaqSection,
  PairWith,
  RequestSection,
} from "@/components/journey/sections";
import { bookHref } from "@/components/journey/editions";
import { EditionsExplorer } from "@/components/journey/editions-explorer";
import { dateParts, formatRun } from "@/lib/departure-rules";
import { todayInRwanda } from "@/lib/flight-enquiry-schema";
import { formatMoney } from "@/lib/utils";
import { temberaIncludes } from "@/components/journey/tembera-band";
import { listEditions } from "@/lib/departures";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { TEMBERA, journeyImages, type Faq } from "@/lib/journeys";
import { requirePublicService } from "@/lib/publication";
import {
  RESIDENCIES,
  RESIDENCY_HINTS,
  RESIDENCY_LABELS,
} from "@/lib/residency";
import { getSite } from "@/lib/settings";

// The request form needs a fresh submission token on every load.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${TEMBERA.name}: all-inclusive journeys across Rwanda`,
  description:
    "Join a dated, all-inclusive edition across Rwanda. Transport, meals, stays, a guide and entries in one booking, for Rwandans, residents and visitors.",
  alternates: { canonical: TEMBERA.href },
};

const run = [
  ["Choose an edition", "Pick the dates and the route that suit you, and book your place."],
  ["Meet in Kigali", "Everyone gathers at one point. The guide takes it from there."],
  ["Travel together", "One vehicle, one plan, and time at every stop on the route."],
  ["Eat and stay", "Tables and rooms are already arranged. You only have to arrive."],
  ["Home, with stories", "Back to Kigali together, with nothing left to settle."],
] as const;

const faqs: Faq[] = [
  ["Who can join?", "Everyone. Editions are open to Rwandans, residents of East Africa and visitors from abroad. Each edition states any age or fitness requirement."],
  ["Why are there three prices?", "Park and entry fees differ by residency, so the price does too. Choose the rate that matches your ID or passport; the operator checks it on the day."],
  ["What does all-inclusive cover?", "Transport from Kigali and back, meals, accommodation, a guide and the entries on the plan. Each edition lists exactly what is included and what is not."],
  ["Can I book for a group or a family?", "Yes. Book as many places as the edition has left, or ask us about a private edition for your school, team or association."],
  ["What if I need to cancel?", "Your booking confirmation states the terms that apply to that edition. Contact the travel desk with your reference and we will explain your options."],
];

export default async function TemberaPage() {
  await requirePublicService("TRIP");
  const [{ publications }, editions] = await Promise.all([getSite(), listEditions()]);
  // Booked online only while trips are switched to direct booking in Admin → Launch.
  const bookable = publications.TRIP === "DIRECT";
  const next = editions.find((edition) => edition.departure.seatsLeft > 0) ?? editions[0];
  const nextDirect = next && bookable && !next.tour.enquiryOnly && next.departure.seatsLeft > 0;

  return (
    <PageShell overHero>
      {/* ------------------------------------------------------------ Hero */}
      <section className="on-dark relative -mt-[4.5rem] overflow-hidden bg-[#0b1611] pb-24 pt-[8.5rem] sm:pb-32 lg:-mt-24 lg:pt-48">
        <Image
          src={journeyImages.tembera}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: "center 58%" }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgb(8 20 15 / 0.86) 0%, rgb(8 20 15 / 0.6) 48%, rgb(8 20 15 / 0.2) 100%), linear-gradient(to top, rgb(8 20 15 / 0.7), transparent 55%)",
          }}
        />
        <div aria-hidden className="scrim-t absolute inset-x-0 top-0 h-40" />

        <Container wide className="relative grid items-end gap-12 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-16">
          <div>
          <Breadcrumbs
            items={[{ label: TEMBERA.name }]}
            className="on-media mb-8 text-white/90"
          />
          <Eyebrow className="on-media text-sun-300">
            The all-inclusive campaign
          </Eyebrow>
          <h1
            lang="rw"
            className="on-media mt-4 font-display text-[clamp(3.5rem,1.4rem+9vw,9.5rem)] leading-[0.9] tracking-[-0.035em] text-white"
          >
            <span className="reveal-line">
              <span className="pb-[0.08em]">Tembera</span>
            </span>
            <span className="reveal-line">
              <em className="pb-[0.12em] text-sun-400 [animation-delay:140ms]">
                u Rwanda
              </em>
            </span>
          </h1>
          <p className="on-media anim-rise mt-6 max-w-xl text-lg leading-relaxed text-white/90 [animation-delay:380ms] sm:text-xl">
            &ldquo;{TEMBERA.meaning}.&rdquo; Dated journeys across the country
            with transport, meals, stays and a guide in one booking. You bring
            yourself; the rest is done.
          </p>

          <div className="anim-rise mt-9 flex flex-wrap gap-3 [animation-delay:480ms]">
            <Button
              href="#editions"
              variant="accent"
              size="lg"
              data-service="TRIP"
              data-placement="SERVICE_REQUEST"
            >
              <CalendarDays className="size-4" aria-hidden />
              See the editions
            </Button>
            <Button
              href="#request"
              variant="outline"
              size="lg"
              className="border-white/45 text-white hover:border-bone-50 hover:bg-bone-50 hover:text-forest-950"
            >
              {editions.length > 0 ? "Ask about a private edition" : "Tell me when the next one opens"}
            </Button>
          </div>

          <ul className="anim-rise mt-12 flex flex-wrap gap-2.5 [animation-delay:580ms]">
            {["For Rwandans", "For East African residents", "For visitors from abroad"].map(
              (label) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur-md"
                >
                  <span aria-hidden className="size-1.5 rounded-full bg-sun-500" />
                  {label}
                </li>
              ),
            )}
          </ul>
          </div>

          {next ? (
            // The next edition, as a ticket: the campaign is live and this is the next bus.
            <Link
              href={nextDirect ? bookHref(next) : "#editions"}
              className="anim-rise group relative block overflow-hidden rounded-[1.5rem] bg-white text-forest-950 shadow-[0_40px_80px_-36px_rgb(0_0_0/0.7)] [animation-delay:640ms]"
            >
              <div className="flex items-center justify-between bg-sun-500 px-5 py-2.5">
                <span className="text-2xs font-bold uppercase tracking-[0.2em]">Next departure</span>
                <span className="tnum inline-flex items-center gap-1.5 text-xs font-bold">
                  <Users className="size-3.5" aria-hidden />
                  {next.departure.seatsLeft > 0 ? `${next.departure.seatsLeft} places left` : "Full"}
                </span>
              </div>
              <div className="flex gap-4 p-5">
                <div className="w-16 shrink-0 overflow-hidden rounded-xl text-center ring-1 ring-[var(--line)]">
                  <p className="bg-forest-900 py-0.5 text-2xs font-bold uppercase tracking-[0.12em] text-white">{dateParts(next.departure.startsOn).month}</p>
                  <p className="tnum pt-1 font-display text-3xl leading-none">{dateParts(next.departure.startsOn).day}</p>
                  <p className="pb-1.5 text-2xs font-semibold uppercase text-bone-600">{dateParts(next.departure.startsOn).weekday}</p>
                </div>
                <div className="min-w-0">
                  <p className="tnum text-2xs font-bold uppercase tracking-[0.14em] text-lake-700">{formatRun(next.departure.startsOn, next.departure.lastDay)}</p>
                  <p className="mt-1 font-display text-2xl leading-[1.1] group-hover:underline group-hover:decoration-sun-500 group-hover:underline-offset-4">{next.tour.name}</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm text-bone-600">
                    <MapPin className="size-4 shrink-0 text-clay-600" aria-hidden />
                    {next.tour.destination}
                  </p>
                </div>
              </div>
              <div className="relative flex items-center justify-between border-t-2 border-dashed border-bone-300 px-5 py-4">
                {nextDirect ? (
                  <span>
                    <span className="block text-2xs font-semibold uppercase tracking-[0.12em] text-bone-600">From, all-inclusive</span>
                    <span className="tnum font-display text-2xl leading-none">{formatMoney(next.tour.priceFrom)}</span>
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-forest-700">Price on your written quote</span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-900 px-4 py-2.5 text-sm font-bold text-white transition-colors group-hover:bg-forest-800">
                  {nextDirect ? "Book" : "See editions"}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </div>
            </Link>
          ) : null}
        </Container>
        <HillsEdge />
      </section>

      {/* ---------------------------------------------------------- Ticket */}
      <section className="py-20 sm:py-28">
        <Container wide>
          <div className="max-w-2xl">
            <Eyebrow>One booking</Eyebrow>
            <h2 className="mt-3 text-display-sm">
              Everything you need, <em>already in it</em>
            </h2>
            <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-[var(--ink-muted)]">
              A Tembera booking is the whole journey. There is no second
              payment for the bus, no hunting for somewhere to eat, no room to
              find when you arrive.
            </p>
          </div>

          {/* The ticket: what it holds on the left, the stub on the right. */}
          <div className="relative mt-12 grid overflow-hidden rounded-[var(--radius-panel)] border border-[var(--line)] bg-white shadow-[var(--shadow-float)] lg:mt-16 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <ul className="grid gap-x-10 gap-y-8 p-7 sm:grid-cols-2 sm:p-10 xl:grid-cols-3">
              {temberaIncludes.map((item) => (
                <li key={item.label} className="flex items-start gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-forest-100 text-forest-800">
                    <JourneyIcon name={item.icon} className="size-5" />
                  </span>
                  <span>
                    <span className="block font-display text-xl leading-tight">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
                      {item.body}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="on-dark relative border-t border-dashed border-white/30 bg-forest-900 p-7 text-bone-50 sm:p-10 lg:border-l lg:border-t-0">
              {/* The notches where the stub tears off. */}
              <span
                aria-hidden
                className="absolute -left-3 -top-3 hidden size-6 rounded-full bg-white lg:block"
              />
              <span
                aria-hidden
                className="absolute -bottom-3 -left-3 hidden size-6 rounded-full bg-white lg:block"
              />
              <p className="text-2xs font-bold uppercase tracking-[0.2em] text-sun-300">
                Admit one
              </p>
              <p lang="rw" className="mt-3 font-display text-3xl leading-[1.02]">
                Tembera <em className="text-sun-400">u Rwanda</em>
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-forest-100">
                {[
                  "One price per person",
                  "Inclusions listed on every edition",
                  "Exclusions stated before you pay",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-sun-400" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
              <div
                aria-hidden
                className="mt-7 h-10 rounded-sm opacity-70"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 5px, currentColor 5px 6px, transparent 6px 10px, currentColor 10px 13px, transparent 13px 15px)",
                }}
              />
            </div>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------- How an edition runs */}
      <section className="relative overflow-hidden bg-bone-100 py-20 sm:py-28">
        <div aria-hidden className="imigongo absolute inset-0 opacity-[0.035]" />
        <Container wide className="relative">
          <div className="max-w-2xl">
            <Eyebrow>How an edition runs</Eyebrow>
            <h2 className="mt-3 text-display-sm">
              From your booking <em>to the road home</em>
            </h2>
          </div>

          <ol className="relative mt-12 grid gap-7 sm:grid-cols-2 lg:mt-16 lg:grid-cols-5 lg:gap-6">
            {/* The road the steps sit on. */}
            <span
              aria-hidden
              className="absolute left-6 right-6 top-6 hidden h-px bg-[var(--line-strong)] lg:block"
            />
            {run.map(([title, body], i) => (
              // Number beside the text on phones, above it once the steps sit on the road.
              <li key={title} className="relative flex gap-5 lg:block">
                <span className="tnum relative z-10 grid size-12 shrink-0 place-items-center rounded-full border border-[var(--line-strong)] bg-white font-display text-lg">
                  {i + 1}
                </span>
                <div>
                  <h3 className="pt-2 text-xl leading-snug lg:mt-5 lg:pt-0">{title}</h3>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ---------------------------------------------------------- Editions */}
      <section id="editions" className="scroll-mt-24 py-20 sm:py-28">
        <Container wide>
          <div className="max-w-2xl">
            <Eyebrow>Editions</Eyebrow>
            <h2 className="mt-3 text-display-sm">
              {editions.length > 0 && !bookable ? (
                <>
                  Dates you can <em>join</em>
                </>
              ) : (
                <>
                  Dates you can <em>book now</em>
                </>
              )}
            </h2>
          </div>

          {editions.length > 0 ? (
            <>
              <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-[var(--ink-muted)]">
                {bookable
                  ? "Choose a date, pick the rate that matches your ID and pay to secure your place."
                  : "Choose a date and ask for a place. We confirm the price and your seat in writing."}
              </p>
              <div className="mt-10 lg:mt-14">
                <EditionsExplorer editions={editions} bookable={bookable} />
              </div>
            </>
          ) : (
            <div className="mt-10 flex flex-col items-start gap-6 rounded-[var(--radius-panel)] border border-dashed border-[var(--line-strong)] bg-bone-50 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10 lg:mt-14">
              <div className="flex items-start gap-5">
                <span className="grid size-14 shrink-0 place-items-center rounded-full bg-forest-100 text-forest-800">
                  <CalendarDays className="size-6" aria-hidden />
                </span>
                <div>
                  <h3 className="text-2xl leading-tight">
                    The next editions are being scheduled
                  </h3>
                  <p className="mt-2 max-w-xl text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
                    Dates, routes and prices appear here as soon as an edition
                    opens for booking. Leave your details and we will tell you
                    first.
                  </p>
                </div>
              </div>
              <Button href="#request" variant="primary" size="lg" className="shrink-0">
                Tell me first
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          )}
        </Container>
      </section>

      {/* ----------------------------------------------------------- Rates */}
      <section className="on-dark relative overflow-hidden bg-forest-950 py-20 sm:py-28">
        <div aria-hidden className="contours absolute inset-0 opacity-[0.06]" />
        <Container
          wide
          className="relative grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:gap-20"
        >
          <div>
            <Eyebrow>Open to everyone</Eyebrow>
            <h2 className="mt-3 text-display-sm text-white">
              Three rates, <em className="text-sun-400">one journey</em>
            </h2>
            <p className="mt-5 max-w-md text-[1.0625rem] leading-relaxed text-forest-100/80">
              Park and entry fees differ by residency, so each edition is
              priced three ways. Everyone travels together; you simply pay the
              rate that matches your ID or passport.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-3">
            {RESIDENCIES.map((residency, i) => (
              <li
                key={residency}
                className="flex flex-col rounded-[var(--radius-card)] bg-white/[0.06] p-6 ring-1 ring-white/12"
              >
                <span
                  aria-hidden
                  className="display-italic tnum font-display text-2xl text-sun-400"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 text-xl leading-tight text-white">
                  {RESIDENCY_LABELS[residency]}
                </h3>
                <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-forest-100/75">
                  {RESIDENCY_HINTS[residency]}
                </p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <RequestSection
        eyebrow="Be first to know"
        title={
          <>
            Tell us where <em>you want to go</em>
          </>
        }
        lede="Leave your details and what you would like to see. We will write when an edition opens, or plan a private one for your group."
        steps={[
          ["Leave your details", "Your name, how to reach you and how many places you need."],
          ["We write when it opens", "Dates, the route, what is included and the price."],
          ["Book your place", "Choose your rate and pay to secure your seat."],
        ]}
      >
        <TemberaRequestForm submissionKey={randomUUID()} today={todayInRwanda()} context={TEMBERA.name} />
      </RequestSection>

      <PairWith
        keys={["flights", "cityTour", "groups"]}
        publications={publications}
        eyebrow="Make more of it"
        title={
          <>
            Before, after, <em>or all together</em>
          </>
        }
        lede="Fly in for an edition, add a day in Kigali, or bring your whole school or team."
      />

      <FaqSection items={faqs} />
    </PageShell>
  );
}
