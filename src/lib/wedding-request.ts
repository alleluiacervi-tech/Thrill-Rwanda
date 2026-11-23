import { VENUE_STYLES } from "@/lib/journey-requests";

export type VenueStyle = (typeof VENUE_STYLES)[number];

/** The kinds of venue, as the page shows them. `style` is the value the request saves. */
export const venueKinds: {
  style: VenueStyle;
  name: string;
  body: string;
  suits: string;
  image: string;
  imagePosition?: string;
}[] = [
  {
    style: "Garden or lakeshore",
    name: "Gardens & lakeshores",
    body: "Open-air ceremonies with water or hills behind you.",
    suits: "Ceremonies and sunset receptions",
    image: "/media/photos/lake-kivu-islands.jpeg",
    imagePosition: "center 55%",
  },
  {
    style: "Hall or ballroom",
    name: "Halls & ballrooms",
    body: "Covered, catered spaces built for a full guest list.",
    suits: "Large receptions, any season",
    image: "/media/photos/kigali-marriott-ballroom.jpg",
    imagePosition: "75% center",
  },
  {
    style: "Lodge or hilltop",
    name: "Lodges & hilltops",
    body: "A whole lodge to yourselves, with rooms for the people closest to you.",
    suits: "Intimate weddings and weekends",
    image: "/media/photos/virunga-volcano.jpg",
  },
  {
    style: "City venue in Kigali",
    name: "City venues in Kigali",
    body: "Hotels and event spaces close to the airport and your guests.",
    suits: "Guests flying in",
    image: "/media/photos/kigali-convention-centre-day.jpg",
  },
];

export const weddingLocations = ["Kigali", "Lake Kivu", "Musanze & the volcanoes", "Akagera", "Open to ideas"] as const;

export const MAX_WEDDING_GUESTS = 500;

/** Answers carried from the date checker or a venue card into the request form. */
export type WeddingPrefill = { startDate?: string; partySize?: string; venueStyle?: string };
export const WEDDING_PREFILL_EVENT = "thrill:wedding-prefill";

export function prefillWedding(detail: WeddingPrefill, targetId = "request") {
  window.dispatchEvent(new CustomEvent(WEDDING_PREFILL_EVENT, { detail }));
  document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
