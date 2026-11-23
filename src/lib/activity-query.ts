import type { Prisma } from "@/generated/prisma/client";

/**
 * Filters for the activity log, read from the page's query string. Shared by
 * the page and its export, so the spreadsheet always matches the screen.
 */

export const ACTIVITY_AREAS = [
  "Access",
  "Sign-in",
  "Enquiries",
  "Quotes",
  "Bookings",
  "Finance",
  "Suppliers",
  "Listings",
  "Departures",
  "Venues",
  "Providers",
  "Reviews",
  "Launch",
  "Support",
  "Settings",
  "Content",
  "Transfers",
  "Mail",
] as const;

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const day = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const uuid = (v: string) => (/^[0-9a-f-]{36}$/i.test(v) ? v : "");

export type ActivityFilters = {
  actor: string;
  target: string;
  area: string;
  q: string;
  from: string;
  to: string;
};

export function readActivityFilters(params: Params): ActivityFilters {
  const area = one(params.area);
  return {
    actor: uuid(one(params.actor)),
    target: uuid(one(params.target)),
    area: (ACTIVITY_AREAS as readonly string[]).includes(area) ? area : "",
    q: one(params.q).trim().slice(0, 100),
    from: day(one(params.from)),
    to: day(one(params.to)),
  };
}

/** Kigali is UTC+2 all year; a day filter covers that whole local day. */
const kigali = (d: string, end = false) => new Date(`${d}T${end ? "23:59:59.999" : "00:00:00.000"}+02:00`);

export function activityWhere(f: ActivityFilters): Prisma.ActivityLogWhereInput {
  return {
    ...(f.actor ? { actorId: f.actor } : {}),
    ...(f.target ? { targetId: f.target } : {}),
    ...(f.area ? { area: f.area } : {}),
    ...(f.from || f.to
      ? { createdAt: { ...(f.from ? { gte: kigali(f.from) } : {}), ...(f.to ? { lte: kigali(f.to, true) } : {}) } }
      : {}),
    ...(f.q
      ? {
          OR: [
            { summary: { contains: f.q, mode: "insensitive" } },
            { target: { contains: f.q, mode: "insensitive" } },
            { actorName: { contains: f.q, mode: "insensitive" } },
            { actorEmail: { contains: f.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export const kigaliTime = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Africa/Kigali",
  }).format(d);
