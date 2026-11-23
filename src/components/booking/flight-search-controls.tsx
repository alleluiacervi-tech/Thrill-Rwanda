"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import s from "./flight-planner.module.css";

/* ------------------------------------------------------------------ dates */

const DAY = 86_400_000;
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => toIso(new Date(toDate(iso).getTime() + days * DAY));
const monthOf = (iso: string) => `${iso.slice(0, 7)}-01`;
function addMonths(iso: string, months: number) {
  const date = toDate(monthOf(iso));
  date.setUTCMonth(date.getUTCMonth() + months);
  return toIso(date);
}
/** The same day of the month, n months on, clamped to the month's length. */
function shiftMonth(iso: string, months: number) {
  const first = addMonths(iso, months);
  const length = Math.round((toDate(addMonths(first, 1)).getTime() - toDate(first).getTime()) / DAY);
  return addDays(first, Math.min(Number(iso.slice(8)), length) - 1);
}
const format = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" });
const monthTitle = format({ month: "long", year: "numeric" });
const fullDate = format({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const cellDate = format({ weekday: "short", day: "numeric", month: "short" });
const passDate = format({ weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** "Wed, 10 Feb" for a filled field. */
export const fieldDate = (iso: string) => (iso ? cellDate.format(toDate(iso)) : "");
/** "Wed, 10 Feb 2027" for the itinerary. */
export const itineraryDate = (iso: string) => (iso ? passDate.format(toDate(iso)) : "");
/** How many nights between two dates, for the return field's hint. */
export const nightsBetween = (from: string, to: string) =>
  from && to ? Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY) : 0;
/** Fares are rarely on sale much further out than this. */
export const latestDate = (today: string) => addMonths(today, 15);

const weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function useMonthsShown() {
  const [months, setMonths] = useState(1);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 720px)");
    const update = () => setMonths(query.matches ? 2 : 1);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return months;
}

/**
 * A month grid with a roving focus. With `rangeStart` (picking a return) the
 * days between departure and the hovered day are shaded as the stay.
 */
export function Calendar({
  value,
  min,
  max,
  rangeStart,
  rangeEnd,
  onPick,
}: {
  value: string;
  min: string;
  max: string;
  rangeStart?: string;
  rangeEnd?: string;
  onPick: (iso: string) => void;
}) {
  const months = useMonthsShown();
  const initial = value || (rangeStart && rangeStart > min ? rangeStart : min);
  const [focus, setFocus] = useState(initial);
  const [view, setView] = useState(monthOf(initial));
  const [hover, setHover] = useState<string>();
  const grid = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    // Focus follows the keyboard; on open, land on the chosen or first possible day.
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)?.focus({ preventScroll: !moved.current });
    // Not on view changes: paging with the arrow buttons keeps focus on the button.
  }, [focus, months]);

  const lo = rangeStart ?? value;
  const hi = rangeEnd ?? (rangeStart ? (hover && hover >= rangeStart ? hover : value) : undefined);
  const viewEnd = addMonths(view, months);
  // One day in view always takes Tab, even after paging away from the focused one.
  const tabbable = focus >= view && focus < viewEnd ? focus : view < min ? min : view;
  const firstMonth = monthOf(min);
  const lastMonth = addMonths(monthOf(max), -(months - 1));

  function move(to: string) {
    const next = to < min ? min : to > max ? max : to;
    moved.current = true;
    if (next < view) setView(monthOf(next));
    else if (next >= addMonths(view, months)) setView(addMonths(monthOf(next), -(months - 1)));
    setFocus(next);
  }
  function onKey(event: KeyboardEvent) {
    const weekday = (toDate(focus).getUTCDay() + 6) % 7;
    const steps: Record<string, () => string> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      Home: () => addDays(focus, -weekday),
      End: () => addDays(focus, 6 - weekday),
      PageUp: () => shiftMonth(focus, -1),
      PageDown: () => shiftMonth(focus, 1),
    };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    move(step());
  }

  return (
    <div className={s.calendar}>
      <div className={s.calendarNav}>
        <button type="button" aria-label="Previous month" disabled={view <= firstMonth}
          onClick={() => { setView(addMonths(view, -1)); }}>
          <ChevronLeft size={18} />
        </button>
        <button type="button" aria-label="Next month" disabled={view >= lastMonth}
          onClick={() => { setView(addMonths(view, 1)); }}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div ref={grid} className={s.months} onKeyDown={onKey} onMouseLeave={() => setHover(undefined)}>
        {Array.from({ length: months }, (_, i) => {
          const month = addMonths(view, i);
          const lead = (toDate(month).getUTCDay() + 6) % 7;
          const length = nightsBetween(month, addMonths(month, 1));
          return (
            <div key={month} className={s.month} role="grid" aria-label={monthTitle.format(toDate(month))}>
              <p className={s.monthTitle} aria-hidden>{monthTitle.format(toDate(month))}</p>
              <div className={s.weekdays} aria-hidden>{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
              <div className={s.days}>
                {Array.from({ length: lead }, (_, j) => <span key={`blank-${j}`} aria-hidden />)}
                {Array.from({ length }, (_, j) => {
                  const day = addDays(month, j);
                  const disabled = day < min || day > max;
                  const edge = day === lo || day === hi;
                  return (
                    <button
                      key={day}
                      type="button"
                      data-date={day}
                      tabIndex={day === tabbable ? 0 : -1}
                      disabled={disabled}
                      aria-pressed={day === value}
                      aria-label={fullDate.format(toDate(day))}
                      className={cn(
                        s.day,
                        edge && s.dayEdge,
                        lo && hi && lo !== hi && day === lo && s.dayStart,
                        lo && hi && lo !== hi && day === hi && s.dayEnd,
                        lo && hi && day > lo && day < hi && s.dayIn,
                        day === min && s.dayToday,
                      )}
                      onMouseEnter={() => setHover(day)}
                      onFocus={() => setFocus(day)}
                      onClick={() => onPick(day)}
                    >
                      {j + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- DropField */

/**
 * A search cell that opens a panel: anchored under the cell on wide screens,
 * a bottom sheet on phones. Closes on Escape or a press outside.
 */
export function DropField({
  id,
  icon,
  label,
  value,
  placeholder,
  hint,
  open,
  onOpenChange,
  title,
  align = "start",
  className,
  children,
}: {
  id: string;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  placeholder: string;
  hint?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  align?: "start" | "end";
  className?: string;
  children: ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const press = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onOpenChange(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", press);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", press);
      document.removeEventListener("keydown", key);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={wrap} className={cn(s.field, className)} data-open={open || undefined}>
      <button
        ref={trigger}
        type="button"
        className={s.cell}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onOpenChange(!open)}
      >
        <span className={s.cellLabel}>{icon}{label}</span>
        <strong className={value ? s.cellValue : s.cellPlaceholder}>{value || placeholder}</strong>
        {hint ? <small className={s.cellHint}>{hint}</small> : null}
      </button>
      {open ? (
        <>
          <div className={s.sheetBackdrop} aria-hidden onClick={() => onOpenChange(false)} />
          <div id={id} role="dialog" aria-label={title} className={s.pop} data-align={align}>
            <div className={s.sheetHead}>
              <p>{title}</p>
              <button type="button" aria-label="Close" onClick={() => { onOpenChange(false); trigger.current?.focus(); }}>
                <X size={18} />
              </button>
            </div>
            {children}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- Stepper */

export function Stepper({
  label,
  note,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  note: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className={s.stepper} role="group" aria-label={label}>
      <span>
        <b>{label}</b>
        <small>{note}</small>
      </span>
      <span className={s.stepperControls}>
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <Minus size={15} />
        </button>
        <output aria-live="polite" aria-label={`${label}: ${value}`}>{value}</output>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <Plus size={15} />
        </button>
      </span>
    </div>
  );
}
