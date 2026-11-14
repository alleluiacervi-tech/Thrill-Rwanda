"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Minus,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { submitBooking, type BookingState } from "@/app/actions/booking";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/layout/whatsapp-button";
import {
  RESIDENCIES,
  RESIDENCY_HINTS,
  RESIDENCY_LABELS,
  rateFor,
  type Residency,
  type TourRates,
} from "@/lib/residency";
import { depositMinor } from "@/lib/deposit";
import { useSite } from "@/components/layout/site-context";
import {
  cn,
  formatMoney,
  localDatePlus,
  nightsBetween,
  todayLocal,
} from "@/lib/utils";

type Mode = "TOUR" | "ROOM" | "VEHICLE";

export type PanelRoom = { id: string; name: string; capacity: number; pricePerNight: number };

/** Event a "Choose this room" button fires, so the room list and the panel stay in step. */
export const SELECT_ROOM_EVENT = "thrill:select-room";

const initial: BookingState = { status: "idle" };

/**
 * Quote + booking panel.
 *
 * The total shown here is advisory. The authoritative price is snapshotted
 * server-side inside the booking transaction from the listing's current
 * price — this component never sends a price, only dates and guests. If the
 * two ever disagree, the server wins.
 */
export function BookingPanel({
  title,
  slug,
  priceMinor,
  unitLabel,
  maxGuests = 12,
  durationDays,
  mode,
  depositPercent = 30,
  rooms,
  driverPerDay,
  insuranceCharge,
  damageStatement,
  rates,
  className,
}: {
  title: string;
  slug: string;
  priceMinor: number;
  unitLabel: string;
  maxGuests?: number;
  durationDays?: number;
  mode: Mode;
  /** The admin's deposit setting. 100 means payment in full at checkout. */
  depositPercent?: number;
  /** Hotels only: the room types to choose from, cheapest first. */
  rooms?: PanelRoom[];
  /** Car hire: the provider's daily driver rate. Null means self-drive only. */
  driverPerDay?: number | null;
  /** Car hire: what the customer accepts liability for if the vehicle is damaged. */
  insuranceCharge?: number | null;
  /** Car hire: the damage terms, already filled in with this vehicle's amount. */
  damageStatement?: string;
  /** Safaris: the per-person rate for each residency. */
  rates?: TourRates;
  className?: string;
}) {
  const site = useSite();
  const router = useRouter();
  const [state, action, pending] = useActionState(submitBooking, initial);

  const [start, setStart] = React.useState(() => localDatePlus(14));
  const [end, setEnd] = React.useState(() =>
    localDatePlus(14 + Math.max(1, durationDays ?? 2)),
  );
  // Dates chosen in the home search arrive in the link. Read after load: these pages are static.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (!iso.test(from) || !iso.test(to) || from < todayLocal() || to <= from) return;
    queueMicrotask(() => {
      setStart(from);
      setEnd(to);
    });
  }, []);


  const [roomId, setRoomId] = React.useState(rooms?.[0]?.id ?? "");
  const room = rooms?.find((r) => r.id === roomId);
  // A room's own capacity and price win over the hotel-level figures.
  const guestLimit = room?.capacity ?? maxGuests;
  // Safari rates depend on residency, so nothing is assumed: they pick.
  const [residency, setResidency] = React.useState<Residency | "">("");
  const tourRate = rates && residency ? rateFor(rates, residency) : priceMinor;
  const unitPrice = room?.pricePerNight ?? (mode === "TOUR" ? tourRate : priceMinor);
  const [guests, setGuests] = React.useState(() => Math.min(2, guestLimit));
  const [withDriver, setWithDriver] = React.useState(false);

  // Picking a smaller room brings the guest count down with it, in the same update.
  const chooseRoom = React.useCallback(
    (id: string) => {
      const next = rooms?.find((r) => r.id === id);
      if (!next) return;
      setRoomId(id);
      setGuests((g) => Math.min(g, next.capacity));
    },
    [rooms],
  );

  // "Choose this room" buttons in the room list select the room here and bring the panel into view.
  const panelRef = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    if (!rooms?.length) return;
    const onSelect = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (!rooms.some((r) => r.id === id)) return;
      chooseRoom(id);
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    window.addEventListener(SELECT_ROOM_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_ROOM_EVENT, onSelect);
  }, [rooms, chooseRoom]);

  // A tour is priced per person; rooms per night, vehicles per day.
  const days = Math.max(1, nightsBetween(new Date(start), new Date(end)));
  const units = mode === "TOUR" ? guests : days;
  // The server prices the driver again on submit; this is the preview.
  const driverTotal = withDriver && driverPerDay ? driverPerDay * days : 0;
  const subtotal = unitPrice * units + driverTotal;
  const deposit = depositMinor(subtotal, depositPercent);

  // An unauthenticated attempt returns the sign-in URL rather than throwing,
  // so the customer keeps their dates when they come back.
  React.useEffect(() => {
    if (state.status === "auth") router.push(state.signInUrl);
    // Step two: terms and payment on the checkout page.
    if (state.status === "success") router.push(`/checkout/${state.reference}`);
  }, [state, router]);

  if (state.status === "success") {
    return (
      <div
        className={cn(
          "rounded-[var(--radius-card)] border border-forest-300 bg-forest-100 p-7 text-center",
          className,
        )}
      >
        <CheckCircle2 className="mx-auto size-10 text-forest-600" />
        <h2 className="mt-5 text-2xl text-forest-900">Dates held</h2>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-forest-800/80">
          <span className="font-medium">{title}</span> is held for you under
          reference{" "}
          <span className="tnum font-semibold">{state.reference}</span>. Taking you to payment…
        </p>
        {/* Shown only for the moment before the checkout page loads. */}
        <div className="mt-7 flex flex-col gap-3">
          <Button href={`/checkout/${state.reference}`} variant="accent">
            Continue to payment
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={panelRef}
      action={action}
      className={cn(
        "overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      {/* The server resolves these; no price or id crosses the wire. */}
      <input type="hidden" name="serviceType" value={mode} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="startDate" value={start} />
      <input type="hidden" name="endDate" value={end} />
      <input type="hidden" name="guests" value={guests} />
      {room ? <input type="hidden" name="roomId" value={room.id} /> : null}

      <div className="border-b border-[var(--line)] px-6 py-5">
        <p className="flex items-baseline gap-2">
          <span className="tnum font-display text-3xl font-semibold">
            {formatMoney(unitPrice)}
          </span>
          <span className="text-sm text-[var(--ink-faint)]">{unitLabel}</span>
        </p>
      </div>

      <div className="space-y-4 px-6 py-5">
        {state.status === "error" && (
          <p
            role="alert"
            className="flex items-start gap-3 rounded-[var(--radius-inset)] border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-900"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{state.message}</span>
          </p>
        )}

        {rooms && rooms.length > 0 ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">Room</span>
            <select
              value={roomId}
              onChange={(e) => chooseRoom(e.target.value)}
              className="w-full rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-transparent px-3 py-2.5 text-sm outline-none focus-visible:border-lake-600"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · sleeps {r.capacity} · {formatMoney(r.pricePerNight)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              <CalendarDays className="size-3 text-clay-600" />
              {mode === "VEHICLE" ? "Pickup" : "Start"}
            </span>
            <input
              type="date"
              value={start}
              min={todayLocal()}
              onChange={(e) => setStart(e.target.value)}
              className="tnum w-full rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-transparent px-3 py-2.5 text-sm outline-none focus-visible:border-lake-600"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              <CalendarDays className="size-3 text-clay-600" />
              {mode === "VEHICLE" ? "Return" : "End"}
            </span>
            <input
              type="date"
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
              className="tnum w-full rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-transparent px-3 py-2.5 text-sm outline-none focus-visible:border-lake-600"
            />
          </label>
        </div>

        <div className="flex items-center justify-between rounded-[var(--radius-inset)] border border-[var(--line-strong)] px-3 py-2">
          <span className="text-sm font-medium">
            {mode === "VEHICLE" ? "Passengers" : "Guests"}
          </span>
          <span className="flex items-center gap-1">
            <Stepper
              label="Remove one"
              onClick={() => setGuests((g) => Math.max(1, g - 1))}
              disabled={guests <= 1}
            >
              <Minus className="size-3.5" />
            </Stepper>
            <span className="tnum w-8 text-center text-sm font-semibold">
              {guests}
            </span>
            <Stepper
              label="Add one"
              onClick={() => setGuests((g) => Math.min(guestLimit, g + 1))}
              disabled={guests >= guestLimit}
            >
              <Plus className="size-3.5" />
            </Stepper>
          </span>
        </div>

        {mode === "TOUR" && rates ? (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              Residency
            </legend>
            {RESIDENCIES.map((option) => {
              const selected = residency === option;
              return (
                <label
                  key={option}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-[var(--radius-inset)] border p-3 transition-colors",
                    selected
                      ? "border-forest-800 bg-forest-100/50"
                      : "border-[var(--line-strong)] hover:border-forest-800",
                  )}
                >
                  <input
                    type="radio"
                    name="residency"
                    value={option}
                    checked={selected}
                    onChange={() => setResidency(option)}
                    required
                    className="mt-0.5 size-4 shrink-0 accent-forest-800"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{RESIDENCY_LABELS[option]}</span>
                      <span className="tnum text-sm">{formatMoney(rateFor(rates, option))}</span>
                    </span>
                    <span className="mt-0.5 block text-2xs leading-relaxed text-[var(--ink-muted)]">
                      {RESIDENCY_HINTS[option]}
                    </span>
                  </span>
                </label>
              );
            })}
            <p className="text-2xs leading-relaxed text-[var(--ink-faint)]">
              Bring an ID or passport matching your choice — the operator checks it on the day.
            </p>
          </fieldset>
        ) : null}

        {mode === "VEHICLE" && driverPerDay ? (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              Driver
            </legend>
            {[
              { value: false, label: "Self-drive", note: "You drive it yourself." },
              {
                value: true,
                label: "With a driver",
                note: `+${formatMoney(driverPerDay)} per day`,
              },
            ].map((option) => (
              <label
                key={option.label}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-[var(--radius-inset)] border p-3 transition-colors",
                  withDriver === option.value
                    ? "border-forest-800 bg-forest-100/50"
                    : "border-[var(--line-strong)] hover:border-forest-800",
                )}
              >
                <input
                  type="radio"
                  name="driverChoice"
                  checked={withDriver === option.value}
                  onChange={() => setWithDriver(option.value)}
                  className="mt-0.5 size-4 shrink-0 accent-forest-800"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block text-2xs text-[var(--ink-muted)]">{option.note}</span>
                </span>
              </label>
            ))}
            {/* The server reads this, not the radio above. */}
            {withDriver ? <input type="hidden" name="withDriver" value="on" /> : null}
          </fieldset>
        ) : null}

        <dl className="space-y-2 border-t border-[var(--line)] pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--ink-muted)]">
              {formatMoney(unitPrice)} × {units}{" "}
              {mode === "TOUR"
                ? units === 1
                  ? "guest"
                  : "guests"
                : mode === "VEHICLE"
                  ? units === 1
                    ? "day"
                    : "days"
                  : units === 1
                    ? "night"
                    : "nights"}
            </dt>
            <dd className="tnum">{formatMoney(unitPrice * units)}</dd>
          </div>
          {driverTotal > 0 ? (
            <div className="flex justify-between">
              <dt className="text-[var(--ink-muted)]">
                Driver {formatMoney(driverPerDay ?? 0)} × {days} {days === 1 ? "day" : "days"}
              </dt>
              <dd className="tnum">{formatMoney(driverTotal)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between font-semibold">
            <dt>Total</dt>
            <dd className="tnum">{formatMoney(subtotal)}</dd>
          </div>
          {/* At 100% the total is the whole payment, so only a real deposit gets its own lines. */}
          {depositPercent >= 100 ? null : (
            <>
              <div className="flex justify-between text-[var(--ink-faint)]">
                <dt>Deposit to confirm ({depositPercent}%)</dt>
                <dd className="tnum">{formatMoney(deposit)}</dd>
              </div>
              <div className="flex justify-between text-[var(--ink-faint)]">
                <dt>Balance, paid later</dt>
                <dd className="tnum">{formatMoney(subtotal - deposit)}</dd>
              </div>
            </>
          )}
        </dl>

        {mode === "VEHICLE" && insuranceCharge && damageStatement ? (
          <div className="space-y-2.5 rounded-[var(--radius-inset)] border border-clay-300 bg-clay-100 p-4">
            <p className="text-2xs leading-relaxed text-clay-900">{damageStatement}</p>
            <label className="flex items-start gap-2.5 text-2xs leading-relaxed text-clay-900">
              <input
                type="checkbox"
                name="damageAccepted"
                required
                className="mt-0.5 size-4 shrink-0 accent-forest-800"
              />
              <span>I have read and agree to the vehicle damage liability terms stated above.</span>
            </label>
          </div>
        ) : null}

        <details className="rounded-[var(--radius-inset)] border border-[var(--line)] p-3">
          <summary className="cursor-pointer text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
            Travelling details (optional)
          </summary>
          <div className="mt-3 space-y-3">
            <label className="flex flex-col gap-1 text-2xs text-[var(--ink-muted)]">
              Lead traveller, if not you
              <input
                name="leadTraveller"
                maxLength={120}
                placeholder="Full name"
                className="w-full rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-3 py-2 text-sm outline-none focus-visible:border-lake-600"
              />
            </label>
            <label className="flex flex-col gap-1 text-2xs text-[var(--ink-muted)]">
              Phone on the day
              <input
                name="leadPhone"
                maxLength={40}
                placeholder="+250…"
                className="w-full rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-3 py-2 text-sm outline-none focus-visible:border-lake-600"
              />
            </label>
            <label className="flex flex-col gap-1 text-2xs text-[var(--ink-muted)]">
              Anything we should know
              <textarea
                name="notes"
                rows={3}
                maxLength={2000}
                placeholder="Dietary needs, accessibility, a second pickup…"
                className="w-full resize-y rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-lake-600"
              />
            </label>
          </div>
        </details>

        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="w-full"
          disabled={pending}
        >
          {pending ? "Holding your dates…" : "Continue to payment"}
        </Button>

        {/* Some customers would rather talk than fill a form; this hands over what they already picked. */}
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => {
            const lines = [
              `Hi ${site.name}, I'd like to book ${title}.`,
              "",
              `Dates: ${start} to ${end}`,
              `${mode === "VEHICLE" ? "Passengers" : "Guests"}: ${guests}`,
              ...(room ? [`Room: ${room.name}`] : []),
              ...(mode === "VEHICLE" && driverPerDay
                ? [`Driver: ${withDriver ? "yes" : "self-drive"}`]
                : []),
              ...(mode === "TOUR" && residency
                ? [`Residency: ${RESIDENCY_LABELS[residency]}`]
                : []),
              `Indicative total: ${formatMoney(subtotal)}`,
              "",
              "Could you confirm availability?",
            ];
            window.open(
              `${site.contact.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`,
              "_blank",
              "noopener,noreferrer",
            );
          }}
          className="w-full border-[#25D366] text-[#128C4A] hover:bg-[#25D366]/10"
        >
          <WhatsAppIcon className="size-5 fill-current" />
          Book on WhatsApp
        </Button>

        <p className="text-center text-2xs leading-relaxed text-[var(--ink-faint)]">
          We hold your place against live availability straight away. Nothing is
          charged at this step — payment comes next.
        </p>
      </div>

      <div className="space-y-2.5 border-t border-[var(--line)] bg-[var(--paper-sunken)] px-6 py-5">
        <p className="flex items-start gap-2.5 text-2xs leading-relaxed text-[var(--ink-muted)]">
          <ShieldCheck className="mt-px size-4 shrink-0 text-clay-700" />
          Funds are held until your service is delivered. Free cancellation up
          to 72 hours before the start date.
        </p>
        <p className="text-2xs text-[var(--ink-faint)]">
          Questions?{" "}
          <Link href={site.contact.whatsapp} className="link-draw text-clay-700">
            WhatsApp {site.contact.phone}
          </Link>
        </p>
      </div>
    </form>
  );
}

function Stepper({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-8 place-items-center rounded-full border border-[var(--line-strong)] transition-colors hover:border-forest-800 hover:bg-forest-800 hover:text-bone-50 disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  );
}
