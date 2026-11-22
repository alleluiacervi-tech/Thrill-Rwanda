import { describe, expect, it } from "vitest";
import { isNight, pickupPoint, quoteZoneTrip, splitAreas, vehiclesFor } from "@/lib/transfer-zones-shared";

// A sample zone price.
const ZONE_3 = { sedanMinor: 600_000, vanMinor: 900_000, premiumMinor: 1_200_000 };
const JKIA = pickupPoint("KGL")!;
const NYABUGOGO = pickupPoint("NYABUGOGO")!;

describe("quoteZoneTrip", () => {
  it("charges the vehicle's zone price by day", () => {
    expect(quoteZoneTrip({ zone: ZONE_3, vehicle: "sedan", point: JKIA, fromPoint: true, time: "10:00" }).totalMinor).toBe(600_000);
    expect(quoteZoneTrip({ zone: ZONE_3, vehicle: "van", point: JKIA, fromPoint: true, time: "10:00" }).totalMinor).toBe(900_000);
    expect(quoteZoneTrip({ zone: ZONE_3, vehicle: "premium", point: JKIA, fromPoint: true, time: "10:00" }).totalMinor).toBe(1_200_000);
  });

  it("adds 15% at night, rounded up to the next whole USD", () => {
    const q = quoteZoneTrip({ zone: { ...ZONE_3, sedanMinor: 1_500 }, vehicle: "sedan", point: JKIA, fromPoint: true, time: "23:30" });
    expect(q.extras).toEqual([{ label: expect.stringContaining("Night"), minor: 300 }]);
    expect(q.totalMinor).toBe(1_800);
  });

  it("adds terminus parking only when collected at Nyabugogo", () => {
    expect(quoteZoneTrip({ zone: ZONE_3, vehicle: "sedan", point: NYABUGOGO, fromPoint: true, time: "10:00" }).totalMinor).toBe(600_500);
    expect(quoteZoneTrip({ zone: ZONE_3, vehicle: "sedan", point: NYABUGOGO, fromPoint: false, time: "10:00" }).totalMinor).toBe(600_000);
  });
});

describe("isNight", () => {
  it("runs from 9pm to just before 5am", () => {
    expect(isNight("20:59")).toBe(false);
    expect(isNight("21:00")).toBe(true);
    expect(isNight("04:59")).toBe(true);
    expect(isNight("05:00")).toBe(false);
  });
});

describe("vehiclesFor", () => {
  it("offers only vehicles with enough seats", () => {
    expect(vehiclesFor(4).map((v) => v.key)).toEqual(["sedan", "van", "premium"]);
    expect(vehiclesFor(5).map((v) => v.key)).toEqual(["van"]);
    expect(vehiclesFor(8)).toEqual([]);
  });
});

describe("splitAreas", () => {
  it("drops blanks and spaces", () => {
    expect(splitAreas(" Kiyovu, Kacyiru ,, ")).toEqual(["Kiyovu", "Kacyiru"]);
  });
});
