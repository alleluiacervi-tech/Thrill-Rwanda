import { z } from "zod";

/**
 * Rules for dated departures (the editions of a fixed-departure tour).
 *
 * Pure functions only, so they can be tested without a database. Days are
 * handled as `YYYY-MM-DD` strings or UTC-midnight Dates, the same convention
 * as the `availability.day` column.
 */

const DAY_MS = 86_400_000;

export const isoDay = (day: Date) => day.toISOString().slice(0, 10);

export function addDays(day: Date | string, count: number) {
  const base = typeof day === "string" ? new Date(`${day}T00:00:00Z`) : day;
  return new Date(base.getTime() + count * DAY_MS);
}

/** Every day a run occupies: the start and the following days of the itinerary. */
export function runDays(startsOn: Date | string, durationDays: number) {
  return Array.from({ length: Math.max(1, durationDays) }, (_, i) =>
    isoDay(addDays(startsOn, i)),
  );
}

/**
 * The booking range for a run. `end` is exclusive, as bookings store it, and
 * is never the start day itself: a one-day tour books [start, start + 1).
 */
export function runRange(startsOn: Date | string, durationDays: number) {
  const start = isoDay(addDays(startsOn, 0));
  return {
    start,
    end: isoDay(addDays(startsOn, Math.max(1, durationDays))),
    lastDay: isoDay(addDays(startsOn, Math.max(1, durationDays) - 1)),
  };
}

export type DayInventory = {
  unitsTotal: number;
  unitsBooked: number;
  isBlocked: boolean;
};

/**
 * Seats still free on a run: the tightest day decides, because a traveller
 * needs a seat on every day of it. A day that is closed, or missing from the
 * calendar, leaves nothing to sell.
 */
export function seatsLeft(days: string[], inventory: Map<string, DayInventory>) {
  let left = Infinity;
  for (const day of days) {
    const row = inventory.get(day);
    if (!row || row.isBlocked) return 0;
    left = Math.min(left, row.unitsTotal - row.unitsBooked);
  }
  return Number.isFinite(left) ? Math.max(0, left) : 0;
}

/**
 * The existing run a new one would collide with, if any. Two runs of the
 * same tour may not share a day: the guide, the vehicle and the seats are
 * the same ones.
 */
export function clashingRun(
  startsOn: Date | string,
  durationDays: number,
  existing: (Date | string)[],
) {
  const wanted = new Set(runDays(startsOn, durationDays));
  return existing.find((other) =>
    runDays(other, durationDays).some((day) => wanted.has(day)),
  );
}

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const yearFormat = new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "UTC" });

/** "Sat 14 Aug 2027", or "Sat 14 Aug – Sun 15 Aug 2027" for a longer run. */
export function formatRun(startsOn: string, lastDay: string) {
  const start = addDays(startsOn, 0);
  const last = addDays(lastDay, 0);
  const year = yearFormat.format(last);
  return startsOn === lastDay
    ? `${dayFormat.format(start)} ${year}`
    : `${dayFormat.format(start)} – ${dayFormat.format(last)} ${year}`;
}

/** The pieces of a date, for a calendar-leaf display. */
export function dateParts(day: string) {
  const date = addDays(day, 0);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(date);
  return {
    weekday: part({ weekday: "short" }),
    day: part({ day: "numeric" }),
    month: part({ month: "short" }),
    year: part({ year: "numeric" }),
  };
}

export const departureSchema = z.object({
  tourId: z.string().uuid(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  note: z.string().trim().max(120).default(""),
});
