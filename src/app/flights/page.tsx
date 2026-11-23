import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Image from "next/image";
import { Headset, Plane, ReceiptText, ShieldCheck } from "lucide-react";
import { Breadcrumbs, HillsEdge, PageShell } from "@/components/layout/page-shell";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { FaqSection, PairWith, Story } from "@/components/journey/sections";
import { FlightEnquiryForm } from "@/components/booking/flight-enquiry-form";
import { AirportDirectoryProvider } from "@/components/booking/flight-airport-input";
import { FlightRoutes } from "@/components/booking/flight-departures-board";
import { airlines } from "@/lib/flight-airlines";
import { todayInRwanda } from "@/lib/flight-enquiry-schema";
import { journeyImages, type Faq } from "@/lib/journeys";
import { requirePublicService } from "@/lib/publication";
import { getSite } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Flights",
  description:
    "Plan your flight with Thrill Rwanda. Choose your route and our Kigali travel desk checks fares for your dates and sends them in writing. Nothing is charged until you accept.",
  alternates: { canonical: "/flights" },
};

const FORM_ID = "flight-request";

const assurances = [
  { icon: ReceiptText, title: "Fares in writing", body: "Each with how long the price holds" },
  { icon: Plane, title: "Any airline, any route", body: "Compared for your dates and cabin" },
  { icon: Headset, title: "One desk after you book", body: "Changes, name fixes and refunds" },
  { icon: ShieldCheck, title: "Nothing charged", body: "Until you accept a fare" },
];

const steps = [
  { title: "Tell us the route", body: "Airports, dates, who is flying and the cabin you want. It takes a minute." },
  { title: "We check the fares", body: "The Kigali desk compares airlines for your dates and sends the options in writing, each with the time its price holds until." },
  { title: "Accept and pay", body: "Choose a fare. Your ticket is issued once payment for the whole fare is confirmed." },
  { title: "Fly, with us behind you", body: "Your e-ticket and itinerary are sent to you, and the same desk handles any change before you fly." },
];

const faqs: Faq[] = [
  ["Is the fare you send final?", "The price on your quote holds until the time written on it. Airlines can change fares until a ticket is issued, so if the time passes we check again and send you the new price before you pay anything."],
  ["When do I pay?", "Only after you accept a fare. The ticket is issued once payment for the whole fare has been confirmed; a part payment does not hold a ticket."],
  ["Can I book for family, colleagues or a group?", "Yes. One request covers up to 20 travellers. For larger groups, school trips or delegations, use Groups & Schools and we plan it as one journey."],
  ["Do you need our passports to send a fare?", "No. Once you choose a fare we ask for each traveller's name exactly as it is on the passport, their date of birth and passport details, which the airline needs to issue the ticket."],
  ["What if my plans change?", "Ask the desk. We raise changes, name corrections, cancellations and refunds with the airline for you, and tell you the airline's charges before anything is done."],
  ["Can you add a hotel or an airport pickup?", "Yes. Mention it in your request notes, or add it from the links at the bottom of this page, and it comes back on the same written quote."],
];

