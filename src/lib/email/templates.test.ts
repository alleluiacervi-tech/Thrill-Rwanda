import { describe, expect, it } from "vitest";
import { PLACEHOLDERS, TEMPLATES, fill, sampleValues } from "@/lib/email/template-data";

/**
 * Admins reword these emails, so the substitution has to be forgiving: a
 * mistyped placeholder must leave the sentence readable rather than blanking
 * the amount a customer owes.
 */

describe("fill", () => {
  const values = { reference: "SW-GPBG5C", amount: "Ksh 25,200" };

  it("replaces the details it was given", () => {
    expect(fill("Booking {reference} received", values)).toBe("Booking SW-GPBG5C received");
  });

  it("replaces every occurrence", () => {
    expect(fill("{amount} now, {amount} later", values)).toBe("Ksh 25,200 now, Ksh 25,200 later");
  });

  it("leaves an unknown placeholder visible rather than printing nothing", () => {
    // Blanking it would send "You owe  today"; this way the mistake is obvious.
    expect(fill("You owe {ammount} today", values)).toBe("You owe {ammount} today");
  });

  it("leaves text with no placeholders alone", () => {
    expect(fill("Thank you for booking.", values)).toBe("Thank you for booking.");
  });
});

describe("the shipped templates", () => {
  it("only use placeholders that exist", () => {
    const known = new Set(PLACEHOLDERS.map((p) => p.token));
    for (const template of TEMPLATES) {
      const used = `${template.subject} ${template.body}`.match(/\{\w+\}/g) ?? [];
      for (const token of used) {
        expect(known, `${template.key} uses ${token}`).toContain(token);
      }
    }
  });

  it("declare every placeholder they use, so the admin is offered it", () => {
    for (const template of TEMPLATES) {
      const used = new Set(`${template.subject} ${template.body}`.match(/\{\w+\}/g) ?? []);
      for (const token of used) {
        expect(template.uses, `${template.key} should list ${token}`).toContain(token);
      }
    }
  });

  it("render with no leftover placeholders once filled", () => {
    const samples = sampleValues();
    for (const template of TEMPLATES) {
      expect(fill(template.subject, samples)).not.toMatch(/\{\w+\}/);
      expect(fill(template.body, samples)).not.toMatch(/\{\w+\}/);
    }
  });

  it("gives every email a subject and a button label", () => {
    for (const template of TEMPLATES) {
      expect(template.subject.length).toBeGreaterThan(3);
      expect(template.ctaLabel.length).toBeGreaterThan(3);
    }
  });
});
