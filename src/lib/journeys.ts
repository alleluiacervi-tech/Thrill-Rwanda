/**
 * The product map: every way a traveller can buy from Thrill Rwanda, and how
 * those ways relate to each other.
 *
 * Eight products sit behind five front doors (see docs/PRODUCT_EXPERIENCE_PLAN.md).
 * Pages, the header, the homepage and the sitemap all read from here, so a
 * door is described once. Nothing in this file is a price, a date or a named
 * supplier: those come from the database, after approval.
 */

import type { JourneyKey } from "@/lib/journey-requests";
import type { PublicService } from "@/lib/launch-rules";
import { photo } from "@/lib/images";

/**
 * The campaign's name, in one place. It is also the name of the national
 * domestic-tourism campaign, so confirm the right to trade under it before
 * launch; changing it here changes it everywhere.
 */
export const TEMBERA = {
  name: "Tembera u Rwanda",
  /** What the Kinyarwanda says, for visitors who do not read it. */
  meaning: "Travel Rwanda",
  href: "/tembera-urwanda",
} as const;

/* ------------------------------------------------------------ photography */

/**
 * One frame per product. Paths under /media/photos are real photographs:
 * Thrill Rwanda's own, and Visit Rwanda's, which the owner confirmed may be
 * used here (docs/PHOTO_SOURCES.md lists which is which).
 */
export const journeyImages = {
  privateLuxury: "/media/photos/helicopter-safari.jpg",
  // The one stand-in left: a lodge interior, until there is a photograph of one.
  lodge: photo("photo-1779216175784-a67b6da108bb"),
  honeymoon: "/media/photos/lake-kivu-islands.jpeg",
  cityTour: "/media/photos/kigali-skyline.jpg",
  cityCentre: "/media/photos/kigali-convention-centre-day.jpg",
  safari: "/media/photos/silverback-bamboo.jpg",
  flights: "/media/photos/rwandair-takeoff.jpg",
  weddings: "/media/photos/lake-kivu-dusk.jpg",
  groups: "/media/photos/volcanoes-trek.jpeg",
  // Intore dancers at Nyanza: the campaign is the cultural side of what we sell.
  tembera: "/media/photos/intore-dancers.jpg",
  culture: "/media/photos/kings-palace-nyanza.jpg",
  volcano: "/media/photos/virunga-volcano.jpg",
  transport: "/media/photos/akagera-safari-vehicle.jpg",
  canopy: "/media/photos/nyungwe-canopy-walk-2.jpeg",
  kivu: "/media/photos/lake-kivu-fishermen.jpg",
} as const;

/* ------------------------------------------------------------- collections */

export type Fact = { label: string; value: string };
export type Point = { icon: string; title: string; body: string };
export type Faq = readonly [question: string, answer: string];

/** A themed way to travel, under Tours & Experiences. */
export type Collection = {
  slug: string;
  journey: JourneyKey;
  /** Short name for menus and cards. */
  name: string;
  /** One line under the name in menus. */
  blurb: string;
  eyebrow: string;
  title: string;
  /** The italic half of the headline. */
  titleEm: string;
  lede: string;
  image: string;
  imagePosition?: string;
  facts: Fact[];
  /** What the travel desk arranges. */
  arranges: Point[];
  /** A short editorial passage beside a second photograph. */
  story: {
    heading: string;
    headingEm: string;
    body: string[];
    list: string[];
    image: string;
    imageAlt: string;
    imagePosition?: string;
    caption: string;
  };
  /** Other doors that go well with this one. */
  pairs: PairKey[];
  faqs: Faq[];
  /** Sent with the request so staff see where it began. */
  requestContext: string;
};

