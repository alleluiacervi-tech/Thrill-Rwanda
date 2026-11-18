"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Dashboard charts, drawn as SVG at the container's real width.
 *
 * Colour does one job here: this period in the brand green, the previous
 * period in a recessive warm grey for context. Text never wears the series
 * colour. Every chart keeps its numbers reachable without hovering (labels or
 * a table view), and every hover readout is also given on keyboard focus.
 */

const SERIES = "var(--viz-series, #2f8060)";
const CONTEXT = "var(--viz-context, #c9bda8)";
const GRID = "var(--viz-grid, #ece6db)";

const nf = new Intl.NumberFormat("en-US");
export const compact = (n: number) =>
  n >= 10_000 ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n) : nf.format(n);

function useWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e!.contentRect.width)));
    ro.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Clean axis steps: 1, 2, 5 × 10ⁿ. */
function niceMax(max: number, ticks = 4) {
  if (max <= 0) return { top: ticks, step: 1 };
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  return { top: Math.max(step * ticks, step * Math.ceil(max / step)), step };
}

const dayLabel = (iso: string, long = false) =>
  new Intl.DateTimeFormat("en-GB", long ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`),
  );

/* ------------------------------------------------------------- sparkline */

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = 28;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [values.length < 2 ? w : (i / (values.length - 1)) * (w - 4) + 2, h - 3 - (v / max) * (h - 6)] as const);
  return (
    <div ref={ref} className={cn("h-7 w-full", className)} aria-hidden>
      {w > 0 && values.length > 1 ? (
        <svg width={w} height={h}>
          <path d={pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join("")} fill="none" stroke={CONTEXT} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r={3} fill={SERIES} stroke="var(--paper-raised, #fff)" strokeWidth={1.5} />
        </svg>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------- columns over time + context */

export function DailyChart({
  days,
  previous,
  label,
}: {
  days: { day: string; value: number }[];
  /** The same number of days just before, aligned by position. */
  previous: number[];
  /** What is counted, e.g. "requests". */
  label: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = React.useState<number | null>(null);
  const [table, setTable] = React.useState(false);
  const h = 220;
  const pad = { top: 12, right: 8, bottom: 26, left: 34 };
  const iw = Math.max(0, w - pad.left - pad.right);
  const ih = h - pad.top - pad.bottom;
  const { top, step } = niceMax(Math.max(1, ...days.map((d) => d.value), ...previous));
  const band = days.length ? iw / days.length : 0;
  const bar = Math.min(24, Math.max(2, band - 2));
  const y = (v: number) => pad.top + ih - (v / top) * ih;
  const x = (i: number) => pad.left + i * band + band / 2;
  const labelEvery = Math.max(1, Math.ceil(days.length / Math.max(1, Math.floor(iw / 64))));
  const total = days.reduce((n, d) => n + d.value, 0);
  const prevTotal = previous.reduce((n, v) => n + v, 0);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - box.left - pad.left) / band);
    setHover(i >= 0 && i < days.length ? i : null);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--ink-muted)]">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-[2px]" style={{ background: SERIES }} />
          This period · <strong className="tnum font-semibold text-[var(--ink)]">{nf.format(total)}</strong>
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: CONTEXT }} />
          Previous period · <span className="tnum">{nf.format(prevTotal)}</span>
        </span>
        <button
          type="button"
          onClick={() => setTable((t) => !t)}
          className="ml-auto min-h-8 rounded-full px-3 text-xs font-medium text-lake-700 hover:bg-[var(--paper-sunken)]"
        >
          {table ? "Show chart" : "Show as table"}
        </button>
      </div>

      {table ? (
        <div className="max-h-[220px] overflow-auto rounded border border-[var(--line)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--paper-raised)] text-left text-xs text-[var(--ink-faint)]">
              <tr>
                <th className="px-3 py-2 font-medium">Day</th>
                <th className="px-3 py-2 text-right font-medium">This period</th>
                <th className="px-3 py-2 text-right font-medium">Same day, previous period</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {days.map((d, i) => (
                <tr key={d.day} className="border-t border-[var(--line)]">
                  <td className="px-3 py-1.5">{dayLabel(d.day, true)}</td>
                  <td className="px-3 py-1.5 text-right">{d.value}</td>
                  <td className="px-3 py-1.5 text-right text-[var(--ink-muted)]">{previous[i] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative h-[220px] w-full min-w-0 overflow-hidden">
          {w > 0 ? (
            <svg
              width={w}
              height={h}
              role="img"
              aria-label={`${label} per day: ${nf.format(total)} this period, ${nf.format(prevTotal)} the period before`}
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
              className="touch-pan-y"
            >
              {Array.from({ length: Math.round(top / step) + 1 }, (_, k) => k * step).map((t) => (
                <g key={t}>
                  <line x1={pad.left} x2={w - pad.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
                  <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tnum fill-[var(--ink-faint)] text-[10px]">
                    {compact(t)}
                  </text>
                </g>
              ))}
              {days.map((d, i) => {
                const hgt = Math.max(0, pad.top + ih - y(d.value));
                const r = Math.min(4, bar / 2, hgt);
                const x0 = x(i) - bar / 2;
                const y0 = y(d.value);
                // Rounded at the data end, square on the baseline.
                return d.value > 0 ? (
                  <path
                    key={d.day}
                    d={`M${x0},${pad.top + ih}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + bar - r}Q${x0 + bar},${y0} ${x0 + bar},${y0 + r}V${pad.top + ih}Z`}
                    fill={SERIES}
                    opacity={hover === null || hover === i ? 1 : 0.55}
                  />
                ) : null;
              })}
              <path
                d={previous
                  .slice(0, days.length)
                  .map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`)
                  .join("")}
                fill="none"
                stroke={CONTEXT}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <line x1={pad.left} x2={w - pad.right} y1={pad.top + ih} y2={pad.top + ih} stroke="var(--line-strong)" strokeWidth={1} />
              {days.map((d, i) =>
                i % labelEvery === 0 ? (
                  <text key={d.day} x={x(i)} y={h - 8} textAnchor="middle" className="fill-[var(--ink-faint)] text-[10px]">
                    {dayLabel(d.day)}
                  </text>
                ) : null,
              )}
              {hover !== null ? (
                <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + ih} stroke="var(--ink-faint)" strokeWidth={1} />
              ) : null}
            </svg>
          ) : null}
          {hover !== null && days[hover] ? (
            <div
              role="status"
              className="pointer-events-none absolute top-0 z-10 min-w-40 -translate-x-1/2 rounded-lg border border-[var(--line)] bg-[var(--paper-raised)] px-3 py-2 text-xs shadow-[var(--shadow-float)]"
              style={{ left: Math.min(Math.max(x(hover), 84), w - 84) }}
            >
              <p className="text-[var(--ink-faint)]">{dayLabel(days[hover]!.day, true)}</p>
              <p className="mt-1 flex items-center gap-2">
                <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: SERIES }} />
                <strong className="tnum text-sm">{days[hover]!.value}</strong>
                <span className="text-[var(--ink-muted)]">{label}</span>
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-[var(--ink-muted)]">
                <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: CONTEXT }} />
                <span className="tnum">{previous[hover] ?? 0}</span> same day, period before
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------ ranked bar list */

