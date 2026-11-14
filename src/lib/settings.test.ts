import { describe, expect, it } from "vitest";
import { DEFAULT_DAMAGE_LIABILITY_TEXT, damageLiabilityStatement } from "@/lib/settings";

/**
 * The damage liability wording is editable by the admin, and the amount comes
 * from the vehicle. The one thing that must never happen is a statement that
 * omits the figure the customer is agreeing to.
 */
describe("damageLiabilityStatement", () => {
  it("fills the vehicle's amount into the admin's wording", () => {
    expect(damageLiabilityStatement(DEFAULT_DAMAGE_LIABILITY_TEXT, "Ksh 60,000")).toContain(
      "Ksh 60,000",
    );
    expect(damageLiabilityStatement(DEFAULT_DAMAGE_LIABILITY_TEXT, "Ksh 60,000")).not.toContain(
      "{amount}",
    );
  });

  it("fills every placeholder, not only the first", () => {
    const text = "You are liable for {amount}. We may charge up to {amount}.";
    expect(damageLiabilityStatement(text, "Ksh 60,000")).toBe(
      "You are liable for Ksh 60,000. We may charge up to Ksh 60,000.",
    );
  });

  it("still states the amount if an admin removes the placeholder", () => {
    expect(damageLiabilityStatement("You accept liability for damage.", "Ksh 60,000")).toContain(
      "Ksh 60,000",
    );
  });

  it("uses a different amount per vehicle", () => {
    const cheap = damageLiabilityStatement(DEFAULT_DAMAGE_LIABILITY_TEXT, "Ksh 20,000");
    const dear = damageLiabilityStatement(DEFAULT_DAMAGE_LIABILITY_TEXT, "Ksh 150,000");
    expect(cheap).toContain("Ksh 20,000");
    expect(dear).toContain("Ksh 150,000");
    expect(cheap).not.toContain("150,000");
  });
});
