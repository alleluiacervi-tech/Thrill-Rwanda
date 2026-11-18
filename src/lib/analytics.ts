import { db } from "@/lib/db";
import { CLOSED, label } from "@/lib/enquiry-workflow";
import { financeInclude } from "@/lib/finance";
import { financialSummary } from "@/lib/finance-rules";
import { JOURNEY_LABELS, isJourneyKey } from "@/lib/journey-requests";

/**
 * The numbers behind the admin dashboard (brief §10.1): demand, how fast the
 * desk responds, how requests convert, what money is recorded, and where it
 * comes from. Every figure is for a Kigali date range and is compared with
 * the same length of time just before it.
 *
 * Money stays in its own currency and is never added across currencies.
 * Customer collections are pass-through money, not profit (brief §2).
 */

const DAY = 86_400_000;
const KIGALI = "+02:00";

export type Range = { from: string; to: string; days: number; gte: Date; lt: Date };

const iso = (d: Date) => new Date(d.getTime() + 2 * 3600_000).toISOString().slice(0, 10);
const valid = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;

export const PRESETS = [7, 30, 90] as const;

/** `?days=30`, or `?from=…&to=…` (at most a year). Defaults to the last 30 days. */
export function readRange(params: Record<string, string | string[] | undefined>, now = new Date()): Range {
  const one = (k: string) => (Array.isArray(params[k]) ? params[k]![0] : params[k]) as string | undefined;
  const today = iso(now);
  let from: string;
  let to: string;
  if (valid(one("from")) && valid(one("to")) && one("from")! <= one("to")!) {
    from = one("from")!;
    to = one("to")! > today ? today : one("to")!;
  } else {
    const days = Math.min(366, Math.max(1, Number(one("days")) || 30));
    to = today;
    from = iso(new Date(Date.parse(`${today}T00:00:00${KIGALI}`) - (days - 1) * DAY + 3600_000));
  }
  const gte = new Date(`${from}T00:00:00${KIGALI}`);
  const lt = new Date(Date.parse(`${to}T00:00:00${KIGALI}`) + DAY);
  const days = Math.max(1, Math.round((lt.getTime() - gte.getTime()) / DAY));
  if (days > 366) return readRange({ days: "366" }, now);
  return { from, to, days, gte, lt };
}

/** The same number of days immediately before. */
export function previous(r: Range): Range {
  const lt = r.gte;
  const gte = new Date(lt.getTime() - r.days * DAY);
  return { from: iso(gte), to: iso(new Date(lt.getTime() - DAY)), days: r.days, gte, lt };
}

/** Change as a share of the earlier figure, or null when there is nothing to compare with. */
export const change = (now: number, before: number) => (before > 0 ? (now - before) / before : null);

export function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** What a request was for, in the words of the front doors: "Wedding or event", "School trip"… */
function doorOf(service: string, details: unknown) {
  const journey = (details as { journey?: unknown } | null)?.journey;
  if (isJourneyKey(journey)) return JOURNEY_LABELS[journey];
  const plain: Record<string, string> = {
    FLIGHT: "Flight",
    TRIP: "Tour or trip",
    STAY: "Stay",
    TRANSPORT: "Transport",
    GROUP: "Group trip",
    EVENT: "Wedding or event",
    GENERAL: "Not sure yet",
  };
  return plain[service] ?? label(service);
}

const SOURCE_NAMES: Record<string, string> = {
  WEBSITE: "Website",
  WHATSAPP: "WhatsApp",
  PHONE: "Phone",
  REFERRAL: "Referral",
  SOCIAL: "Social media",
  CAMPAIGN: "Campaign",
  OUTREACH: "Organisation outreach",
};

/** Reaching a stage counts whether it was recorded in the system or moved there by hand. */
const QUOTED = ["QUOTE_SENT", "AWAITING_PAYMENT", "PARTNER_PROCESSING", "CONFIRMED", "COMPLETED"];
const ACCEPTED = ["AWAITING_PAYMENT", "PARTNER_PROCESSING", "CONFIRMED", "COMPLETED"];
type Stage = { status: string; quoteVersions: unknown[]; quoteAcceptance: unknown };
const quoted = (r: Stage) => r.quoteVersions.length > 0 || QUOTED.includes(r.status);
const accepted = (r: Stage) => !!r.quoteAcceptance || ACCEPTED.includes(r.status);

