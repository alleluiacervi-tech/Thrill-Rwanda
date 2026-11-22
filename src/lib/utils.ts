import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** The one currency listings, bookings and payments are priced in. */
export const DEFAULT_CURRENCY = "USD";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * All money in this system is stored as integer minor units (cents) to avoid
 * float drift in booking totals. Format only at the edge.
 */
export function formatMoney(
  amountMinor: number,
  currency: string = DEFAULT_CURRENCY,
  opts: { compact?: boolean } = {},
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    notation: opts.compact ? "compact" : "standard",
  }).format(amountMinor / (currency === "RWF" ? 1 : 100));
}

/**
 * Formats a booking date range.
 *
 * MUST format in UTC. Postgres `date` columns come back from Prisma as a JS
 * Date at UTC midnight; formatting those in the viewer's local zone shifts
 * the day backwards for anyone west of UTC — a customer in New York would
 * see every booking starting a day early. Calendar dates here are civil
 * dates with no time component, so UTC is the correct lens.
 */
export function formatDateRange(start: Date, end: Date) {
  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() &&
    start.getUTCFullYear() === end.getUTCFullYear();
  const thisYear = new Date().getUTCFullYear();
  const d = (date: Date, withMonth: boolean) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      day: "numeric",
      month: withMonth ? "short" : undefined,
      year: date.getUTCFullYear() === thisYear ? undefined : "numeric",
    }).format(date);
  return `${d(start, !sameMonth)} – ${d(end, true)}`;
}

/** YYYY-MM-DD for a civil date, read in UTC. Safe for `@db.Date` values. */
export function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * YYYY-MM-DD for a date the USER is picking, read in their local zone.
 *
 * Never use `toISOString()` for this: at 01:00 in Kigali (UTC+2) it returns
 * yesterday, so a date input would default to the wrong day. Date inputs
 * carry a civil date with no zone, so read the local calendar fields.
 */
export function toLocalDateInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's local civil date, for `min` on a date input. */
export function todayLocal() {
  return toLocalDateInput(new Date());
}

/** A local civil date `days` from today. */
export function localDatePlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toLocalDateInput(d);
}

/** Nights between two dates, floor-guarded to at least 1. */
export function nightsBetween(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
