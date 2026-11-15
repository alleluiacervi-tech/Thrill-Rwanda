import { describe, expect, it } from "vitest";
import {
  allowedEnquiryTransitions,
  canUseEnquiries,
  enquiryScope,
  followUpDate,
  type EnquiryActor,
} from "./enquiry-workflow";
const actor = (
  staffRole: string | null,
  role = "CUSTOMER",
  isActive = true,
): EnquiryActor => ({ id: "actor", role, staffRole, isActive });
describe("enquiry permissions and state transitions", () => {
  it("denies public customer/provider access and inactive staff", () => {
    expect(canUseEnquiries(actor(null))).toBe(false);
    expect(canUseEnquiries(actor(null, "PROVIDER"))).toBe(false);
    expect(canUseEnquiries(actor("SALES", "CUSTOMER", false))).toBe(false);
  });
  it("scopes sales and operations to assigned or unassigned leads", () => {
    for (const role of ["SALES", "OPERATIONS"])
      expect(enquiryScope(actor(role))).toEqual({
        OR: [{ ownerId: "actor" }, { ownerId: null }],
      });
    expect(enquiryScope(actor(null, "ADMIN"))).toEqual({});
  });
  it("limits finance to financial milestones and visible financial states", () => {
    expect(
      allowedEnquiryTransitions(actor("FINANCE"), "AWAITING_PAYMENT"),
    ).toEqual(["PARTNER_PROCESSING"]);
    expect(allowedEnquiryTransitions(actor("FINANCE"), "CANCELLED")).toEqual([
      "REFUNDED",
    ]);
    expect(
      allowedEnquiryTransitions(actor("SALES"), "AWAITING_PAYMENT"),
    ).not.toContain("PARTNER_PROCESSING");
    expect(enquiryScope(actor("FINANCE"))).toHaveProperty("status");
  });
  it("prevents skipped lifecycle stages and reopening terminal outcomes", () => {
    expect(
      allowedEnquiryTransitions(actor(null, "ADMIN"), "NEW"),
    ).not.toContain("CONFIRMED");
    for (const status of ["COMPLETED", "LOST", "REFUNDED"] as const)
      expect(allowedEnquiryTransitions(actor(null, "ADMIN"), status)).toEqual(
        [],
      );
  });
  it("interprets follow-ups in Kigali and rejects impossible dates", () => {
    expect(followUpDate("2027-01-01T10:30")?.toISOString()).toBe(
      "2027-01-01T08:30:00.000Z",
    );
    expect(() => followUpDate("2027-02-30T10:00")).toThrow();
    expect(followUpDate("")).toBeNull();
  });
});
