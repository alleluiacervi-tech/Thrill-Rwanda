/**
 * The vocabulary of a tailored request: which journey it is, and the extra
 * questions that journey asks. Shared by the form (what to show), the schema
 * (what to accept) and the tour form (which collection an offer belongs to).
 *
 * Choices are stored as the words the customer saw, so staff read "Garden or
 * lakeshore" in the enquiry workspace rather than a code.
 */

export const JOURNEY_KEYS = [
  "FLIGHT",
  "PRIVATE_LUXURY",
  "HONEYMOON",
  "CITY_TOUR",
  "SAFARI",
  "TEMBERA",
  "WEDDING",
  "BUSINESS_EVENT",
  "SCHOOL",
  "GROUP",
] as const;
export type JourneyKey = (typeof JOURNEY_KEYS)[number];

/** The enquiry service each journey is filed under. */
export const JOURNEY_SERVICE: Record<JourneyKey, string> = {
  FLIGHT: "FLIGHT",
  PRIVATE_LUXURY: "TRIP",
  HONEYMOON: "TRIP",
  CITY_TOUR: "TRIP",
  SAFARI: "TRIP",
  TEMBERA: "TRIP",
  WEDDING: "EVENT",
  BUSINESS_EVENT: "EVENT",
  SCHOOL: "GROUP",
  GROUP: "GROUP",
};

export const JOURNEY_LABELS: Record<JourneyKey, string> = {
  FLIGHT: "Flight",
  PRIVATE_LUXURY: "Private & luxury tour",
  HONEYMOON: "Honeymoon",
  CITY_TOUR: "Kigali city tour",
  SAFARI: "Tour or safari",
  TEMBERA: "Tembera u Rwanda",
  WEDDING: "Wedding or event",
  BUSINESS_EVENT: "Thrill Events & Business",
  SCHOOL: "School trip",
  GROUP: "Group trip",
};

export const isJourneyKey = (value: unknown): value is JourneyKey =>
  typeof value === "string" && (JOURNEY_KEYS as readonly string[]).includes(value);

/* ----------------------------------------------------- tour collections */

/** The collections an offer can be filed under, in the tour form. */
export const TOUR_COLLECTIONS = [
  "SAFARI",
  "PRIVATE_LUXURY",
  "HONEYMOON",
  "CITY_TOUR",
  "TEMBERA",
  "SCHOOL",
] as const satisfies readonly JourneyKey[];
export type TourCollection = (typeof TOUR_COLLECTIONS)[number];

export const isTourCollection = (value: unknown): value is TourCollection =>
  typeof value === "string" && (TOUR_COLLECTIONS as readonly string[]).includes(value);

/* ------------------------------------------------------------- questions */

export const EVENT_TYPES = [
  "Wedding",
  "Introduction or engagement",
  "Anniversary",
  "Family celebration",
  "Reception or gala dinner",
  "Something else",
] as const;

export const BUSINESS_EVENT_TYPES = [
  "Retreat or offsite",
  "Meeting or conference",
  "Delegation travel",
] as const;

export const VENUE_STYLES = [
  "Garden or lakeshore",
  "Hall or ballroom",
  "Lodge or hilltop",
  "City venue in Kigali",
  "Not sure yet",
] as const;

/** What help is wanted around the venue. More than one may be chosen. */
export const EVENT_NEEDS = [
  "Venue reservation",
  "Catering",
  "Décor",
  "Guest transport",
  "Rooms for guests",
] as const;

export const AGE_GROUPS = [
  "Primary",
  "Lower secondary",
  "Upper secondary",
  "University",
  "Adults",
  "Mixed ages",
] as const;

/**
 * "Add to this request": the other doors that can ride on the same quote.
 * `service` hides a choice when that service is not being offered.
 */
export const ADD_ONS = [
  { label: "Flights", service: "FLIGHT" },
  { label: "Airport transfers", service: "TRANSPORT" },
  { label: "Accommodation", service: "STAY" },
  { label: "A honeymoon", service: "TRIP" },
  { label: "A day in Kigali", service: "TRIP" },
  { label: "A private tour", service: "TRIP" },
] as const;
export type AddOn = (typeof ADD_ONS)[number]["label"];

/** A comma-separated list in which every item is one of `allowed`. */
export function listOf(value: string, allowed: readonly string[]) {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.every((item) => allowed.includes(item)) ? items : null;
}

/* ------------------------------------------------------------ form copy */

