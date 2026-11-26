import { fieldLabel } from "@/lib/field-label";

/**
 * Turns a stored audit `changes` record into lines a person can read:
 * "Status: New → Contacted" instead of `{ "before": { "status": "NEW" } … }`.
 * The raw record stays available beside it for audits.
 */
export type ChangeLine = { label: string; value: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const ENUM = /^[A-Z][A-Z0-9_]+$/;
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Nothing worth a line: empty values, and records whose every value is empty. */
const isBlank = (v: unknown): boolean =>
  v === null || v === undefined || v === "" || (isObject(v) && !("from" in v || "to" in v) && Object.values(v).every(isBlank));
/** Amounts are stored in minor units (cents); say so rather than print "Threshold minor". */
const label = (key: string) => {
  const minor = /^(.+?)_?Minor$/i.exec(key);
  return minor ? `${fieldLabel([minor[1]!])} (minor units)` : fieldLabel([key]);
};

const kigali = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Kigali",
});

/** Optional id -> name lookup, so linked people and records show by name. */
export type Names = Record<string, string>;

export function formatValue(v: unknown, names: Names = {}): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (typeof v === "string") {
    if (UUID.test(v)) return names[v] ?? "a linked record";
    if (ISO.test(v) && !Number.isNaN(Date.parse(v))) return `${kigali.format(new Date(v))} Kigali`;
    if (ENUM.test(v)) return v.charAt(0) + v.slice(1).toLowerCase().replaceAll("_", " ");
    return v.length > 300 ? `${v.slice(0, 300)}…` : v;
  }
  if (Array.isArray(v)) {
    if (!v.length) return "none";
    return v.every((x) => !isObject(x) && !Array.isArray(x)) ? v.map((x) => formatValue(x, names)).join(", ") : `${v.length} items`;
  }
  if (isObject(v)) {
    if ("from" in v || "to" in v) return `${formatValue(v.from, names)} → ${formatValue(v.to, names)}`;
    const keys = Object.keys(v).filter((k) => !isBlank(v[k]));
    return keys.length ? keys.map((k) => `${label(k)}: ${formatValue(v[k], names)}`).join("; ") : "—";
  }
  return String(v);
}

export function summariseChanges(changes: unknown, names: Names = {}): ChangeLine[] {
  if (changes === null || changes === undefined) return [];
  if (!isObject(changes)) return [{ label: "Details", value: formatValue(changes, names) }];
  const lines: ChangeLine[] = [];
  const { before, after, ...rest } = changes;
  if (isObject(before) || isObject(after)) {
    const b = isObject(before) ? before : {};
    const a = isObject(after) ? after : {};
    // Only what the change set: `before` is often a fuller snapshot than `after`,
    // and a field missing from `after` was left alone, not cleared.
    for (const key of Object.keys(a)) {
      if (same(b[key], a[key])) continue;
      const value = key in b && !isBlank(b[key])
        ? `${formatValue(b[key], names)} → ${formatValue(a[key], names)}`
        : formatValue(a[key], names);
      lines.push({ label: label(key), value });
    }
  } else {
    if (before !== undefined) rest.before = before;
    if (after !== undefined) rest.after = after;
  }
  for (const [key, value] of Object.entries(rest)) {
    if (isBlank(value)) continue;
    lines.push({ label: label(key), value: formatValue(value, names) });
  }
  return lines;
}
