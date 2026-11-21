import { beforeEach, describe, expect, it, vi } from "vitest";
import { businessEventMilestones, businessEventUpdate, updateBusinessEvent } from "./business-events";

const tx = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  enquiry: { findFirst: vi.fn(), updateMany: vi.fn() },
  enquiryActivity: { create: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  db: { $transaction: (run: (client: typeof tx) => unknown) => run(tx) },
}));

const milestone = businessEventUpdate.parse({
  command: "MILESTONE",
  reference: "TR-TEST",
  version: 2,
  milestone: "VENUE",
  status: "CONFIRMED",
  evidence: "Venue confirmed in writing.",
});

beforeEach(() => {
  vi.resetAllMocks();
  tx.user.findUnique.mockResolvedValue({ id: "staff", role: "CUSTOMER", staffRole: "OPERATIONS", isActive: true });
  tx.enquiry.findFirst.mockResolvedValue({
    id: "enquiry",
    ownerId: "staff",
    status: "CONTACTED",
    details: { journey: "BUSINESS_EVENT" },
  });
  tx.enquiry.updateMany.mockResolvedValue({ count: 1 });
});

describe("business event operations", () => {
  it("requires a valid hold deadline only for held venues", () => {
    const source = { ...milestone, command: "SOURCE", venue: "Kigali hall", status: "HELD" };
    expect(businessEventUpdate.safeParse({ ...source, holdUntil: "" }).success).toBe(false);
    expect(businessEventUpdate.safeParse({ ...source, holdUntil: "2027-02-30" }).success).toBe(false);
    expect(businessEventUpdate.safeParse({ ...source, holdUntil: "2027-02-28" }).success).toBe(true);
    expect(businessEventUpdate.safeParse({ ...source, status: "AVAILABLE", holdUntil: "2027-02-28" }).success).toBe(false);
  });

  it("records an audited update only against the expected case version", async () => {
    await expect(updateBusinessEvent("staff", milestone)).resolves.toBe("TR-TEST");
    expect(tx.enquiry.updateMany).toHaveBeenCalledWith({
      where: { id: "enquiry", version: 2 },
      data: { version: { increment: 1 } },
    });
    expect(tx.enquiryActivity.create).toHaveBeenCalledWith({
      data: {
        enquiryId: "enquiry",
        actorId: "staff",
        kind: "BUSINESS_EVENT_VENUE",
        body: "Venue confirmed in writing.",
        changes: { status: "CONFIRMED" },
      },
    });
    tx.enquiryActivity.create.mockClear();
    tx.enquiry.updateMany.mockResolvedValue({ count: 0 });
    await expect(updateBusinessEvent("staff", milestone)).rejects.toThrow("case has changed");
    expect(tx.enquiryActivity.create).not.toHaveBeenCalled();
  });

  it("refuses updates to an unrelated journey", async () => {
    tx.enquiry.findFirst.mockResolvedValue({ ownerId: "staff", details: { journey: "WEDDING" } });
    await expect(updateBusinessEvent("staff", milestone)).rejects.toThrow();
    expect(tx.enquiry.updateMany).not.toHaveBeenCalled();
  });

  it("returns only organizer milestone names and statuses", () => {
    expect(businessEventMilestones([
      { kind: "BUSINESS_EVENT_VENUE", changes: { status: "CONFIRMED", privateNote: "Internal" } },
    ])).toEqual([
      { milestone: "VENUE", status: "CONFIRMED" },
      { milestone: "ROOMS", status: "PENDING" },
      { milestone: "TRANSPORT", status: "PENDING" },
      { milestone: "ACTIVITIES", status: "PENDING" },
    ]);
  });
});
