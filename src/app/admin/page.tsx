import Link from "next/link";
import { AlarmClock, ArrowDownRight, ArrowRight, ArrowUpRight, Minus, Plus } from "lucide-react";
import { DailyChart, MeterList } from "@/components/dashboard/charts";
import { Panel } from "@/components/dashboard/dash-ui";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { Button } from "@/components/ui/button";
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
/** Against fewer than five, a percentage misleads, so no change is shown. */
const trend = (now: number, before: number) => (before >= 5 ? change(now, before) : null);
const hours = (h: number | null) =>
  h === null ? "—" : h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${h.toFixed(h < 10 ? 1 : 0)} h` : `${(h / 24).toFixed(1)} days`;
const longDay = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

/**
 * The admin overview. Three tiers, read top to bottom: the four numbers that
 * matter, what happened and what needs doing, then the detail behind them.
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
    listEditions(4).catch(() => []),
    db.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { customer: { select: { fullName: true } }, provider: { select: { businessName: true } } },
    }),
  ]);
  const subjects = await resolveBookingSubjects(recent);
  const t = a.totals;
  const period = `${range.days} ${range.days === 1 ? "day" : "days"}`;
  const preset = PRESETS.find((p) => `${p}` === params.days) ?? (params.from ? null : 30);

  return (
    <>
      <DashboardHead
        title="Overview"
        lede={`${longDay(range.from)} – ${longDay(range.to)}, against the ${period} before.`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <nav aria-label="Period" className="inline-flex rounded-full border border-[var(--line)] bg-[var(--paper)] p-0.5">
              {PRESETS.map((d) => (
                <Link
                  key={d}
                  href={`/admin?days=${d}`}
                  aria-current={preset === d ? "true" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full px-3.5 text-xs transition-colors",
                    preset === d ? "bg-forest-800 font-medium text-bone-50" : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
                  )}
                >
                  {d}d
                </Link>
              ))}
            </nav>
            <Button href="/admin/enquiries/new" variant="accent">
              <Plus className="size-4" />
              New enquiry
            </Button>
          </div>
        }
      />

      {/* Tier 1: the four numbers. */}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <li>
          <Kpi
            label="Requests"
            value={nf.format(t.enquiries)}
            delta={trend(t.enquiries, t.enquiriesPrev)}
            good="up"
            note={`${nf.format(t.enquiriesPrev)} before`}
            href="/admin/enquiries"
          />
        </li>
        <li>
          <Kpi
            label="Quotes accepted"
            value={nf.format(t.accepted)}
            delta={trend(t.accepted, t.acceptedPrev)}
            good="up"
            note={`${pct(t.acceptRate)} of ${nf.format(t.quoted)} quoted`}
          />
        </li>
        <li>
          <Kpi
            label="Median first reply"
            value={hours(t.responseHours)}
            delta={t.responseHours !== null && t.responseHoursPrev ? change(t.responseHours, t.responseHoursPrev) : null}
            good="down"
            note={t.unanswered ? `${t.unanswered} waiting` : "All answered"}
            warn={t.unanswered > 0}
          />
        </li>
        <li>
          <Kpi
            label="Overdue follow-ups"
            value={nf.format(t.overdueCount)}
            note={`${nf.format(t.open)} open in total`}
            warn={t.overdueCount > 0}
            href="/admin/enquiries?due=overdue"
          />
        </li>
      </ul>

      {/* Tier 2: what happened, and what to do about it. */}
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel
          title="Requests per day"
          description={`${nf.format(t.enquiries)} this period · ${nf.format(t.enquiriesPrev)} before`}
          className="xl:col-span-2"
        >
          <DailyChart days={a.daily} previous={a.prevDaily} label="requests" />
        </Panel>

        <Panel title="Needs attention" description="Overdue follow-ups" flush aside={<PanelLink href="/admin/enquiries?due=overdue">All</PanelLink>}>
          {a.overdue.length ? (
            <ul className="divide-y divide-[var(--line)]">
              {a.overdue.slice(0, 6).map((o) => (
                <li key={o.reference}>
                  <Link href={`/admin/enquiries/${o.reference}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-[var(--paper-sunken)]">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{o.name}</span>
                      <span className="block truncate text-xs text-[var(--ink-faint)]">
                        {o.door} · {o.owner}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-clay-700">
                      <AlarmClock className="size-3.5" aria-hidden />
                      {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Kigali" }).format(o.due)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-[var(--ink-muted)]">Nothing overdue. Well done.</p>
          )}
        </Panel>
      </div>

      {/* Pipeline: one strip instead of a tall list of bars. */}
      <Panel title="From request to completed trip" description="How far this period's requests have got" className="mt-6">
        {a.funnel[0]?.value ? (
          <ol className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3 xl:grid-cols-6">
            {a.funnel.map((s, i) => {
              const before = i ? a.funnel[i - 1]!.value : s.value;
              return (
                <li key={s.name} className="bg-[var(--paper-raised)] p-4">
                  <p className="text-xs text-[var(--ink-muted)]">{s.name}</p>
                  <p className="tnum mt-1.5 font-display text-2xl leading-none">{nf.format(s.value)}</p>
                  <p className="tnum mt-1.5 text-2xs text-[var(--ink-faint)]">
                    {i ? `${before ? Math.round((s.value / before) * 100) : 0}% of ${a.funnel[i - 1]!.name.toLowerCase()}` : "100%"}
                  </p>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-[var(--ink-muted)]">No requests in this period yet.</p>
        )}
      </Panel>

      {/* Tier 3: the detail. Top five of each, nothing more. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="What people ask for">
          <Ranked items={a.byDoor} />
        </Panel>
        <Panel title="Where requests come from">
          <Ranked items={a.bySource} />
        </Panel>
        <Panel title="Open requests by owner" aside={<PanelLink href="/admin/enquiries">Enquiries</PanelLink>}>
          <Ranked items={a.workload} empty="No open requests." />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Money recorded" description="Finance records for requests in this period" className="xl:col-span-2" aside={<PanelLink href="/admin/finance">Finance</PanelLink>} flush>
          {a.money.length ? (
            <TableShell className="rounded-none border-0" dense>
              <thead>
                <tr>
                  <Th>Currency</Th>
                  <Th className="text-right">Collected</Th>
                  <Th className="text-right">Owed to suppliers</Th>
                  <Th className="text-right">Contribution</Th>
                </tr>
              </thead>
              <tbody className="tnum">
                {a.money.map((m) => (
                  <Tr key={m.currency}>
                    <Td className="font-medium">{m.currency}</Td>
                    <Td className="text-right">{formatMoney(m.collections, m.currency)}</Td>
                    <Td className="text-right">{formatMoney(m.supplierDue, m.currency)}</Td>
                    <Td className="text-right">
                      {m.reviewed ? formatMoney(m.contribution, m.currency) : "—"}
                      <span className="block text-2xs text-[var(--ink-faint)]">
                        {m.reviewed} of {m.cases} reviewed
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableShell>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-[var(--ink-muted)]">No finance records for this period.</p>
          )}
          {a.gateway.length ? (
            <p className="border-t border-[var(--line)] px-5 py-3 text-xs text-[var(--ink-muted)]">
              Online payments received:{" "}
              <span className="tnum font-medium text-[var(--ink)]">{a.gateway.map((g) => formatMoney(g.amountMinor, g.currency)).join(" · ")}</span>
            </p>
          ) : null}
        </Panel>
        <Panel title="Tembera u Rwanda seats" description="Next dated editions" aside={<PanelLink href="/tembera-urwanda">Editions</PanelLink>}>
          <MeterList
            rows={editions.map((e) => ({
              name: e.tour.name,
              detail: formatRun(e.departure.startsOn, e.departure.lastDay),
              used: e.departure.seatsTotal - e.departure.seatsLeft,
              of: e.departure.seatsTotal,
            }))}
          />
        </Panel>
      </div>

      <Panel
        title="Latest online bookings"
        className="mt-6"
        flush
        aside={<PanelLink href="/admin/bookings">All bookings</PanelLink>}
      >
        <TableShell className="rounded-none border-0">
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
      </Panel>

      <p className="mt-6 text-xs text-[var(--ink-faint)]">
        Kigali time. Customer collections are pass-through money, not profit.
        {a.clicksTotal ? ` ${nf.format(a.clicksTotal)} website button presses this period.` : ""}
      </p>
    </>
  );
}

/* ---------------------------------------------------------------- pieces */

/** One figure, large, with its change against the previous period. */
function Kpi({
  label,
  value,
  delta,
  good,
  note,
  warn,
  href,
}: {
  label: string;
  value: string;
  /** Change as a share; null when there is nothing to compare, undefined to omit. */
  delta?: number | null;
  good?: "up" | "down";
  note: string;
  warn?: boolean;
  href?: string;
}) {
  const up = delta != null && delta > 0.005;
  const down = delta != null && delta < -0.005;
  const better = (up && good === "up") || (down && good === "down");
  const worse = (up && good === "down") || (down && good === "up");
  const body = (
    <div
      className={cn(
        "h-full rounded-[var(--radius-card)] border bg-[var(--paper-raised)] p-5 transition-colors",
        warn ? "border-clay-300" : "border-[var(--line)]",
        href && "hover:border-[var(--line-strong)]",
      )}
    >
      <p className="text-xs font-medium text-[var(--ink-muted)]">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className={cn("tnum font-display text-[2.25rem] leading-none", warn && "text-clay-700")}>{value}</p>
        {delta != null ? (
          <p
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-semibold",
              better ? "bg-forest-100 text-forest-800" : worse ? "bg-clay-100 text-clay-800" : "bg-[var(--paper-sunken)] text-[var(--ink-muted)]",
            )}
          >
            {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : down ? <ArrowDownRight className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
            {delta > 0 ? "+" : ""}
            {Math.round(delta * 100)}%
          </p>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-[var(--ink-faint)]">{note}</p>
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

/** The top five as a quiet ranked list: a name, a number and a hairline. */
function Ranked({ items, empty = "Nothing in this period." }: { items: { name: string; value: number }[]; empty?: string }) {
  const total = items.reduce((n, i) => n + i.value, 0);
  if (!total) return <p className="py-6 text-sm text-[var(--ink-faint)]">{empty}</p>;
  const top = items.slice(0, 5);
  const rest = items.slice(5).reduce((n, i) => n + i.value, 0);
  const rows = rest ? [...top, { name: "Everything else", value: rest }] : top;
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <ul className="grid gap-4">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.name}</span>
            <span className="tnum shrink-0 font-medium">
              {nf.format(r.value)}
              <span className="ml-2 text-xs font-normal text-[var(--ink-faint)]">{Math.round((r.value / total) * 100)}%</span>
            </span>
          </div>
          <div className="mt-1.5 h-0.5 rounded-full bg-[var(--line)]">
            <div className="h-full rounded-full bg-forest-700" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
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
