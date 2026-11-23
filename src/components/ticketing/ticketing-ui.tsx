import { Check, Clock, PlaneLanding, PlaneTakeoff } from "lucide-react";
import { AirlineLogo } from "@/components/booking/flight-marks";
import { AirportFlag } from "@/components/booking/airport-flag";
import { Badge } from "@/components/ui/primitives";
import { isAirlineCode } from "@/lib/flight-airlines";
import { airportCity } from "@/lib/flight-geography";
import { label } from "@/lib/enquiry-workflow";
import { airlineName, countdown, deadlineUrgency, TICKETING_STAGES, type TicketingStatus } from "@/lib/ticketing-rules";
import { cn } from "@/lib/utils";

const tone: Record<string, "neutral" | "forest" | "sun" | "clay" | "outline"> = {
  OPTIONS: "outline", AWAITING_PAYMENT: "sun", READY_TO_TICKET: "sun", TICKETING: "clay", ISSUED: "forest", CLOSED: "neutral", CANCELLED: "neutral",
};
export const statusText = (status: string) => ({ AWAITING_PAYMENT: "Awaiting payment", READY_TO_TICKET: "Ready to ticket", TICKETING: "With partner", OPTIONS: "Fare options" } as Record<string, string>)[status] ?? label(status);

export function StatusPill({ status }: { status: string }) {
  return <Badge tone={tone[status] ?? "neutral"}>{statusText(status)}</Badge>;
}

const urgencyStyle = {
  overdue: "border-[#9b2c1f] bg-[#fdf0ee] text-[#9b2c1f]",
  critical: "border-[#9b2c1f] bg-[#fdf0ee] text-[#9b2c1f]",
  soon: "border-sun-500 bg-sun-100 text-forest-950",
  ok: "border-[var(--line)] bg-[var(--paper-raised)] text-[var(--ink-muted)]",
} as const;

/** A deadline that is always shown as text as well as colour, so it reads without colour vision. */
export function DeadlineChip({ deadline, now = new Date() }: { deadline: Date | null; now?: Date }) {
  const urgency = deadlineUrgency(deadline, now);
  if (!deadline || urgency === "none") return <span className="text-sm text-[var(--ink-muted)]">No deadline</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", urgencyStyle[urgency])}>
      <Clock className="size-3.5" aria-hidden />
      {urgency === "overdue" ? "Overdue · " : urgency === "critical" ? "Urgent · " : ""}
      {countdown(deadline, now)}
    </span>
  );
}

/** The five stages of the journey from options to issued tickets. */
export function StageTracker({ status }: { status: TicketingStatus }) {
  const closed = status === "CLOSED" ? TICKETING_STAGES.length : TICKETING_STAGES.findIndex((stage) => stage.status === status);
  return (
    <ol className="grid gap-3 sm:grid-cols-5" aria-label="Ticketing progress">
      {TICKETING_STAGES.map((stage, index) => {
        const done = status === "CLOSED" || index < closed;
        const current = index === closed;
        return (
          <li key={stage.status} aria-current={current ? "step" : undefined}
            className={cn("rounded-xl border p-3 transition-colors", current ? "border-forest-800 bg-forest-800 text-bone-50" : done ? "border-[var(--line)] bg-[var(--paper-raised)]" : "border-dashed border-[var(--line)] text-[var(--ink-muted)]")}>
            <span className={cn("mb-2 grid size-6 place-items-center rounded-full text-xs font-bold", current ? "bg-sun-500 text-forest-950" : done ? "bg-forest-800 text-bone-50" : "bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]")}>
              {done ? <Check className="size-3.5" aria-label="Done" /> : index + 1}
            </span>
            <p className="text-sm font-semibold leading-tight">{stage.label}</p>
            <p className={cn("mt-1 hidden text-xs leading-snug sm:block", current ? "text-forest-100" : "text-[var(--ink-muted)]")}>{stage.hint}</p>
          </li>
        );
      })}
    </ol>
  );
}

export type SegmentView = {
  airline: string; flightNumber: string; origin: string; destination: string; departLocal: string; arriveLocal: string;
  cabin: string; bookingClass: string; terminal: string;
};
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDate = (local: string) => {
  const [y, m, d] = local.slice(0, 10).split("-").map(Number);
  return `${d} ${months[(m ?? 1) - 1]} ${y}`;
};

/** A boarding-pass style flight. Times are airport-local exactly as entered. */
export function FlightCard({ segment }: { segment: SegmentView }) {
  const from = airportCity(segment.origin), to = airportCity(segment.destination);
  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] shadow-[var(--shadow-lift)]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-[var(--line-strong)] px-5 py-3">
        <div className="flex items-center gap-3">
          {isAirlineCode(segment.airline) ? <AirlineLogo code={segment.airline} /> : <span className="font-semibold">{segment.airline}</span>}
          <span className="text-sm text-[var(--ink-muted)]">{airlineName(segment.airline)} · {segment.airline}{segment.flightNumber}</span>
        </div>
        <Badge tone="outline">{label(segment.cabin)}{segment.bookingClass ? ` · ${segment.bookingClass}` : ""}</Badge>
      </header>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-5">
        <div>
          <p className="font-display text-3xl tabular-nums">{segment.departLocal.slice(11, 16)}</p>
          <p className="mt-1 flex items-center gap-2 font-semibold"><AirportFlag value={segment.origin} />{segment.origin}</p>
          <p className="text-sm text-[var(--ink-muted)]">{from ?? "Departure"} · {shortDate(segment.departLocal)}</p>
        </div>
        <div className="flex flex-col items-center gap-1 text-lake-700" aria-hidden>
          <PlaneTakeoff className="size-5" />
          <span className="h-px w-16 bg-[var(--line-strong)] sm:w-28" />
          <PlaneLanding className="size-5" />
        </div>
        <div className="text-right">
          <p className="font-display text-3xl tabular-nums">{segment.arriveLocal.slice(11, 16)}</p>
          <p className="mt-1 flex items-center justify-end gap-2 font-semibold">{segment.destination}<AirportFlag value={segment.destination} /></p>
          <p className="text-sm text-[var(--ink-muted)]">{to ?? "Arrival"} · {shortDate(segment.arriveLocal)}</p>
        </div>
      </div>
      {segment.terminal && <p className="border-t border-[var(--line)] px-5 py-2 text-xs text-[var(--ink-muted)]">Departure terminal {segment.terminal}</p>}
    </article>
  );
}

export function Panel({ title, lede, children, action }: { title: string; lede?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="my-6 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl">{title}</h2>
          {lede && <p className="mt-1 max-w-2xl text-sm text-[var(--ink-muted)]">{lede}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label: name, value, hint, tone: t }: { label: string; value: string | number; hint?: string; tone?: "alert" }) {
  return (
    <div className={cn("rounded-xl border p-4", t === "alert" && Number(value) > 0 ? "border-[#9b2c1f] bg-[#fdf0ee]" : "border-[var(--line)] bg-[var(--paper-raised)]")}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">{name}</p>
      <p className="mt-1 font-display text-3xl tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--ink-muted)]">{hint}</p>}
    </div>
  );
}