const tally = (items: string[]) => {
  const m = new Map<string, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};

export async function adminAnalytics(range: Range) {
  const prev = previous(range);
  const inRange = (r: Range) => ({ createdAt: { gte: r.gte, lt: r.lt } });

  const [rows, prevRows, openByOwner, overdue, clicks, bookings, prevBookings, payments] = await Promise.all([
    db.enquiry.findMany({
      where: inRange(range),
      select: {
        id: true,
        createdAt: true,
        service: true,
        source: true,
        status: true,
        details: true,
        firstResponseAt: true,
        quoteVersions: { select: { id: true } },
        quoteAcceptance: { select: { id: true } },
        financialCase: { include: financeInclude },
      },
      take: 20000,
    }),
    db.enquiry.findMany({
      where: inRange(prev),
      select: { createdAt: true, status: true, firstResponseAt: true, quoteVersions: { select: { id: true } }, quoteAcceptance: { select: { id: true } } },
      take: 20000,
    }),
    db.enquiry.groupBy({ by: ["ownerId"], where: { status: { notIn: CLOSED } }, _count: { _all: true } }),
    db.enquiry.findMany({
      where: { status: { notIn: CLOSED }, nextFollowUp: { lt: new Date() } },
      orderBy: { nextFollowUp: "asc" },
      take: 6,
      select: { reference: true, name: true, service: true, details: true, nextFollowUp: true, owner: { select: { fullName: true } } },
    }),
    db.interactionDaily.findMany({
      where: { day: { gte: new Date(`${range.from}T00:00:00Z`), lte: new Date(`${range.to}T00:00:00Z`) } },
    }),
    db.booking.findMany({ where: inRange(range), select: { status: true, serviceType: true, totalMinor: true, currency: true } }),
    db.booking.count({ where: inRange(prev) }),
    db.payment.groupBy({
      by: ["currency"],
      where: { status: "SUCCEEDED", createdAt: { gte: range.gte, lt: range.lt } },
      _sum: { amountMinor: true },
    }),
  ]);

  /* -------------------------------------------------- demand, day by day */
  const daily = Array.from({ length: range.days }, (_, i) => ({
    day: iso(new Date(range.gte.getTime() + i * DAY + 3600_000)),
    value: 0,
  }));
  const index = new Map(daily.map((d, i) => [d.day, i]));
  for (const r of rows) {
    const i = index.get(iso(r.createdAt));
    if (i !== undefined) daily[i]!.value += 1;
  }
  const prevDaily = Array.from({ length: prev.days }, () => 0);
  for (const r of prevRows) {
    const i = Math.floor((r.createdAt.getTime() - prev.gte.getTime()) / DAY);
    if (i >= 0 && i < prevDaily.length) prevDaily[i]! += 1;
  }

  /* ---------------------------------------------------------- the funnel */
  const reached = (statuses: string[]) => rows.filter((r) => statuses.includes(r.status)).length;
  const funnel = [
    { name: "Received", value: rows.length },
    { name: "Answered", value: rows.filter((r) => r.firstResponseAt || r.status !== "NEW").length },
    { name: "Quoted", value: rows.filter(quoted).length },
    { name: "Accepted", value: rows.filter(accepted).length },
    { name: "Confirmed", value: reached(["CONFIRMED", "COMPLETED"]) },
    { name: "Completed", value: reached(["COMPLETED"]) },
  ];
  const prevQuoted = prevRows.filter(quoted).length;
  const prevAccepted = prevRows.filter(accepted).length;

  /* ------------------------------------------------------------ response */
  const hours = (list: { createdAt: Date; firstResponseAt: Date | null }[]) =>
    list.filter((r) => r.firstResponseAt).map((r) => (r.firstResponseAt!.getTime() - r.createdAt.getTime()) / 3600_000);
  const responseNow = median(hours(rows));
  const responsePrev = median(hours(prevRows));
  const unanswered = rows.filter((r) => !r.firstResponseAt && r.status === "NEW").length;

  /* --------------------------------------------------------------- money */
  const money = new Map<
    string,
    { collections: number; supplierDue: number; serviceFees: number; refunds: number; contribution: number; reviewed: number; cases: number }
  >();
  for (const r of rows) {
    const c = r.financialCase;
    if (!c) continue;
    const s = financialSummary(c);
    const g = money.get(c.currency) ?? { collections: 0, supplierDue: 0, serviceFees: 0, refunds: 0, contribution: 0, reviewed: 0, cases: 0 };
    g.collections += s.collections;
    g.supplierDue += s.supplierDue;
    g.serviceFees += s.serviceFees;
    g.refunds += s.customerRefunds;
    if (s.contribution !== null) {
      g.contribution += s.contribution;
      g.reviewed += 1;
    }
    g.cases += 1;
    money.set(c.currency, g);
  }

  /* --------------------------------------------------- website actions */
  const placementName: Record<string, string> = {
    HOME_HERO: "Homepage hero",
    HOME_SERVICES: "Homepage services",
    SERVICE_REQUEST: "Service pages",
  };
  const serviceName: Record<string, string> = {
    FLIGHT: "Flights",
    TRIP: "Tours & experiences",
    STAY: "Stays",
    TRANSPORT: "Transport",
    GROUP: "Groups & schools",
    EVENT: "Weddings & events",
  };
  const byService = new Map<string, number>();
  const byPlacement = new Map<string, number>();
  for (const c of clicks) {
    byService.set(serviceName[c.service] ?? c.service, (byService.get(serviceName[c.service] ?? c.service) ?? 0) + c.clicks);
    byPlacement.set(placementName[c.placement] ?? c.placement, (byPlacement.get(placementName[c.placement] ?? c.placement) ?? 0) + c.clicks);
  }
  const toList = (m: Map<string, number>) =>
    [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  /* ------------------------------------------------------------ workload */
  const owners = await db.user.findMany({
    where: { id: { in: openByOwner.map((o) => o.ownerId).filter((x): x is string => !!x) } },
    select: { id: true, fullName: true },
  });
  const ownerName = new Map(owners.map((o) => [o.id, o.fullName]));
  const workload = openByOwner
    .map((o) => ({ name: o.ownerId ? (ownerName.get(o.ownerId) ?? "Former staff") : "Not assigned", value: o._count._all }))
    .sort((a, b) => b.value - a.value);

  return {
    range,
    prev,
    totals: {
      enquiries: rows.length,
      enquiriesPrev: prevRows.length,
      quoted: funnel[2]!.value,
      quotedPrev: prevQuoted,
      accepted: funnel[3]!.value,
      acceptedPrev: prevAccepted,
      quoteRate: rows.length ? funnel[2]!.value / rows.length : null,
      acceptRate: funnel[2]!.value ? funnel[3]!.value / funnel[2]!.value : null,
      acceptRatePrev: prevQuoted ? prevAccepted / prevQuoted : null,
      responseHours: responseNow,
      responseHoursPrev: responsePrev,
      unanswered,
      overdueCount: await db.enquiry.count({ where: { status: { notIn: CLOSED }, nextFollowUp: { lt: new Date() } } }),
      open: openByOwner.reduce((n, o) => n + o._count._all, 0),
      bookings: bookings.length,
      bookingsPrev: prevBookings,
      lost: rows.filter((r) => ["LOST", "CANCELLED", "REFUNDED"].includes(r.status)).length,
    },
    daily,
    prevDaily,
    funnel,
    byDoor: tally(rows.map((r) => doorOf(r.service, r.details))),
    bySource: tally(rows.map((r) => SOURCE_NAMES[r.source] ?? label(r.source))),
    workload,
    overdue: overdue.map((o) => ({
      reference: o.reference,
      name: o.name,
      door: doorOf(o.service, o.details),
      due: o.nextFollowUp!,
      owner: o.owner?.fullName ?? "Not assigned",
    })),
    money: [...money.entries()].map(([currency, m]) => ({ currency, ...m })),
    gateway: payments.map((p) => ({ currency: p.currency, amountMinor: p._sum.amountMinor ?? 0 })),
    clicksByService: toList(byService),
    clicksByPlacement: toList(byPlacement),
    clicksTotal: clicks.reduce((n, c) => n + c.clicks, 0),
    bookingsByStatus: tally(bookings.map((b) => label(b.status))),
  };
}

export type AdminAnalytics = Awaited<ReturnType<typeof adminAnalytics>>;