export default async function FlightsPage() {
  await requirePublicService("FLIGHT");
  const { publications } = await getSite();

  return (
    <PageShell overHero>
      {/* ------------------------------------------------------------ hero */}
      <section className="on-dark relative -mt-[4.5rem] bg-[#061a13] pb-20 pt-[7.5rem] sm:pb-24 lg:-mt-24 lg:pb-28 lg:pt-44">
        {/* On narrow screens the photograph stays in the top band, so it is not blown up behind the whole form. */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-[34rem] overflow-hidden sm:h-[42rem] lg:inset-0 lg:h-auto">
          <Image
            src="/media/photos/rwandair-rcb.jpg"
            alt=""
            fill
            preload
            sizes="100vw"
            className="object-cover object-[88%_45%] sm:object-[70%_45%] lg:object-[60%_45%]"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgb(6 26 19 / 0.88) 0%, rgb(6 26 19 / 0.6) 38%, rgb(6 26 19 / 0.08) 75%), linear-gradient(to top, rgb(6 26 19 / 0.9) 0%, rgb(6 26 19 / 0.35) 45%, transparent 70%)",
            }}
          />
          <div className="scrim-t absolute inset-x-0 top-0 h-40" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-linear-to-t from-[#061a13] to-transparent lg:hidden" />
        </div>

        <Container wide className="relative">
          <Breadcrumbs items={[{ label: "Flights" }]} className="on-media mb-7 text-white/90" />
          <Eyebrow className="on-media text-sun-300">Air tickets · Kigali travel desk</Eyebrow>
          <h1 className="on-media mt-3 max-w-[15ch] text-display text-white">
            Every fare, <em className="text-sun-400">checked by a person.</em>
          </h1>
          <p className="on-media mt-5 max-w-xl text-base leading-relaxed text-white/90 sm:text-lg">
            Tell us where you are flying. Our desk in Kigali compares airlines for your dates and sends you the fares in writing.
          </p>

          <div id={FORM_ID} className="mt-10 scroll-mt-24 sm:mt-12">
            <AirportDirectoryProvider>
              <FlightEnquiryForm submissionKey={randomUUID()} today={todayInRwanda()} />
            </AirportDirectoryProvider>
          </div>

          <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
            {assurances.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-sun-400 ring-1 ring-white/15 backdrop-blur-md">
                  <Icon className="size-[1.1rem]" aria-hidden />
                </span>
                <span className="on-media pt-0.5">
                  <span className="block text-[0.95rem] font-semibold leading-snug text-white">{title}</span>
                  <span className="mt-0.5 block text-sm leading-snug text-white/75">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </Container>
        <HillsEdge className="[--edge:#061a13]" />
      </section>

      {/* ------------------------------------------------- departures + globe */}
      <section className="on-dark relative overflow-hidden bg-[#061a13] py-20 sm:py-28">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "radial-gradient(45% 60% at 78% 45%, rgb(47 128 96 / 0.28), transparent 70%), radial-gradient(40% 50% at 10% 100%, rgb(248 195 0 / 0.06), transparent 70%)" }}
        />
        <Container wide className="relative">
          <FlightRoutes formId={FORM_ID}>
            <div className="mb-8 max-w-xl">
              <Eyebrow>Departures from Kigali</Eyebrow>
              <h2 className="mt-3 text-display-sm text-white">
                Where people <em className="text-sun-400">fly from here</em>
              </h2>
              <p className="mt-5 text-[1.0625rem] leading-relaxed text-forest-100/80">
                The routes our desk is asked for most. Choose a city on the board or the globe and we fill in the search above; pick your dates and we do the rest.
              </p>
            </div>
          </FlightRoutes>
        </Container>
      </section>

      {/* ---------------------------------------------------- how it works */}
      <section className="relative overflow-hidden border-y border-[var(--line)] bg-bone-100 py-20 sm:py-28">
        <div aria-hidden className="imigongo absolute inset-0 opacity-[0.035]" />
        <Container wide className="relative">
          <div className="max-w-2xl">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 text-display-sm">
              From your route <em>to your boarding pass</em>
            </h2>
          </div>
          <ol className="relative mt-12 grid gap-10 lg:mt-16 lg:grid-cols-4 lg:gap-8">
            {/* The flight path the steps sit on. */}
            <span aria-hidden className="absolute bottom-6 left-[1.4rem] top-6 border-l-2 border-dashed border-forest-300 lg:inset-x-6 lg:bottom-auto lg:top-[1.4rem] lg:border-l-0 lg:border-t-2" />
            {steps.map((step, i) => (
              <li key={step.title} className="relative flex gap-5 lg:block">
                <span
                  aria-hidden
                  className={`tnum grid size-11 shrink-0 place-items-center rounded-full font-display text-lg ring-4 ring-bone-100 ${
                    i === steps.length - 1 ? "bg-sun-500 text-forest-950" : "bg-forest-900 text-white"
                  }`}
                >
                  {i === steps.length - 1 ? <Plane className="size-5 rotate-45" /> : i + 1}
                </span>
                <div className="lg:mt-6">
                  <h3 className="text-[1.375rem] leading-[1.15]">{step.title}</h3>
                  <p className="mt-2.5 max-w-sm text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* -------------------------------------------------------- airlines */}
      <section className="py-20 sm:py-28">
        <Container wide className="grid items-center gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-20">
          <div>
            <Eyebrow>Airlines</Eyebrow>
            <h2 className="mt-3 text-display-sm">
              Ask for <em>any airline</em>
            </h2>
            <p className="mt-5 max-w-md text-[1.0625rem] leading-relaxed text-[var(--ink-muted)]">
              These are the airlines travellers ask us for most. Name a preference when you send your route and the desk
              includes it when checking fares.
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(airlines).map(([code, name]) => (
              <li
                key={code}
                className="grid h-20 place-items-center rounded-2xl border border-[var(--line)] bg-white px-4 transition-[border-color,box-shadow] duration-300 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-float)]"
              >
                <Image src={`/media/airlines/${code}.svg`} alt={name} title={name} width={115} height={32} unoptimized className="h-8 w-full object-contain" />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ------------------------------------------------------- the desk */}
      <div className="border-t border-[var(--line)]">
        <Story
          eyebrow="Why use a travel desk"
          heading="A person on your booking,"
          headingEm="not a fare robot"
          body={[
            "Booking sites show you a price. We send you fares we have checked for your dates, explain what each includes, and stay with the booking after you pay.",
            "When a flight is rescheduled, a name is misspelt or plans change, you message the same desk in Kigali, and we take it up with the airline for you.",
          ]}
          list={[
            "Fares quoted in writing, with how long each price holds",
            "Baggage, seats and special assistance asked for you",
            "An airport pickup and a hotel on the same quote",
            "Nothing booked or charged until you accept",
          ]}
          image={journeyImages.flights}
          imageAlt="A RwandAir Airbus taking off"
          imagePosition="40% 50%"
          caption="Your Kigali travel desk"
        />
      </div>

      <FaqSection items={faqs} title={<>Flights, <em>answered</em></>} />

      <PairWith
        keys={["transport", "stays", "cityTour"]}
        publications={publications}
        eyebrow="When you land"
        title={<>Arrive to <em className="text-sun-400">everything ready</em></>}
        lede="Add an airport pickup, a room or a day in Kigali to the same request. One desk, one written quote."
      />
    </PageShell>
  );
}
