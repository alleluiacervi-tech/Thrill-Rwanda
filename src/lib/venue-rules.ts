import { z } from "zod";
import { VENUE_STYLES } from "@/lib/journey-requests";

/**
 * Rules for the venue catalogue. Pure, so the form, the actions and the tests
 * share one definition.
 *
 * A venue has no price and no calendar: it is reserved on the customer's
 * behalf after a written quote. What is stored is only what helps a couple
 * choose, and what staff need to check the date with the venue.
 */

/** The kinds a venue can be filed under: the choices on the request form, minus "Not sure yet". */
export const VENUE_KINDS = VENUE_STYLES.filter((s) => s !== "Not sure yet");
export type VenueKind = (typeof VENUE_KINDS)[number];

export const venueSchema = z.object({
  name: z.string().trim().min(3, "Enter the venue's name").max(120),
  kind: z.enum(VENUE_KINDS as [VenueKind, ...VenueKind[]], { error: "Choose the kind of venue" }),
  location: z.string().trim().min(2, "Enter the town or area").max(120),
  capacity: z.coerce
    .number({ error: "Enter how many guests it takes" })
    .int("Enter a whole number")
    .min(2, "Enter how many guests it takes")
    .max(5000, "That is more guests than a venue here takes"),
  description: z.string().trim().min(20, "Describe the venue in a sentence or two").max(2000),
});
export type VenueInput = z.infer<typeof venueSchema>;

export type VenueState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; id: string; slug: string };

/**
 * Why a venue cannot go on the public page yet, or null when it can. A couple
 * choosing where to marry needs to see the place and know what it is.
 */
export function publishBlocker(venue: { images: string[]; description: string }) {
  if (venue.images.length === 0) return "Add at least one photograph before publishing.";
  if (venue.description.trim().length < 20) return "Add a description before publishing.";
  return null;
}

/** "Up to 250 guests". */
export const capacityLabel = (capacity: number) =>
  `Up to ${new Intl.NumberFormat("en-US").format(capacity)} guests`;

/** What the request form is told when a couple starts from a venue's card. */
export const venueContext = (venue: { name: string; location: string }) =>
  `Wedding venue reservation\nVenue: ${venue.name}, ${venue.location}`;
