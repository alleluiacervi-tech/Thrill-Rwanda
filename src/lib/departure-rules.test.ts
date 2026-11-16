import { describe, expect, it } from "vitest";
import {
  clashingRun,
  dateParts,
  departureSchema,
  formatRun,
  runDays,
  runRange,
  seatsLeft,
  type DayInventory,
} from "./departure-rules";

const inventory = (rows: Record<string, [total: number, booked: number, blocked?: boolean]>) =>
  new Map<string, DayInventory>(
    Object.entries(rows).map(([day, [unitsTotal, unitsBooked, isBlocked = false]]) => [
      day,
      { unitsTotal, unitsBooked, isBlocked },
    ]),
  );

describe("dated departures", () => {
  it("occupies the start day and the rest of the itinerary, across a month end", () => {
    expect(runDays("2027-08-30", 3)).toEqual(["2027-08-30", "2027-08-31", "2027-09-01"]);
    expect(runDays(new Date("2027-08-14T00:00:00Z"), 1)).toEqual(["2027-08-14"]);
  });

  it("books an exclusive end, never the start day itself", () => {
    expect(runRange("2027-08-14", 2)).toEqual({ start: "2027-08-14", end: "2027-08-16", lastDay: "2027-08-15" });
    expect(runRange("2027-08-14", 1)).toEqual({ start: "2027-08-14", end: "2027-08-15", lastDay: "2027-08-14" });
  });

  it("lets the tightest day decide how many seats are left", () => {
    const days = runDays("2027-08-14", 3);
    expect(
      seatsLeft(days, inventory({ "2027-08-14": [20, 4], "2027-08-15": [20, 17], "2027-08-16": [20, 0] })),
    ).toBe(3);
  });

  it("sells nothing when a day is closed, missing or oversubscribed", () => {
    const days = runDays("2027-08-14", 2);
    expect(seatsLeft(days, inventory({ "2027-08-14": [20, 0], "2027-08-15": [20, 0, true] }))).toBe(0);
    expect(seatsLeft(days, inventory({ "2027-08-14": [20, 0] }))).toBe(0);
    expect(seatsLeft(days, inventory({ "2027-08-14": [20, 22], "2027-08-15": [20, 0] }))).toBe(0);
    expect(seatsLeft([], inventory({}))).toBe(0);
  });

  it("refuses two runs of one tour that share a day", () => {
    const existing = ["2027-08-14", "2027-09-10"];
    expect(clashingRun("2027-08-15", 2, existing)).toBe("2027-08-14");
    expect(clashingRun("2027-08-13", 2, existing)).toBe("2027-08-14");
    expect(clashingRun("2027-08-16", 2, existing)).toBeUndefined();
    expect(clashingRun("2027-08-12", 2, existing)).toBeUndefined();
  });

  it("writes a run the way a person would say it", () => {
    expect(formatRun("2027-08-14", "2027-08-14")).toBe("Sat 14 Aug 2027");
    expect(formatRun("2027-08-14", "2027-08-15")).toBe("Sat 14 Aug – Sun 15 Aug 2027");
    expect(dateParts("2027-08-14")).toEqual({ weekday: "Sat", day: "14", month: "Aug", year: "2027" });
  });

  it("accepts a real date and a short note only", () => {
    const tourId = "55cb5b18-56d3-42ac-893a-acab45440714";
    expect(departureSchema.parse({ tourId, startsOn: "2027-08-14" }).note).toBe("");
    expect(departureSchema.safeParse({ tourId, startsOn: "14/08/2027" }).success).toBe(false);
    expect(departureSchema.safeParse({ tourId: "nope", startsOn: "2027-08-14" }).success).toBe(false);
    expect(departureSchema.safeParse({ tourId, startsOn: "2027-08-14", note: "x".repeat(121) }).success).toBe(false);
  });
});