export type JourneyForm = {
  /** Heading on the form card. */
  title: string;
  /** Label for the party-size field. */
  party: string;
  location: { label: string; placeholder: string; value?: string };
  message: { label: string; placeholder: string };
  /** Offered under "Add to this request". */
  addOns: AddOn[];
};

const general: JourneyForm = {
  title: "Travel request",
  party: "People travelling",
  location: { label: "Where would you like to go?", placeholder: "A park, a town, or just Rwanda" },
  message: {
    label: "What would you like us to arrange?",
    placeholder: "What you hope to see or do, and anything we should plan around.",
  },
  addOns: ["Flights", "Airport transfers", "Accommodation"],
};

const forms: Partial<Record<JourneyKey, JourneyForm>> = {
  PRIVATE_LUXURY: {
    title: "Design a private tour",
    party: "People travelling",
    location: { label: "Places you would like to include", placeholder: "Volcanoes, Nyungwe, Lake Kivu…" },
    message: {
      label: "How do you like to travel?",
      placeholder: "The pace you prefer, the kind of lodge you enjoy, what you most want to see.",
    },
    addOns: ["Flights", "Airport transfers", "A day in Kigali"],
  },
  HONEYMOON: {
    title: "Plan your honeymoon",
    party: "People travelling",
    location: { label: "Places you would like to include", placeholder: "Lake Kivu, a forest lodge, the gorillas…" },
    message: {
      label: "Tell us about the two of you",
      placeholder: "What would make it yours: quiet days, a trek, a celebration dinner.",
    },
    addOns: ["Flights", "Airport transfers", "A private tour"],
  },
  CITY_TOUR: {
    title: "Book a day in Kigali",
    party: "People joining",
    location: { label: "Where should we collect you?", placeholder: "Your hotel, or the airport", value: "Kigali" },
    message: {
      label: "What interests you most?",
      placeholder: "History, markets, art, coffee. Tell us your flight times if it is a layover.",
    },
    addOns: ["Flights", "Airport transfers", "Accommodation"],
  },
  SAFARI: {
    title: "Plan a tour or safari",
    party: "People travelling",
    location: { label: "Where would you like to go?", placeholder: "Volcanoes, Akagera, Nyungwe…" },
    message: {
      label: "What would you like to see?",
      placeholder: "Gorillas, chimpanzees, the Big Five, or a mix. Tell us how many days you have.",
    },
    addOns: ["Flights", "Airport transfers", "Accommodation"],
  },
  TEMBERA: {
    title: "Join Tembera u Rwanda",
    party: "Places needed",
    location: { label: "Where would you like to go?", placeholder: "Anywhere in Rwanda", value: "Anywhere in Rwanda" },
    message: {
      label: "What would you like to see?",
      placeholder: "The places or the kind of trip you are hoping for, and when you could travel.",
    },
    addOns: ["Flights", "A day in Kigali", "Accommodation"],
  },
  WEDDING: {
    title: "Check a date",
    party: "Guests expected",
    location: { label: "Where would you like the venue?", placeholder: "Kigali, Lake Kivu, or open to ideas" },
    message: {
      label: "Tell us about the day",
      placeholder: "How you picture it, alternative dates, and anything the venue must have.",
    },
    addOns: ["A honeymoon", "Flights", "Airport transfers"],
  },
  BUSINESS_EVENT: {
    title: "Request an event proposal",
    party: "Attendees expected",
    location: { label: "Preferred location", placeholder: "Kigali, Lake Kivu, or open to ideas" },
    message: {
      label: "What should we plan around?",
      placeholder: "Tell us about your agenda, room needs, meeting setup, accessibility and any other requirements.",
    },
    addOns: ["Flights", "Airport transfers", "Accommodation", "A private tour"],
  },
  SCHOOL: {
    title: "Plan a school trip",
    party: "Total travelling",
    location: { label: "Where would you like to take them?", placeholder: "A park, museums in Kigali, or open to ideas" },
    message: {
      label: "What is the trip for?",
      placeholder: "The subject or purpose, how many days, and anything we should plan around.",
    },
    addOns: ["A day in Kigali", "Accommodation"],
  },
  GROUP: {
    title: "Plan a group trip",
    party: "People travelling",
    location: { label: "Where would you like to go?", placeholder: "A park, a town, or open to ideas" },
    message: {
      label: "Tell us about the group",
      placeholder: "Who is travelling, why, and anything we should plan around.",
    },
    addOns: ["Flights", "Airport transfers", "Accommodation"],
  },
};

export const journeyForm = (journey: string): JourneyForm =>
  (isJourneyKey(journey) ? forms[journey] : undefined) ?? general;
