import { describe, expect, it } from "vitest";
import { SITE_DEFAULTS, buildSite, phoneDigits } from "./site-config";

describe("buildSite", () => {
  it("is the built-in site when nothing is set", () => {
    const s = buildSite(null);
    expect(s.name).toBe(SITE_DEFAULTS.name);
    expect(s.contact.phone).toBe(SITE_DEFAULTS.phone);
    expect(s.contact.phoneHref).toBe("tel:+250786261104");
    expect(s.contact.phoneAlt).toBe(SITE_DEFAULTS.phoneAlt);
    expect(s.contact.whatsapp).toBe("https://wa.me/250786261104");
    expect(s.socials).toEqual([]);
    expect(s.rules).toEqual({ holdMinutes: 60, maxPassengers: 6, minNoticeDays: 0 });
    expect(s.payOnline).toEqual({ TOUR: true, VEHICLE: true, TRANSFER: true });
    expect(s.announcement).toBeNull();
  });

  it("uses the admin's values and treats blanks as unset", () => {
    const s = buildSite({ brandName: "Thrill Rwanda", legalName: "  ", phone: "0788 123 456" });
    expect(s.name).toBe("Thrill Rwanda");
    expect(s.legalName).toBe(SITE_DEFAULTS.legalName);
    expect(s.contact.phoneHref).toBe("tel:+250788123456");
    // WhatsApp follows the new main number unless set on its own.
    expect(s.contact.whatsapp).toBe("https://wa.me/250788123456");
    // A changed main number doesn't keep the old second number.
    expect(s.contact.phoneAlt).toBeNull();
  });

  it("lists only the social links that are filled in", () => {
    const s = buildSite({ instagramUrl: "https://instagram.com/x", facebookUrl: "" });
    expect(s.socials.map((x) => x.key)).toEqual(["instagram"]);
  });

  it("shows the announcement only when switched on", () => {
    expect(buildSite({ announcement: "Closed 25 Dec", announcementOn: false }).announcement).toBeNull();
    expect(buildSite({ announcement: "Closed 25 Dec", announcementOn: true }).announcement).toBe("Closed 25 Dec");
  });
});

describe("phoneDigits", () => {
  it("normalises Rwandan numbers for tel: and wa.me links", () => {
    expect(phoneDigits("+250 788 123 456")).toBe("250788123456");
    expect(phoneDigits("0788-123-456")).toBe("250788123456");
  });
});