export function BarList({
  items,
  unit,
  empty = "Nothing in this period.",
  limit = 8,
}: {
  items: { name: string; value: number; hint?: string }[];
  /** "requests", "clicks"… for the readout. */
  unit: string;
  empty?: string;
  limit?: number;
}) {
  const total = items.reduce((n, i) => n + i.value, 0);
  const shown = items.slice(0, limit);
  const rest = items.slice(limit).reduce((n, i) => n + i.value, 0);
  const rows = rest ? [...shown, { name: "Other", value: rest }] : shown;
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!total) return <p className="py-6 text-sm text-[var(--ink-faint)]">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const share = r.value / total;
        return (
          <li
            key={r.name}
            tabIndex={0}
            title={`${r.name}: ${nf.format(r.value)} ${unit} (${Math.round(share * 100)}%)`}
            className="group rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{r.name}</span>
              <span className="tnum shrink-0 text-[var(--ink-muted)]">
                <strong className="font-semibold text-[var(--ink)]">{nf.format(r.value)}</strong>
                <span className="ml-1.5 text-xs">{Math.round(share * 100)}%</span>
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-[var(--viz-track,#f1ece3)]">
              <div
                className="h-2 rounded-full transition-opacity group-hover:opacity-80"
                style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: SERIES }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------- funnel */

export function Funnel({ steps }: { steps: { name: string; value: number }[] }) {
  const first = steps[0]?.value ?? 0;
  if (!first) return <p className="py-6 text-sm text-[var(--ink-faint)]">No requests in this period yet.</p>;
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const before = i ? steps[i - 1]!.value : s.value;
        const stepRate = before ? s.value / before : 0;
        return (
          <li key={s.name} tabIndex={0} className="rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>
                <span className="tnum mr-2 text-xs text-[var(--ink-faint)]">{i + 1}</span>
                {s.name}
              </span>
              <span className="tnum text-[var(--ink-muted)]">
                <strong className="font-semibold text-[var(--ink)]">{nf.format(s.value)}</strong>
                {i ? (
                  <span className="ml-2 text-xs" title={`${Math.round(stepRate * 100)}% of the step before`}>
                    {Math.round(stepRate * 100)}% of {steps[i - 1]!.name.toLowerCase()}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="mt-1 h-3 rounded-[4px] bg-[var(--viz-track,#f1ece3)]">
              <div className="h-3 rounded-[4px]" style={{ width: `${Math.max(s.value ? 1.5 : 0, (s.value / first) * 100)}%`, background: SERIES }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------------------------------------------- meters (seat fill) */

export function MeterList({ rows }: { rows: { name: string; detail?: string; used: number; of: number }[] }) {
  if (!rows.length) return <p className="py-6 text-sm text-[var(--ink-faint)]">No upcoming dates.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const share = r.of ? r.used / r.of : 0;
        return (
          <li key={r.name + (r.detail ?? "")} tabIndex={0} className="rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {r.name}
                {r.detail ? <span className="ml-2 text-xs text-[var(--ink-faint)]">{r.detail}</span> : null}
              </span>
              <span className="tnum shrink-0 text-xs text-[var(--ink-muted)]">
                <strong className="text-sm font-semibold text-[var(--ink)]">{r.used}</strong> of {r.of} sold
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full" style={{ background: "var(--color-forest-100)" }}>
              <div className="h-2 rounded-full" style={{ width: `${Math.min(100, share * 100)}%`, background: share >= 0.9 ? "var(--color-clay-600)" : SERIES }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
