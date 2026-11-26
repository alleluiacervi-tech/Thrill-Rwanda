import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fieldLabel } from "./zod-messages";

const first = (schema: z.ZodType, input: unknown) => {
  const r = schema.safeParse(input);
  return r.success ? null : r.error.issues[0]!.message;
};

describe("validation messages", () => {
  it("names the field and the rule instead of zod's wording", () => {
    expect(first(z.object({ evidence: z.string().min(10) }), { evidence: "short" })).toBe(
      "Evidence needs at least 10 characters.",
    );
    expect(first(z.object({ signedName: z.string().min(1) }), { signedName: "" })).toBe("Signed name is required.");
    expect(first(z.object({ guests: z.coerce.number().min(1) }), { guests: "0" })).toBe("Guests must be at least 1.");
    expect(first(z.object({ email: z.email() }), { email: "x" })).toBe("Enter a valid email address.");
    expect(first(z.object({ status: z.enum(["A", "B"]) }), { status: "C" })).toBe("Choose a valid option for status.");
    expect(first(z.object({ note: z.string() }), {})).toBe("Note is required.");
  });

  it("keeps a message written on the schema", () => {
    expect(first(z.object({ name: z.string().min(3, "Tell us your name.") }), { name: "a" })).toBe("Tell us your name.");
  });

  it("labels awkward field names", () => {
    expect(fieldLabel(["accountId"])).toBe("Account");
    expect(fieldLabel(["passengers", 0, "givenNames"])).toBe("Given names");
    expect(fieldLabel([])).toBe("This field");
  });
});