export const collections: Collection[] = [
  {
    slug: "private-luxury",
    journey: "PRIVATE_LUXURY",
    name: "Private & Luxury Tours",
    blurb: "Your own guide, vehicle and pace",
    eyebrow: "Private & luxury",
    title: "Rwanda,",
    titleEm: "entirely on your terms.",
    lede: "A journey designed around you alone: your own guide and vehicle, lodges chosen for the way you like to travel, and days that move at your pace.",
    image: journeyImages.privateLuxury,
    imagePosition: "center 50%",
    facts: [
      { label: "How it is bought", value: "Written quote" },
      { label: "Travelling", value: "Just your party" },
      { label: "Built around", value: "Your dates" },
    ],
    arranges: [
      { icon: "compass", title: "A private guide and vehicle", body: "One guide who stays with you, and a vehicle that leaves when you are ready." },
      { icon: "hotel", title: "Lodges chosen for you", body: "Stays matched to how you travel, checked for your dates before anything is promised." },
      { icon: "binoculars", title: "Permits and park entries", body: "Gorilla, chimpanzee and park permits requested for your dates and confirmed in writing." },
      { icon: "utensils", title: "Tables and private moments", body: "Dinners, tastings and quiet hours arranged where the setting deserves them." },
      { icon: "plane", title: "Flights and arrival", body: "International tickets and your airport welcome handled by the same desk." },
      { icon: "shield", title: "One person to call", body: "A named contact from the first message until you are home." },
    ],
    story: {
      heading: "Nothing shared,",
      headingEm: "nothing rushed.",
      body: [
        "A private journey is less about what is added and more about what is removed: the fixed timetable, the crowded vehicle, the stop you did not ask for.",
        "Tell us who is travelling and what matters to you. We shape the route, check every supplier for your dates, and put the whole arrangement in one written quote before you commit to anything.",
      ],
      list: [
        "Routes across Volcanoes, Nyungwe, Akagera, Lake Kivu and Kigali",
        "Pace set by you, changed by you",
        "Every inclusion and exclusion written down",
      ],
      image: journeyImages.lodge,
      imageAlt: "The open lounge of a thatched safari lodge",
      caption: "Lodges chosen for the way you travel",
    },
    pairs: ["flights", "honeymoon", "weddings"],
    faqs: [
      ["How is a private tour priced?", "By written quote. It separates supplier charges from our service fee and states taxes, exclusions, validity and payment deadlines for your arrangement."],
      ["Can you include gorilla permits?", "We request permits for your dates as part of the quote. A permit is confirmed only once it has been issued for your party."],
      ["How far ahead should we ask?", "As early as you can, particularly for peak months and for permits. Send your dates even if they are flexible and we will tell you what is realistic."],
    ],
    requestContext: "Private & luxury tour",
  },
  {
    slug: "honeymoon",
    journey: "HONEYMOON",
    name: "Honeymoons",
    blurb: "Lakeshore sunsets and quiet lodges for two",
    eyebrow: "Honeymoons",
    title: "The first journey",
    titleEm: "you take together.",
    lede: "Lake Kivu at dusk, a lodge above the forest, a morning with the gorillas. We plan the days after the wedding so the two of you only have to arrive.",
    image: journeyImages.honeymoon,
    imagePosition: "center 55%",
    facts: [
      { label: "How it is bought", value: "Written quote" },
      { label: "Designed for", value: "Two" },
      { label: "Pairs with", value: "Your wedding" },
    ],
    arranges: [
      { icon: "sunset", title: "Stays with a view", body: "Lakeshore rooms and forest lodges, requested for your dates and confirmed in writing." },
      { icon: "wine", title: "Dinners for two", body: "Private tables and small celebrations arranged with the lodge." },
      { icon: "binoculars", title: "Days worth remembering", body: "Gorilla and chimpanzee treks, boat trips on Kivu, canopy walks in Nyungwe." },
      { icon: "car", title: "Door-to-door transport", body: "A driver from the reception or the airport, and every transfer in between." },
      { icon: "plane", title: "Flights, if you need them", body: "Tickets into Kigali and onward, quoted by the same desk." },
      { icon: "heart", title: "The small things", body: "Tell us what would make it yours. We ask the suppliers and tell you plainly what is possible." },
    ],
    story: {
      heading: "After the celebration,",
      headingEm: "the quiet.",
      body: [
        "Rwanda is small enough that a honeymoon never has to be spent in transit. Lake, forest and volcano are a few hours apart, so a week can hold all three without a single rushed morning.",
        "If we are also arranging your wedding, the honeymoon is planned alongside it: one conversation, one quote, one desk that knows the dates.",
      ],
      list: [
        "Lake Kivu, Nyungwe and the Virunga foothills",
        "Planned with your wedding or on its own",
        "Guest flights and transfers on the same quote",
      ],
      image: journeyImages.kivu,
      imageAlt: "A fishing boat beside a wooded island on Lake Kivu, seen from the air",
      caption: "Fishermen on Lake Kivu",
    },
    pairs: ["weddings", "privateLuxury", "flights"],
    faqs: [
      ["Can you plan the wedding and the honeymoon together?", "Yes. Send one request with both and we return one written quote covering the venue, guest travel and the honeymoon."],
      ["We are not marrying in Rwanda. Can we still come?", "Of course. Tell us your dates and where you are flying from, and we will quote flights and the journey together."],
      ["Is a deposit needed to hold dates?", "Nothing is held by an enquiry. Your quote states what must be paid, by when, to secure each part of the arrangement."],
    ],
    requestContext: "Honeymoon in Rwanda",
  },
  {
    slug: "kigali-city-tour",
    journey: "CITY_TOUR",
    name: "Kigali City Tour",
    blurb: "The capital's hills, history and markets",
    eyebrow: "Kigali city tour",
    title: "A city that tells",
    titleEm: "its own story.",
    lede: "A guided day through Kigali's hills: its history, its markets, its art and its coffee, with someone who lives here.",
    image: journeyImages.cityTour,
    imagePosition: "center 45%",
    facts: [
      { label: "How it is bought", value: "Written quote" },
      { label: "Length", value: "Half or full day" },
      { label: "Starts from", value: "Your hotel or the airport" },
    ],
    arranges: [
      { icon: "landmark", title: "History, with care", body: "Time at the Kigali Genocide Memorial, guided and unhurried." },
      { icon: "palette", title: "Art and craft", body: "Studios and galleries where Kigali's artists work and sell." },
      { icon: "coffee", title: "Coffee at the source", body: "Rwandan coffee tasted where it is roasted, with the story of the hills it came from." },
      { icon: "map", title: "Markets and neighbourhoods", body: "Kimironko market and the streets of Nyamirambo, on foot with a local guide." },
      { icon: "mountain", title: "The view from above", body: "A hilltop stop to see how the city sits across its valleys." },
      { icon: "car", title: "Transport included", body: "Pickup and drop-off at your hotel, or straight from your flight." },
    ],
    story: {
      heading: "One day,",
      headingEm: "well spent.",
      body: [
        "Most visitors pass through Kigali on the way to the parks. A day here changes how the rest of the country reads.",
        "The route below is typical, not fixed. Tell us how long you have and what interests you, and the guide shapes the day to fit, including a layover between flights.",
      ],
      list: [
        "Suits a first day, a last day or a long layover",
        "Private, or shared with your own group",
        "Stops and timing confirmed in your quote",
      ],
      image: journeyImages.cityCentre,
      imageAlt: "The dome of the Kigali Convention Centre behind its gardens",
      caption: "Kigali Convention Centre",
    },
    pairs: ["flights", "tembera", "groups"],
    faqs: [
      ["Can it fit between two flights?", "Often, yes. Send your arrival and departure times and we will tell you what is comfortable, with airport transfers included."],
      ["Is the tour suitable for children?", "The route is adapted to your group. Tell us the ages travelling and the guide will plan accordingly, including the time spent at the memorial."],
      ["Are entry fees included?", "Your quote lists exactly what is included and what is paid on the day."],
    ],
    requestContext: "Kigali city tour",
  },
];

