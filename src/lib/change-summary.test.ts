import { describe, expect, it } from "vitest";
import { formatValue, summariseChanges } from "./change-summary";

const OWNER = "d07b4f82-f6c8-49ec-bc8f-72b724af8f86";

describe("change summary", () => {
  it("shows only what changed, by name, in Kigali time", () => {
    const lines = summariseChanges(
      {
        before: { status: "NEW", ownerId: null, followUp: null, priority: "NORMAL" },
        after: { status: "CONTACTED", ownerId: OWNER, followUp: "2026-11-28T08:00:00.000Z", priority: "NORMAL" },
        reason: "",
        evidence: "Called on WhatsApp.",
      },
      { [OWNER]: "Qa Admin" },
    );
    expect(lines).toEqual([
      { label: "Status", value: "New → Contacted" },
      { label: "Owner", value: "Qa Admin" },
      { label: "Follow-up", value: "28 Nov 2026, 10:00 Kigali" },
      { label: "Evidence", value: "Called on WhatsApp." },
    ]);
  });

  it("reads from/to pairs from the activity log", () => {
    expect(summariseChanges({ announcementOn: { from: false, to: true } })).toEqual([
      { label: "Announcement on", value: "No → Yes" },
    ]);
  });

  it("formats lists, unknown ids and empty records", () => {
    expect(formatValue(["SUPPLIER", "SERVICE_FEE"])).toBe("Supplier, Service fee");
    expect(formatValue(OWNER)).toBe("a linked record");
    expect(summariseChanges(null)).toEqual([]);
  });

  it("skips fields the change didn't set, empty records, and labels amounts", () => {
    expect(
      summariseChanges({
        before: { status: "AWAITING_PAYMENT", reviewed: false },
        after: { reviewed: true, thresholdMinor: 44500 },
        input: { date: null, label: null },
      }),
    ).toEqual([
      { label: "Reviewed", value: "No → Yes" },
      { label: "Threshold (minor units)", value: "44500" },
    ]);
  });
});
