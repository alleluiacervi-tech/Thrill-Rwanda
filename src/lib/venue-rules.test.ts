import { describe, expect, it } from "vitest";
import {
  VENUE_KINDS,
  capacityLabel,
  publishBlocker,
  venueContext,
  venueSchema,
} from "./venue-rules";

const venue = {
  name: "Example Garden",
  kind: "Garden or lakeshore",
  location: "Rubavu, Lake Kivu",
  capacity: "250",
  description: "A lawn that runs down to the water, with a covered terrace behind it.",
};

describe("venue catalogue", () => {
  it("files venues under the kinds the request form offers, without the undecided option", () => {
    expect(VENUE_KINDS).toContain("Hall or ballroom");
    expect(VENUE_KINDS).not.toContain("Not sure yet");
  });

  it("accepts a complete venue and reads capacity as a number", () => {
    expect(venueSchema.parse(venue).capacity).toBe(250);
  });

  it.each([
    { name: "A" },
    { kind: "Castle" },
    { kind: "Not sure yet" },
    { location: "" },
    { capacity: "0" },
    { capacity: "12.5" },
    { capacity: "many" },
    { capacity: "9000" },
    { description: "Nice." },
  ])("rejects an incomplete or implausible venue %j", (change) => {
    expect(venueSchema.safeParse({ ...venue, ...change }).success).toBe(false);
  });

  it("holds a venue back from the public page until it can be seen and described", () => {
    expect(publishBlocker({ images: [], description: venue.description })).toMatch(/photograph/);
    expect(publishBlocker({ images: ["/a.jpg"], description: "Short" })).toMatch(/description/);
    expect(publishBlocker({ images: ["/a.jpg"], description: venue.description })).toBeNull();
  });

  it("words capacity and the request context for people", () => {
    expect(capacityLabel(1200)).toBe("Up to 1,200 guests");
    expect(venueContext({ name: "Example Garden", location: "Rubavu" })).toBe(
      "Wedding venue reservation\nVenue: Example Garden, Rubavu",
    );
  });
});