export const collectionBySlug = (slug: string) =>
  collections.find((c) => c.slug === slug);

/* ------------------------------------------------------------------- doors */

/** The five front doors, in menu order. Flights lead. */
export type Door = {
  key: "flights" | "experiences" | "tembera" | "weddings" | "groups";
  service: PublicService;
  href: string;
  label: string;
  /** One line for menus and the homepage dock. */
  blurb: string;
  icon: string;
};

export const doors: Door[] = [
  { key: "flights", service: "FLIGHT", href: "/flights", label: "Flights", blurb: "Routes, dates and fare conditions checked before you decide.", icon: "plane" },
  { key: "experiences", service: "TRIP", href: "/experiences", label: "Tours & Experiences", blurb: "Private, luxury, honeymoon and city journeys across Rwanda.", icon: "compass" },
  { key: "tembera", service: "TRIP", href: TEMBERA.href, label: TEMBERA.name, blurb: "All-inclusive editions: transport, meals and stays in one booking.", icon: "ticket" },
  { key: "weddings", service: "EVENT", href: "/events-business", label: "Thrill Events & Business", blurb: "Retreats, conferences and delegation travel coordinated in Rwanda.", icon: "heart" },
  { key: "groups", service: "GROUP", href: "/groups", label: "Groups & Schools", blurb: "School trips, teams and associations planned from one brief.", icon: "graduation" },
];

