import { expect, it } from "vitest";
import { filterMeetingSpaces, meetingSpaces, meetingVenues } from "./meeting-directory";

const filters = { venue: "", query: "", type: "", layout: undefined, attendees: 0 };

it("uses a unique room key within each property", () => {
  expect(new Set(meetingSpaces.map((room) => `${room.venue}/${room.id}`)).size).toBe(meetingSpaces.length);
  expect(new Set(meetingSpaces.map((room) => room.venue))).toEqual(new Set(meetingVenues.map((venue) => venue.slug)));
});

it("filters on the selected layout instead of room maximum", () => {
  const selection = { ...filters, query: "Kilimanjaro Ballroom", attendees: 400 };
  expect(filterMeetingSpaces({ ...selection, layout: "Theatre" })).toHaveLength(1);
  expect(filterMeetingSpaces({ ...selection, layout: "Banquet" })).toHaveLength(0);
});

it("includes rooms with unpublished figures only when the filters allow them", () => {
  const selection = { ...filters, venue: "kigali-serena-hotel", type: "Boardroom" };
  expect(filterMeetingSpaces(selection)).toHaveLength(2);
  expect(filterMeetingSpaces({ ...selection, attendees: 1 })).toHaveLength(0);
  expect(filterMeetingSpaces({ ...selection, layout: "Boardroom" })).toHaveLength(0);
});
