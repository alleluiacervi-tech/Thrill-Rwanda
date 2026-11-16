import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { ServiceEnquiryForm } from "@/components/booking/service-enquiry-form";
import { JourneyIcon } from "@/components/journey/icons";
import {
  Arranges,
  FaqSection,
  JourneyHero,
  PairWith,
  RequestSection,
} from "@/components/journey/sections";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { journeyImages, type Faq, type Point } from "@/lib/journeys";
import { requirePublicService } from "@/lib/publication";
import { getSite } from "@/lib/settings";

// The request form needs a fresh submission token on every load.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Group & school tours in Rwanda",
  description:
    "School trips, university field visits, teams and associations travelling across Rwanda, planned from one brief and confirmed by written quote.",
  alternates: { canonical: "/groups" },
};

const audiences = [
  {
    icon: "graduation",
    name: "Schools & universities",
    body: "Field trips and study visits tied to what is being taught, with supervision planned alongside the school.",
    href: "#schools",
    cta: "See school trips",
  },
  {
    icon: "handshake",
    name: "Teams & companies",
    body: "Retreats, conferences and staff travel, with invoicing and approvals handled for your organisation.",
    href: "/corporate",
    cta: "Corporate travel",
  },
  {
    icon: "users",
    name: "Associations & families",
    body: "Churches, clubs, alumni and extended families travelling together on one plan.",
    href: "#request",
    cta: "Plan a group trip",
  },
] as const;

/** What a visit can teach, and where in Rwanda it is taught. */
const subjects = [
  {
    icon: "leaf",
    subject: "Conservation & biology",
    places: "Nyungwe rainforest · Akagera savannah",
    body: "Primates, canopy ecology and how a national park is protected.",
  },
  {
    icon: "landmark",
    subject: "History & civics",
    places: "Kigali memorials and museums",
    body: "The country's past and its recovery, guided with care for the age of the group.",
  },
  {
    icon: "mountain",
    subject: "Geography",
    places: "Virunga volcanoes · Lake Kivu",
    body: "Volcanic landscapes, crater lakes and the Congo Nile divide, seen on the ground.",
  },
  {
    icon: "palette",
    subject: "Culture & the arts",
    places: "Craft villages · Kigali studios",
    body: "Imigongo, weaving, music and dance, learned from the people who practise them.",
  },
] as const;

const teacherNotes = [
  "Supervision and group sizes planned with the school",
  "A seat for every student, on transport checked for the route",
  "Meals arranged, with dietary needs asked for in advance",
  "The itinerary and the cost per student in writing, ready to share with parents",
];

const arranges: Point[] = [
  { icon: "map", title: "One route for everyone", body: "An itinerary built around the group's purpose, pace and size." },
  { icon: "bus", title: "Transport that fits", body: "Coaches and vehicles sized to the group and checked for the roads ahead." },
  { icon: "bed", title: "Rooms together", body: "Accommodation requested in blocks, so the group stays in one place." },
  { icon: "utensils", title: "Meals for the whole group", body: "Tables booked ahead and dietary needs passed to the kitchen." },
  { icon: "ticket", title: "Entries and permits", body: "Park, museum and activity entries requested for the full party." },
  { icon: "banknote", title: "One quote, one invoice", body: "The total, the cost per person and the payment schedule, in writing." },
];

const faqs: Faq[] = [
  ["How large a group can you plan for?", "Tell us the number and we plan around it. Transport, rooms and entries are checked for the full party before we quote."],
  ["How are school trips supervised?", "Supervision is agreed with the school before the trip. Tell us how many staff are travelling and the ages of the students, and the plan is built around that."],
  ["Can parents see the plan and the cost?", "Yes. The quote sets out the itinerary and the cost per student in writing, so the school can share it."],
  ["Do you offer a single invoice for an organisation?", "The quote states the total and the payment schedule for the group. Credit and monthly billing are agreed separately, in writing."],
  ["Can we have an edition of Tembera u Rwanda just for our group?", "Often, yes. Ask in your request and we will tell you what is possible for your dates and numbers."],
];