/** Supporting services: live pages, but ingredients of a journey rather than headline products. */
export const essentials: { service: PublicService; href: string; label: string; blurb: string; icon: string }[] = [
  { service: "STAY", href: "/hotels", label: "Hotels & stays", blurb: "Lodges, lakeside rooms and city suites", icon: "hotel" },
  { service: "TRANSPORT", href: "/cars", label: "Car hire", blurb: "Self-drive or with a driver", icon: "car" },
  { service: "TRANSPORT", href: "/transfers", label: "Airport transfers", blurb: "To and from Kigali International", icon: "plane" },
];

/* ------------------------------------------------------------- cross-sell */

export type PairKey =
  | "flights"
  | "honeymoon"
  | "weddings"
  | "privateLuxury"
  | "cityTour"
  | "tembera"
  | "groups"
  | "stays"
  | "transport";

/** "Goes well with": how each door is introduced from another door's page. */
export const pairs: Record<
  PairKey,
  { service: PublicService; href: string; title: string; body: string; image: string; cta: string }
> = {
  flights: {
    service: "FLIGHT",
    href: "/flights",
    title: "Flights for the journey",
    body: "Tickets for you or your guests, quoted by the same desk and added to the same plan.",
    image: journeyImages.flights,
    cta: "Request a flight quote",
  },
  honeymoon: {
    service: "TRIP",
    href: "/experiences/honeymoon",
    title: "A honeymoon to follow",
    body: "Lake Kivu, a forest lodge and a morning with the gorillas, planned alongside the wedding.",
    image: journeyImages.honeymoon,
    cta: "Plan the honeymoon",
  },
  weddings: {
    service: "EVENT",
    href: "/weddings",
    title: "The wedding itself",
    body: "A venue reserved for your date, with guest transport and rooms arranged around it.",
    image: journeyImages.weddings,
    cta: "Reserve a venue",
  },
  privateLuxury: {
    service: "TRIP",
    href: "/experiences/private-luxury",
    title: "A private journey",
    body: "Your own guide, vehicle and pace, with lodges chosen for the way you travel.",
    image: journeyImages.privateLuxury,
    cta: "Design a private tour",
  },
  cityTour: {
    service: "TRIP",
    href: "/experiences/kigali-city-tour",
    title: "A day in Kigali",
    body: "The capital's history, markets and coffee with a local guide. Fits a layover.",
    image: journeyImages.cityTour,
    cta: "See the city tour",
  },
  tembera: {
    service: "TRIP",
    href: TEMBERA.href,
    title: TEMBERA.name,
    body: "Join an all-inclusive edition: transport, meals, stays and a guide in one booking.",
    image: journeyImages.tembera,
    cta: "See the editions",
  },
  groups: {
    service: "GROUP",
    href: "/groups",
    title: "Travelling as a group",
    body: "Schools, teams and associations: one brief, one quote, one desk for everyone.",
    image: journeyImages.groups,
    cta: "Plan a group trip",
  },
  stays: {
    service: "STAY",
    href: "/hotels",
    title: "Somewhere to stay",
    body: "Lodges, lakeside rooms and city suites, requested for your dates.",
    image: journeyImages.lodge,
    cta: "Browse stays",
  },
  transport: {
    service: "TRANSPORT",
    href: "/transfers",
    title: "Getting everyone there",
    body: "Airport pickups, coaches and cars with drivers, timed around your plans.",
    image: journeyImages.transport,
    cta: "Arrange transport",
  },
};
