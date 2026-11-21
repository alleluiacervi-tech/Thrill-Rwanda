import { describe, it, expect } from "vitest";
import {
  defaultPublications,
  publicationMap,
  visiblePath,
  approvalSchema,
  interactionSchema,
  csvCell,
  supportSchema,
  policySchema,
} from "./launch-rules";
import { resetDeliveryNotice } from "./auth-notice";
import { documentDeadline } from "./document-access";
import { reportRange } from "./operations-report";
describe("launch controls and operational boundaries", () => {
  it("defaults services to enquiries and hides all transport entry points together", () => {
    expect(
      Object.values(defaultPublications()).every((m) => m === "ENQUIRY"),
    ).toBe(true);
    const p = publicationMap([{ service: "TRANSPORT", mode: "HIDDEN" }]);
    expect(visiblePath("/cars", p)).toBe(false);
    expect(visiblePath("/transfers", p)).toBe(false);
    expect(visiblePath("/flights", p)).toBe(true);
  });
  it("gates the product doors and the pages nested under them", () => {
    const trips = publicationMap([{ service: "TRIP", mode: "HIDDEN" }]);
    for (const path of [
      "/experiences",
      "/experiences/honeymoon",
      "/experiences/kigali-city-tour?from=home",
      "/tembera-urwanda",
      "/tours/gorilla-trekking",
    ])
      expect(visiblePath(path, trips)).toBe(false);
    expect(visiblePath("/weddings", trips)).toBe(true);
    expect(visiblePath("/groups", trips)).toBe(true);
    const events = publicationMap([{ service: "EVENT", mode: "HIDDEN" }]);
    expect(visiblePath("/weddings", events)).toBe(false);
    expect(visiblePath("/events-business", events)).toBe(false);
    expect(visiblePath("/weddings#request", events)).toBe(false);
    expect(visiblePath("/experiences/honeymoon", events)).toBe(true);
    const groups = publicationMap([{ service: "GROUP", mode: "HIDDEN" }]);
    expect(visiblePath("/groups", groups)).toBe(false);
    expect(visiblePath("/corporate", groups)).toBe(false);
    // Pages with no service behind them are never hidden.
    for (const path of ["/", "/about", "/how-it-works", "/legal/privacy"])
      expect(visiblePath(path, trips)).toBe(true);
  });
  it("rejects direct flight, group and event booking", () => {
    for (const service of ["FLIGHT", "GROUP", "EVENT"])
      expect(
        approvalSchema.safeParse({
          service,
          mode: "DIRECT",
          version: -1,
          evidence: "Checked approval reference",
        }).success,
      ).toBe(false);
  });
  it("requires approval evidence and bounded document retention", () => {
    expect(policySchema.safeParse({}).success).toBe(false);
    expect(
      approvalSchema.safeParse({
        service: "TRIP",
        mode: "DIRECT",
        version: -1,
        evidence: "",
      }).success,
    ).toBe(false);
  });
  it("never collects arbitrary analytics properties or sensitive paths", () => {
    expect(
      interactionSchema.safeParse({ service: "FLIGHT", placement: "HOME_HERO" })
        .success,
    ).toBe(true);
    expect(
      interactionSchema.safeParse({
        service: "FLIGHT",
        placement: "HOME_HERO",
        email: "person@example.invalid",
      }).success,
    ).toBe(false);
    expect(
      interactionSchema.safeParse({
        service: "FLIGHT",
        placement: "/flights?name=Private",
      }).success,
    ).toBe(false);
  });
  it("escapes CSV quotes, line breaks and formula prefixes", () => {
    for (const value of ["=2+2", " +SUM(A1)", "\t@cmd", "\r-1", "-100"])
      expect(csvCell(value).startsWith("\"'")).toBe(true);
    expect(csvCell('hello,"world"')).toBe('"hello,""world"""');
    expect(csvCell("USD")).toBe('"USD"');
  });
  it("does not leak reset tokens outside explicit development", () => {
    for (const env of ["production", "test", undefined])
      expect(
        resetDeliveryNotice(env, "https://private/token=secret"),
      ).not.toContain("secret");
    expect(resetDeliveryNotice("development", "local-token")).toContain(
      "local-token",
    );
  });
  it("never extends a stored deadline when policy grows", () => {
    const uploaded = new Date("2026-01-01T00:00Z"),
      expiry = new Date("2026-01-08T00:00Z");
    expect(documentDeadline(uploaded, expiry, 90)).toEqual(expiry);
    expect(documentDeadline(uploaded, null, 90)).toEqual(
      new Date("2026-01-31T00:00Z"),
    );
    expect(documentDeadline(uploaded, expiry, 3)).toEqual(
      new Date("2026-01-04T00:00Z"),
    );
  });
  it("requires linked case, owner, next action and resolution outcome", () => {
    expect(supportSchema.safeParse({}).success).toBe(false);
  });
  it("uses inclusive Kigali days and bounds reporting ranges", () => {
    const r = reportRange("2026-11-01", "2026-11-07");
    expect(r.gte.toISOString()).toBe("2026-10-31T22:00:00.000Z");
    expect(r.lt.toISOString()).toBe("2026-11-07T22:00:00.000Z");
    for (const dates of [
      ["2026-02-30", "2026-03-01"],
      ["2026-01-01", "2026-12-01"],
      ["2026-11-10", "2026-11-01"],
      ["bad", "bad"],
    ])
      expect(() => reportRange(...(dates as [string, string]))).toThrow();
  });
});
