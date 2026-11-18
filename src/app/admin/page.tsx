import Link from "next/link";
import {
  AlarmClock,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  FileText,
  Handshake,
  Inbox,
  Minus,
  Timer,
} from "lucide-react";
import { BarList, DailyChart, Funnel, MeterList, Sparkline } from "@/components/dashboard/charts";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/primitives";
import { PRESETS, adminAnalytics, change, readRange } from "@/lib/analytics";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/booking";
import { resolveBookingSubjects } from "@/lib/booking-display";
import { db } from "@/lib/db";
import { formatRun } from "@/lib/departure-rules";
import { listEditions } from "@/lib/departures";
import { requireAdmin } from "@/lib/session";
import { cn, formatMoney } from "@/lib/utils";

export const metadata = { title: "Overview", robots: { index: false, follow: false } };

const nf = new Intl.NumberFormat("en-US");
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
/** A change worth showing: against fewer than five, a percentage misleads, so the note gives the numbers instead. */
const trend = (now: number, before: number) => (before >= 5 ? change(now, before) : null);
const hours = (h: number | null) =>
  h === null ? "—" : h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${h.toFixed(h < 10 ? 1 : 0)} h` : `${(h / 24).toFixed(1)} days`;
const longDay = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

/**
 * The admin overview: how demand, the desk and the money are doing, for a
 * chosen period, against the period before (brief §10.1).
 */
export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const range = readRange(params);
  const [a, editions, recent] = await Promise.all([
    adminAnalytics(range),
    listEditions(6).catch(() => []),
    db.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { customer: { select: { fullName: true } }, provider: { select: { businessName: true } } },
    }),
  ]);
  const subjects = await resolveBookingSubjects(recent);
  const t = a.totals;
  const spark = a.daily.map((d) => d.value);
  const period = `${range.days} ${range.days === 1 ? "day" : "days"}`;
  const preset = PRESETS.find((p) => `${p}` === params.days) ?? (params.from ? null : 30);

  const tiles: Tile[] = [
    {
      icon: Inbox,
      label: "Requests received",
      value: nf.format(t.enquiries),
      delta: trend(t.enquiries, t.enquiriesPrev),
      good: "up",
      note: `${nf.format(t.enquiriesPrev)} in the ${period} before`,
      spark,
      href: "/admin/enquiries",
    },
    {
      icon: Timer,
      label: "Median first reply",
      value: hours(t.responseHours),
      delta: t.responseHours !== null && t.responseHoursPrev ? change(t.responseHours, t.responseHoursPrev) : null,
      good: "down",
      note: t.unanswered ? `${t.unanswered} still waiting for a first reply` : "Every request has had a reply",
      warn: t.unanswered > 0,
    },
    {
      icon: FileText,
      label: "Quotes sent",
      value: nf.format(t.quoted),
      delta: trend(t.quoted, t.quotedPrev),
      good: "up",
      note: `${pct(t.quoteRate)} of requests were quoted`,
    },
    {
      icon: Handshake,
      label: "Quotes accepted",
      value: nf.format(t.accepted),
      delta: trend(t.accepted, t.acceptedPrev),
      good: "up",
      note: `${pct(t.acceptRate)} of quotes${t.acceptRatePrev !== null ? ` (was ${pct(t.acceptRatePrev)})` : ""}`,
    },
    {
      icon: AlarmClock,
      label: "Overdue follow-ups",
      value: nf.format(t.overdueCount),
      note: t.overdueCount ? `${nf.format(t.open)} requests open in all` : `${nf.format(t.open)} open, none overdue`,
      warn: t.overdueCount > 0,
      href: "/admin/enquiries",
    },
    {
      icon: CalendarDays,
      label: "Online bookings",
      value: nf.format(t.bookings),
      delta: t.bookings || t.bookingsPrev ? trend(t.bookings, t.bookingsPrev) : undefined,
      good: "up",
      note: `${nf.format(t.bookingsPrev)} in the ${period} before`,
      href: "/admin/bookings",
    },
  ];

  return (
    <>
      <DashboardHead
        title="Overview"
        lede={`${longDay(range.from)} to ${longDay(range.to)}, Kigali time, compared with the ${period} before. Customer collections are pass-through money, not profit.`}
      />

      {/* One row of filters, above everything they scope. */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <nav aria-label="Period" className="inline-flex rounded-full border border-[var(--line)] bg-[var(--paper-raised)] p-1">
          {PRESETS.map((d) => (
            <Link
              key={d}
              href={`/admin?days=${d}`}
              aria-current={preset === d ? "true" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center rounded-full px-4 text-sm transition-colors",
                preset === d ? "bg-forest-800 font-medium text-bone-50" : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
              )}
            >
              {d} days
            </Link>
          ))}
        </nav>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-2xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
            From
            <input type="date" name="from" defaultValue={range.from} className="h-10 rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-3 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-2xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
            To
            <input type="date" name="to" defaultValue={range.to} className="h-10 rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-3 text-sm" />
          </label>
          <button type="submit" className="h-10 rounded-[var(--radius-inset)] border border-[var(--line-strong)] px-4 text-sm font-medium hover:bg-[var(--paper-sunken)]">
            Apply
          </button>
        </form>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <StatTile {...tile} period={period} />
          </li>
        ))}
      </ul>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Requests per day" sub="Every request, from the website and recorded by the team" className="xl:col-span-2">
          <DailyChart days={a.daily} previous={a.prevDaily} label="requests" />
        </Panel>
        <Panel title="From request to completed trip" sub="Requests received in this period, and how far each has got">
          <Funnel steps={a.funnel} />
        </Panel>

        <Panel title="What people ask for" sub="By front door">
          <BarList items={a.byDoor} unit="requests" />
        </Panel>
        <Panel title="Where requests come from" sub="Website, WhatsApp, phone, referrals…">
          <BarList items={a.bySource} unit="requests" />
        </Panel>
        <Panel title="Open requests by owner" sub="All open requests, not only this period" action={<PanelLink href="/admin/enquiries">Enquiries</PanelLink>}>
          <BarList items={a.workload} unit="open requests" empty="No open requests." />
        </Panel>

        <Panel title="Money recorded" sub="From finance records for requests received in this period" className="xl:col-span-2" action={<PanelLink href="/admin/finance">Finance</PanelLink>}>
          {a.money.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="text-left text-xs text-[var(--ink-faint)]">
                  <tr>
                    <th className="pb-2 font-medium">Currency</th>
                    <th className="pb-2 text-right font-medium">Collected from customers</th>
                    <th className="pb-2 text-right font-medium">Owed to suppliers</th>
                    <th className="pb-2 text-right font-medium">Service fees</th>
                    <th className="pb-2 text-right font-medium">Refunds paid</th>
                    <th className="pb-2 text-right font-medium">Contribution</th>
                  </tr>
                </thead>
                <tbody className="tnum">
                  {a.money.map((m) => (
                    <tr key={m.currency} className="border-t border-[var(--line)]">
                      <td className="py-2 font-medium">{m.currency}</td>
                      <td className="py-2 text-right">{formatMoney(m.collections, m.currency)}</td>
                      <td className="py-2 text-right">{formatMoney(m.supplierDue, m.currency)}</td>
                      <td className="py-2 text-right">{formatMoney(m.serviceFees, m.currency)}</td>
                      <td className="py-2 text-right">{formatMoney(m.refunds, m.currency)}</td>
                      <td className="py-2 text-right">
                        {m.reviewed ? formatMoney(m.contribution, m.currency) : "—"}
                        <span className="block text-2xs text-[var(--ink-faint)]">
                          {m.reviewed} of {m.cases} {m.cases === 1 ? "case" : "cases"} reviewed
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-sm text-[var(--ink-faint)]">No finance records for requests in this period.</p>
          )}
          {a.gateway.length ? (
            <p className="mt-3 text-xs text-[var(--ink-muted)]">
              Online payments received:{" "}
              <span className="tnum font-medium text-[var(--ink)]">
                {a.gateway.map((g) => formatMoney(g.amountMinor, g.currency)).join(" · ")}
              </span>
            </p>
          ) : null}
        </Panel>
        <Panel title="Needs attention" sub="Follow-ups that are overdue now">
          {a.overdue.length ? (
            <ul className="divide-y divide-[var(--line)]">
              {a.overdue.map((o) => (
                <li key={o.reference}>
                  <Link href={`/admin/enquiries/${o.reference}`} className="flex items-start justify-between gap-3 py-2.5 hover:bg-[var(--paper-sunken)]">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{o.name}</span>
                      <span className="block truncate text-2xs text-[var(--ink-faint)]">
                        {o.door} · {o.owner}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-2xs font-medium text-clay-700">
                      <AlarmClock className="size-3.5" aria-hidden />
                      due {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Kigali" }).format(o.due)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-sm text-[var(--ink-faint)]">Nothing overdue. Well done.</p>
          )}
        </Panel>

        <Panel title="Website buttons pressed" sub={`${nf.format(a.clicksTotal)} presses, counted without personal data`}>
          <BarList items={a.clicksByService} unit="presses" empty="No presses recorded in this period." />
          {a.clicksByPlacement.length ? (
            <p className="mt-4 text-xs text-[var(--ink-muted)]">
              {a.clicksByPlacement.map((p) => `${p.name} ${nf.format(p.value)}`).join(" · ")}
            </p>
          ) : null}
        </Panel>
        <Panel title="Tembera u Rwanda seats" sub="The next dated editions" action={<PanelLink href="/tembera-urwanda">Editions</PanelLink>}>
          <MeterList
            rows={editions.map((e) => ({
              name: e.tour.name,
              detail: formatRun(e.departure.startsOn, e.departure.lastDay),
              used: e.departure.seatsTotal - e.departure.seatsLeft,
              of: e.departure.seatsTotal,
            }))}
          />
        </Panel>
        <Panel title="Online bookings by status" sub="Bookings made in this period">
          <BarList items={a.bookingsByStatus} unit="bookings" empty="No online bookings in this period." />
        </Panel>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg">Latest online bookings</h2>
          <PanelLink href="/admin/bookings">All bookings</PanelLink>
        </div>
        <TableShell>
          <thead>
            <tr>
              <Th>Booking</Th>
              <Th>Customer</Th>
              <Th>Provider</Th>
              <Th className="text-right">Total</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <Tr>
                <Td className="text-[var(--ink-faint)]">Nothing booked yet</Td>
                <Td />
                <Td />
                <Td />
                <Td />
              </Tr>
            ) : (
              recent.map((b) => (
                <Tr key={b.id} className="relative cursor-pointer">
                  <Td>
                    <Link href={`/admin/bookings/${b.reference}`} className="block max-w-[14rem] truncate font-medium after:absolute after:inset-0">
                      {subjects.get(b.resourceId) ?? "Listing"}
                    </Link>
                    <span className="tnum text-2xs text-[var(--ink-faint)]">{b.reference}</span>
                  </Td>
                  <Td className="max-w-[11rem] truncate">{b.customer.fullName}</Td>
                  <Td className="max-w-[11rem] truncate">{b.provider.businessName}</Td>
                  <Td className="tnum whitespace-nowrap text-right">{formatMoney(b.totalMinor, b.currency)}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </TableShell>
      </section>
    </>
  );
}

/* ---------------------------------------------------------------- pieces */

type Tile = {
  icon: typeof Inbox;
  label: string;
  value: string;
  /** Change against the previous period, as a share; null when there is nothing to compare. */
  delta?: number | null;
  /** Which way is good news. */
  good?: "up" | "down";
  note: string;
  spark?: number[];
  warn?: boolean;
  href?: string;
};

function StatTile({ icon: Icon, label, value, delta, good, note, spark, warn, href, period }: Tile & { period: string }) {
  const up = delta !== null && delta !== undefined && delta > 0.005;
  const down = delta !== null && delta !== undefined && delta < -0.005;
  const better = (up && good === "up") || (down && good === "down");
  const worse = (up && good === "down") || (down && good === "up");
  const body = (
    <div
      className={cn(
        "flex h-full flex-col rounded-[var(--radius-card)] border bg-[var(--paper-raised)] p-4 transition-colors",
        warn ? "border-clay-300" : "border-[var(--line)]",
        href && "hover:border-[var(--line-strong)]",
      )}
    >
      <p className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
        <Icon className={cn("size-4", warn ? "text-clay-700" : "text-forest-700")} aria-hidden />
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-[1.75rem] font-semibold leading-none tracking-tight text-[var(--ink)]">{value}</p>
        {delta !== undefined ? (
          <p
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold",
              better ? "text-forest-700" : worse ? "text-clay-700" : "text-[var(--ink-faint)]",
            )}
            title={`Compared with the ${period} before`}
          >
            {delta === null ? (
              <span className="font-normal">no comparison</span>
            ) : up ? (
              <ArrowUpRight className="size-3.5" aria-hidden />
            ) : down ? (
              <ArrowDownRight className="size-3.5" aria-hidden />
            ) : (
              <Minus className="size-3.5" aria-hidden />
            )}
            {delta !== null ? `${delta > 0 ? "+" : ""}${Math.round(delta * 100)}%` : null}
            <span className="sr-only"> compared with the {period} before</span>
          </p>
        ) : null}
      </div>
      {spark ? <Sparkline values={spark} className="mt-2" /> : null}
      <p className={cn("mt-auto pt-2 text-2xs leading-snug", warn ? "font-medium text-clay-700" : "text-[var(--ink-faint)]")}>{note}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

function Panel({
  title,
  sub,
  action,
  className,
  children,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-4 sm:p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base">{title}</h2>
          {sub ? <p className="mt-0.5 text-xs text-[var(--ink-faint)]">{sub}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-lake-700 hover:underline">
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}
