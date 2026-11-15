vi.mock("@/lib/whatsapp", () => ({ enqueueWhatsAppStatus: vi.fn() }));
vi.mock("@/lib/enquiry-outbox", () => ({
  enqueueEnquiryNotifications: vi.fn(),
  enqueueOwnerNotification: vi.fn(),
}));
import { beforeEach, describe, expect, it, vi } from "vitest";
const { tx } = vi.hoisted(() => ({
  tx: {
    user: { findUnique: vi.fn() },
    enquiry: { findFirst: vi.fn(), updateMany: vi.fn() },
    enquiryActivity: { create: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({
  db: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
}));
import { updateEnquiry } from "./enquiry-triage";
import { triageSchema } from "./enquiry-workflow";
const row = {
  id: "lead",
  reference: "TRQ-test",
  version: 2,
  status: "NEW",
  ownerId: null,
  firstResponseAt: null,
  nextFollowUp: null,
};
const actor = {
  id: "actor",
  role: "CUSTOMER",
  staffRole: "SALES",
  isActive: true,
};
const input = () =>
  triageSchema.parse({
    reference: row.reference,
    version: 2,
    status: "CONTACTED",
    ownerId: "cf339010-0b71-44da-94ba-9b93817e157e",
  });
beforeEach(() => {
  vi.resetAllMocks();
  tx.user.findUnique.mockResolvedValue({ ...actor, id: input().ownerId });
  tx.enquiry.findFirst.mockResolvedValue(row);
  tx.enquiry.updateMany.mockResolvedValue({ count: 1 });
});
describe("audited, conflict-safe triage", () => {
  it("atomically records status and first contact with an activity", async () => {
    const owner = input().ownerId!;
    await updateEnquiry(owner, input());
    expect(tx.enquiry.updateMany.mock.calls[0][0].where).toMatchObject({
      version: 2,
    });
    expect(
      tx.enquiry.updateMany.mock.calls[0][0].data.firstResponseAt,
    ).toBeInstanceOf(Date);
    expect(tx.enquiryActivity.create).toHaveBeenCalledTimes(1);
  });
  it("rejects stale forms without writing", async () => {
    await expect(
      updateEnquiry(input().ownerId!, { ...input(), version: 1 }),
    ).rejects.toThrow("Reload");
    expect(tx.enquiryActivity.create).not.toHaveBeenCalled();
  });
  it("rejects a lost concurrent compare-and-swap without an audit event", async () => {
    tx.enquiry.updateMany.mockResolvedValue({ count: 0 });
    await expect(updateEnquiry(input().ownerId!, input())).rejects.toThrow(
      "Reload",
    );
    expect(tx.enquiryActivity.create).not.toHaveBeenCalled();
  });
  it("requires follow-up when more information is needed", async () => {
    await expect(
      updateEnquiry(input().ownerId!, {
        ...input(),
        status: "NEEDS_INFORMATION",
      }),
    ).rejects.toThrow("follow-up");
  });
  it("requires ownership and refuses assigning a different user", async () => {
    tx.user.findUnique.mockResolvedValueOnce({
      ...actor,
      id: "different-actor",
    });
    await expect(updateEnquiry("different-actor", input())).rejects.toThrow(
      "yourself",
    );
  });
  it("rechecks access and denies suspended users", async () => {
    tx.user.findUnique.mockResolvedValue({ ...actor, isActive: false });
    await expect(updateEnquiry("actor", input())).rejects.toThrow("access");
    expect(tx.enquiry.updateMany).not.toHaveBeenCalled();
  });
  it("cannot update another workspace's record", async () => {
    tx.enquiry.findFirst.mockResolvedValue(null);
    await expect(updateEnquiry("actor", input())).rejects.toThrow("not found");
  });
  it("requires evidence before recording a quote", async () => {
    tx.enquiry.findFirst.mockResolvedValue({
      ...row,
      status: "CONTACTED",
      ownerId: input().ownerId,
    });
    await expect(
      updateEnquiry(input().ownerId!, { ...input(), status: "QUOTE_SENT" }),
    ).rejects.toThrow("quotation workspace");
  });
  it("prevents finance from editing customer notes or assignment", async () => {
    tx.user.findUnique.mockResolvedValue({ ...actor, staffRole: "FINANCE" });
    tx.enquiry.findFirst.mockResolvedValue({
      ...row,
      status: "AWAITING_PAYMENT",
    });
    await expect(
      updateEnquiry("actor", {
        ...input(),
        status: "AWAITING_PAYMENT",
        note: "private note",
      }),
    ).rejects.toThrow("Finance");
  });
});
