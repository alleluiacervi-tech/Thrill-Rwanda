import { describe, expect, it } from "vitest";
import { change, median, previous, readRange } from "./analytics";

// 18 November 2026, 09:00 in Kigali.
const now = new Date("2026-11-18T07:00:00Z");

describe("dashboard date ranges", () => {
  it("defaults to the last 30 Kigali days, today included", () => {
    const r = readRange({}, now);
    expect(r).toMatchObject({ from: "2026-10-20", to: "2026-11-18", days: 30 });
    expect(r.gte.toISOString()).toBe("2026-10-19T22:00:00.000Z");
    expect(r.lt.toISOString()).toBe("2026-11-18T22:00:00.000Z");
  });

  it("reads the presets and a custom range, and never runs into the future", () => {
    expect(readRange({ days: "7" }, now)).toMatchObject({ from: "2026-11-12", to: "2026-11-18", days: 7 });
    expect(readRange({ from: "2026-11-01", to: "2026-11-30" }, now)).toMatchObject({ from: "2026-11-01", to: "2026-11-18", days: 18 });
  });

  it("falls back safely on nonsense", () => {
    for (const bad of [{ from: "2026-02-31", to: "2026-03-01" }, { from: "2026-11-10", to: "2026-11-01" }, { days: "-4" }, { days: "abc" }])
      expect(readRange(bad, now).days).toBeGreaterThan(0);
    expect(readRange({ days: "99999" }, now).days).toBe(366);
  });

  it("compares with the same number of days just before", () => {
    const p = previous(readRange({ days: "7" }, now));
    expect(p).toMatchObject({ from: "2026-11-05", to: "2026-11-11", days: 7 });
  });
});

describe("dashboard figures", () => {
  it("shows change only when there is something to compare with", () => {
    expect(change(15, 10)).toBeCloseTo(0.5);
    expect(change(5, 10)).toBeCloseTo(-0.5);
    expect(change(4, 0)).toBeNull();
  });

  it("takes the middle response time, not the average", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 30, 4])).toBe(3);
  });
});
