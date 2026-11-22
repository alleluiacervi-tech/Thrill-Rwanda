import { describe, expect, it } from "vitest";
import { dueJobs, expiredBackups, kigaliMinuteOfDay, VPS_JOBS } from "./vps-schedule";

const at = (iso: string) => new Date(iso);
const names = (d: Date) => dueJobs(d).map((j) => j.name);

describe("VPS schedule", () => {
  it("uses Kigali time (UTC+2), wrapping past midnight", () => {
    expect(kigaliMinuteOfDay(at("2026-11-19T00:30:00Z"))).toBe(150);
    expect(kigaliMinuteOfDay(at("2026-11-19T23:15:00Z"))).toBe(75);
  });

  it("runs notifications and payment reconciliation every five minutes", () => {
    expect(names(at("2026-11-19T10:05:00Z"))).toEqual(["enquiry-notifications", "reconcile-payments"]);
    expect(names(at("2026-11-19T10:07:00Z"))).toEqual([]);
  });

  it("runs each daily job once, at its Kigali time", () => {
    expect(names(at("2026-11-19T00:30:00Z"))).toContain("backup");
    expect(names(at("2026-11-19T02:00:00Z"))).toContain("document-maintenance");
    expect(names(at("2026-11-19T03:00:00Z"))).toContain("release-holds");
    const daily = VPS_JOBS.filter((j) => j.dailyAt).map((j) => j.name);
    let runs = 0;
    for (let m = 0; m < 1440; m++) {
      runs += dueJobs(new Date(Date.UTC(2026, 10, 19, 0, m))).filter((j) => daily.includes(j.name)).length;
    }
    expect(runs).toBe(daily.length);
  });

  it("prunes only old backup files", () => {
    const now = at("2026-11-19T00:00:00Z");
    const old = at("2026-11-01T00:00:00Z");
    const recent = at("2026-11-18T00:00:00Z");
    expect(
      expiredBackups(
        [
          { name: "a.trb", modified: old },
          { name: "a.trb.json", modified: old },
          { name: "b.trb", modified: recent },
          { name: "notes.txt", modified: old },
        ],
        now,
        14,
      ),
    ).toEqual(["a.trb", "a.trb.json"]);
  });
});
