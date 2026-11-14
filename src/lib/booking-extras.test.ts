import { describe, expect, it } from "vitest";
import { bookingExtras } from "./booking-extras";

describe("bookingExtras", () => {
  it("returns nothing for empty or odd details", () => {
    expect(bookingExtras(null)).toEqual([]);
    expect(bookingExtras("x")).toEqual([]);
    expect(bookingExtras({ depositPercent: 30 })).toEqual([]);
  });

  it("reads residency, driver and traveller in order", () => {
    const extras = bookingExtras({
      residency: "RESIDENT",
      withDriver: true,
      leadTraveller: "  Test Traveller ",
      leadPhone: "+250788000001",
    });
    expect(extras.map((e) => [e.key, e.value])).toEqual([
      ["residency", "East African resident"],
      ["driver", "With a driver"],
      ["traveller", "Test Traveller"],
      ["phone", "+250788000001"],
    ]);
  });

  it("reads a transfer's route, time, flight and vehicle", () => {
    const extras = bookingExtras({
      transfer: { pickup: "Kigali Airport", dropoff: "Kiyovu", time: "14:30", flight: "KQ101", vehicle: "suv" },
    });
    expect(extras.map((e) => [e.key, e.value])).toEqual([
      ["route", "Kigali Airport → Kiyovu"],
      ["pickupTime", "14:30"],
      ["flight", "KQ101"],
      ["vehicle", "SUV"],
    ]);
  });

  it("skips unknown residencies, self-drive and blank names", () => {
    expect(
      bookingExtras({ residency: "MARTIAN", withDriver: false, leadTraveller: "   " }),
    ).toEqual([]);
  });
});
