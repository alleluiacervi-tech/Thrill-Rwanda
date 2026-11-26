import { z } from "zod";
import { fieldLabel } from "@/lib/field-label";

export { fieldLabel };

/**
 * Plain-language defaults for every zod schema in the app.
 *
 * Server actions show `issues[0].message` to the person who filled the form.
 * Without this, a schema with no hand-written message shows zod's own text
 * ("Too small: expected string to have >=10 characters"), which doesn't say
 * which field is wrong. A message written on the schema still wins over these.
 *
 * Zod keeps this config on globalThis, so registering it once at server start
 * (src/instrumentation.ts) covers every bundle in the process.
 */

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const isEmpty = (input: unknown) => input === undefined || input === null || input === "";

type Issue = {
  code?: string;
  path?: PropertyKey[];
  origin?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  input?: unknown;
  format?: string;
  expected?: string;
};

/** The default message for one issue, or undefined to keep zod's own. */
export function friendlyMessage(iss: Issue): string | undefined {
  const label = fieldLabel(iss.path);
  const min = Number(iss.minimum);
  const max = Number(iss.maximum);
  switch (iss.code) {
    case "invalid_type":
      if (isEmpty(iss.input)) return `${label} is required.`;
      if (iss.expected === "number") return `${label} must be a number.`;
      if (iss.expected === "date") return `${label} must be a valid date.`;
      return `${label} isn't valid.`;
    case "too_small":
      if (iss.origin === "string") return min <= 1 ? `${label} is required.` : `${label} needs at least ${plural(min, "character")}.`;
      if (iss.origin === "array" || iss.origin === "set") return min <= 1 ? `Choose at least one ${label.toLowerCase()}.` : `Choose at least ${min} for ${label.toLowerCase()}.`;
      if (iss.origin === "number" || iss.origin === "bigint") return `${label} must be at least ${min}.`;
      if (iss.origin === "date") return `${label} is too early.`;
      return undefined;
    case "too_big":
      if (iss.origin === "string") return `${label} can be at most ${plural(max, "character")}.`;
      if (iss.origin === "array" || iss.origin === "set") return `${label} can have at most ${max}.`;
      if (iss.origin === "number" || iss.origin === "bigint") return `${label} can be at most ${max}.`;
      if (iss.origin === "date") return `${label} is too late.`;
      return undefined;
    case "invalid_format":
      if (iss.format === "email") return "Enter a valid email address.";
      if (iss.format === "url") return "Enter a valid web address.";
      if (iss.format === "uuid" || iss.format === "guid") return `Choose a valid ${label.toLowerCase()}.`;
      if (iss.format === "date" || iss.format === "datetime") return `${label} must be a valid date.`;
      return `${label} isn't in the right format.`;
    case "invalid_value":
      return `Choose a valid option for ${label.toLowerCase()}.`;
    case "not_multiple_of":
      return `${label} isn't a valid amount.`;
    default:
      return undefined;
  }
}

z.config({ customError: (iss) => friendlyMessage(iss as Issue) });