export default async function GroupsPage() {
  await requirePublicService("GROUP");
  const { publications } = await getSite();

  return (
    <PageShell overHero>
      <JourneyHero
        eyebrow="Groups & schools"
        title="Travel together,"
        titleEm="planned as one."
        lede="A class, a team, a congregation or three generations of one family. Give us one brief and we plan the journey for everyone on it."
        image={journeyImages.groups}
        imagePosition="center 45%"
        crumbs={[{ label: "Groups & Schools" }]}
        facts={[
          { label: "How it is bought", value: "Written quote" },
          { label: "Priced", value: "Per person and in total" },
          { label: "Planned from", value: "One brief" },
        ]}
        primary={{ href: "#request", label: "Plan a group trip", service: "GROUP" }}
        secondary={{ href: "#schools", label: "School trips" }}
      />

      {/* ------------------------------------------------------- Audiences */}
      <section className="py-20 sm:py-28">
        <Container wide>
          <div className="max-w-2xl">
            <Eyebrow>Who we plan for</Eyebrow>
            <h2 className="mt-3 text-display-sm">
              Every kind of <em>together</em>
            </h2>
          </div>

          <ul className="mt-12 grid gap-4 lg:mt-16 lg:grid-cols-3 lg:gap-5">
            {audiences.map((audience) => (
              <li key={audience.name}>
                <Link
                  href={audience.href}
                  className="group flex h-full flex-col rounded-[var(--radius-panel)] border border-[var(--line)] bg-white p-7 transition-[transform,box-shadow,border-color] duration-500 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-1 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-float)] sm:p-9"
                >
                  <span className="flex items-center justify-between">
                    <span className="grid size-14 place-items-center rounded-full bg-forest-800 text-sun-400">
                      <JourneyIcon name={audience.icon} className="size-6" />
                    </span>
                    <span
                      aria-hidden
                      className="grid size-10 place-items-center rounded-full border border-[var(--line)] text-[var(--ink-muted)] transition-colors duration-500 group-hover:border-sun-500 group-hover:bg-sun-500 group-hover:text-forest-950"
                    >
                      <ArrowUpRight className="size-4" />
                    </span>
                  </span>
                  <h3 className="mt-8 text-[1.75rem] leading-[1.08]">{audience.name}</h3>
                  <p className="mt-3 flex-1 text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
                    {audience.body}
                  </p>
                  <span className="mt-7 inline-flex items-center gap-1.5 border-t border-[var(--line)] pt-5 text-sm font-semibold text-forest-800">
                    {audience.cta}
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

      {/* --------------------------------------------------------- Schools */}
      <section
        id="schools"
        className="on-dark relative scroll-mt-24 overflow-hidden bg-forest-950 py-20 sm:py-28"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 70% at 90% 0%, rgb(47 128 96 / 0.5), transparent 70%)",
          }}
        />
        <div aria-hidden className="contours-light absolute inset-0 opacity-[0.05]" />
        <Container wide className="relative">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Eyebrow>School trips</Eyebrow>
              <h2 className="mt-3 text-display-sm text-white">
                The lesson, <em className="text-sun-400">moved outdoors</em>
              </h2>
              <p className="mt-5 max-w-md text-[1.0625rem] leading-relaxed text-forest-100/80">
                Rwanda puts a rainforest, a savannah, a chain of volcanoes and
                a capital city within a few hours of each other. Tell us what
                the class is studying and we plan the visit around it.
              </p>

              <ul className="mt-9 space-y-3.5 border-t border-white/15 pt-8">
                {teacherNotes.map((note) => (
                  <li key={note} className="flex items-start gap-3.5">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-sun-500 text-forest-950">
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    </span>
                    <span className="text-[0.9375rem] leading-relaxed text-forest-100">
                      {note}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2 lg:gap-5">
              {subjects.map((item) => (
                <li
                  key={item.subject}
                  className="flex flex-col rounded-[var(--radius-card)] bg-white/[0.06] p-6 ring-1 ring-white/12 transition-colors duration-500 hover:bg-white/[0.1] sm:p-7"
                >
                  <span className="grid size-12 place-items-center rounded-full bg-white/10 text-sun-400 ring-1 ring-white/15">
                    <JourneyIcon name={item.icon} className="size-5" />
                  </span>
                  <h3 className="mt-6 text-[1.5rem] leading-[1.1] text-white">
                    {item.subject}
                  </h3>
                  <p className="mt-2.5 flex-1 text-[0.9375rem] leading-relaxed text-forest-100/80">
                    {item.body}
                  </p>
                  <p className="mt-5 border-t border-white/15 pt-4 text-2xs font-semibold uppercase tracking-[0.14em] text-sun-300">
                    {item.places}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <Arranges
        eyebrow="What we arrange"
        title={
          <>
            One brief, <em>everyone accounted for</em>
          </>
        }
        lede="Every part is checked for the full party and listed on one written quote."
        points={arranges}
        className="bg-white"
      />

      <RequestSection
        title={
          <>
            Tell us about <em>your group</em>
          </>
        }
        lede="Who is travelling, how many, roughly when and why. That is enough for us to start. A request does not reserve anything or take a payment."
        steps={[
          ["Send your brief", "The organisation, the number travelling and your dates."],
          ["We check, then quote", "The route, what is included, the cost per person and the total."],
          ["You decide", "Share the quote with your school or committee before anything is booked."],
        ]}
      >
        <ServiceEnquiryForm
          submissionKey={randomUUID()}
          journey="GROUP"
          context="Group or school trip"
        />
      </RequestSection>

      <PairWith
        keys={["tembera", "cityTour", "transport"]}
        publications={publications}
      />

      <FaqSection items={faqs} />
    </PageShell>
  );
}
