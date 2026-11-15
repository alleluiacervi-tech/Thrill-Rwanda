"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeftRight, CalendarDays, Car, Check, Clock3, MapPin, Search, Users } from "lucide-react";
import { bookTransfer, type TransferBookingState } from "@/app/actions/transfer-booking";
import { Button } from "@/components/ui/button";
import { TypeAhead } from "@/components/search/type-ahead";
import { useSite } from "@/components/layout/site-context";
import {
  PICKUP_POINTS,
  REGION_LABEL,
  VEHICLES,
  fareFor,
  groupZones,
  pickupPoint,
  quoteZoneTrip,
  tripEnds,
  type PublicZone,
  type Region,
  type VehicleKey,
} from "@/lib/transfer-zones-shared";
import { cn, formatMoney, localDatePlus, todayLocal } from "@/lib/utils";

/**
 * Transfer booking, laid out like a taxi search: pick-up ⇄ destination, date,
 * time and passengers, then the vehicles with their fixed prices.
 *
 * One side of the trip is always an airport or terminal (or, between towns, a
 * town-to-town route); the other is an area from that point's zone list. The
 * swap button flips which end is which. "Continue to payment" books it — the
 * server prices it again — and anything off the list goes to the desk.
 */

const OTHER = "other";

const control =
  "w-full min-w-0 cursor-pointer appearance-none bg-transparent text-base font-medium text-[var(--ink)] outline-none tnum lg:text-[0.9375rem]";

/** One cell of the search bar: small label over the control, like the home search. */
function BarField({
  label,
  icon: Icon,
  children,
  className,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex min-w-0 flex-col justify-center gap-1 rounded-[0.875rem] bg-bone-50 px-4 py-3 ring-1 ring-bone-200 transition-colors hover:bg-white focus-within:bg-white focus-within:ring-2 focus-within:ring-lake-600",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-bone-600">
        <Icon className="size-3.5 text-forest-600" />
        {label}
      </span>
      {children}
    </label>
  );
}

export type TransferFormInitial = { point?: string; area?: string; date?: string; time?: string; passengers?: string };

export function TransferForm({
  className,
  zones,
  initial = {},
}: {
  className?: string;
  zones: PublicZone[];
  /** A trip carried over from the home search bar. */
  initial?: TransferFormInitial;
}) {
  const router = useRouter();
  const site = useSite();
  const formRef = React.useRef<HTMLFormElement>(null);
  const resultsRef = React.useRef<HTMLDivElement>(null);
  const [booking, bookAction, booking_pending] = React.useActionState<TransferBookingState, FormData>(
    bookTransfer,
    { status: "idle" },
  );
  const [requesting, setRequesting] = React.useState(false);

  const startPoint = pickupPoint(initial.point ?? "") ?? PICKUP_POINTS[0]!;
  const [region, setRegion] = React.useState<Region>(startPoint.region);
  const [pointKey, setPointKey] = React.useState(startPoint.key);
  const [choice, setChoice] = React.useState(() => {
    const zone = zones.find((z) => z.origin === startPoint.table && z.areas.includes(initial.area ?? ""));
    return zone ? `${zone.id}|${initial.area}` : "";
  });
  const [direction, setDirection] = React.useState<"from" | "to">("from");
  const [time, setTime] = React.useState(initial.time && /^\d{2}:\d{2}$/.test(initial.time) ? initial.time : "09:00");
  const [passengers, setPassengers] = React.useState(() => {
    const n = Number(initial.passengers);
    return Number.isInteger(n) && n >= 1 && n <= 14 ? n : 2;
  });
  const [vehicleKey, setVehicleKey] = React.useState<VehicleKey | null>(null);
  // Results show once searched; arriving from the home search counts.
  const [searched, setSearched] = React.useState(Boolean(choice));
  const [missingArea, setMissingArea] = React.useState(false);

  // Booked: on to checkout. Signed out: sign in and come back.
  React.useEffect(() => {
    if (booking.status === "success") router.push(`/checkout/${booking.reference}`);
    if (booking.status === "auth") router.push(booking.signInUrl);
  }, [booking, router]);

  // Arrived from the home search with a trip: show the form and its prices.
  React.useEffect(() => {
    if (!initial.area) return;
    const align = () => formRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
    align();
    // The sticky header shrinks over 500ms once scrolled, pulling the form up; line it up again after.
    const t = window.setTimeout(align, 600);
    return () => window.clearTimeout(t);
  }, [initial.area]);

  const point = pickupPoint(pointKey) ?? startPoint;
  const tableZones = zones.filter((z) => z.origin === point.table);
  const [zoneId, area = ""] = choice.split("|");
  const zone = choice && choice !== OTHER ? tableZones.find((z) => z.id === zoneId) : undefined;
  const largest = Math.min(site.rules.maxPassengers, Math.max(...VEHICLES.map((v) => v.seats)));
  const tooMany = passengers > largest;
  const fromPoint = direction === "from";
  const [pickup, dropoff] = zone ? tripEnds(point, area, fromPoint) : ["", ""];

  const vehicle = vehicleKey && (VEHICLES.find((v) => v.key === vehicleKey)?.seats ?? 0) >= passengers ? vehicleKey : null;
  const quote = zone && vehicle && !tooMany ? quoteZoneTrip({ zone, vehicle, point, fromPoint, time }) : null;

  function pickRegion(next: Region) {
    setRegion(next);
    setPointKey(PICKUP_POINTS.find((p) => p.region === next)!.key);
    setChoice("");
    setSearched(false);
  }

  function pickPoint(key: string) {
    const next = pickupPoint(key);
    // The airport and Nyabugogo share one area list, so a chosen area can stay.
    if (next && next.table !== point.table) setChoice("");
    setPointKey(key);
  }

  function search() {
    if (!choice) {
      setMissingArea(true);
      return;
    }
    setMissingArea(false);
    setSearched(true);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  // Dispatched by hand, not as the form's action, so a refused booking keeps what was typed.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!quote) return;
    const data = new FormData(e.currentTarget);
    React.startTransition(() => bookAction(data));
  }

  // The desk route: groups too big to book, areas off the list, or anyone who'd rather ask.
  function sendAsRequest() {
    const form = formRef.current;
    if (!form) return;
    setRequesting(true);
    const data = new FormData(form);
    const params = new URLSearchParams({
      subject: "Airport transfer",
      from: pickup || point.label,
      to: dropoff,
      date: String(data.get("date") ?? ""),
      time,
      guests: String(passengers),
      flight: String(data.get("flight") ?? ""),
      notes: [
        quote ? `${VEHICLES.find((v) => v.key === vehicle)?.label}, quoted ${formatMoney(quote.totalMinor)}` : null,
        String(data.get("notes") ?? "") || null,
      ]
        .filter(Boolean)
        .join("\n"),
    });
    router.push(`/contact?${params.toString()}`);
  }

  const points = PICKUP_POINTS.filter((p) => p.region === region);
  const groups = groupZones(tableZones);

  const pointSelect = (
    <select value={point.key} onChange={(e) => pickPoint(e.target.value)} className={control} aria-label="Airport or station">
      {points.map((p) => (
        <option key={p.key} value={p.key}>
          {p.label}
        </option>
      ))}
    </select>
  );

  // Typed, not picked from a long list: suggestions appear only for what's typed.
  const areaOptions = groups.flatMap((g) =>
    g.zones.flatMap((z) =>
      z.areas
        // The airport in Zone 1 is for Nyabugogo pickups, not a trip from the airport to itself.
        .filter((a) => a !== point.short)
        .map((a) => ({ value: `${z.id}|${a}`, label: a, hint: g.name })),
    ),
  );
  const areaSelect = (
    <TypeAhead
      options={areaOptions}
      value={choice}
      onChange={(v) => {
        setChoice(v);
        setMissingArea(false);
      }}
      fallback={{ value: OTHER, label: point.pointToPoint ? "Another route — we'll quote" : "Somewhere else — we'll quote" }}
      placeholder={point.pointToPoint ? "Type a town, e.g. Rubavu" : "Type your area, e.g. Kiyovu"}
      aria-label={point.pointToPoint ? "Route" : "Your area"}
      className={cn(control, "cursor-text placeholder:text-[var(--ink-faint)]")}
    />
  );

  // Between coast towns the route is one choice, so "pick-up" picks the trip type.
  const pickupCell = point.pointToPoint || fromPoint ? pointSelect : areaSelect;
  const destinationCell = point.pointToPoint ? areaSelect : fromPoint ? areaSelect : pointSelect;

  return (
    <form ref={formRef} onSubmit={onSubmit} className={cn("scroll-mt-28", className)}>
      {/* What the server needs to price it again. */}
      <input type="hidden" name="point" value={point.key} />
      <input type="hidden" name="zoneId" value={zone?.id ?? ""} />
      <input type="hidden" name="area" value={zone ? area : ""} />
      <input type="hidden" name="direction" value={direction} />

      {/* ------------------------------------------------------ Search bar */}
      <div role="radiogroup" aria-label="Region" className="mb-3 flex gap-2">
        {(["KIGALI", "HIGHLANDS"] as Region[]).map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={region === r}
            onClick={() => pickRegion(r)}
            className={cn(
              "h-10 rounded-full px-5 text-sm font-semibold transition-colors",
              region === r
                ? "bg-white text-forest-900 shadow-[var(--shadow-lift)]"
                : "bg-forest-950/40 text-white/85 ring-1 ring-white/20 backdrop-blur-md hover:bg-forest-950/60 hover:text-white",
            )}
          >
            {REGION_LABEL[r]}
          </button>
        ))}
      </div>

      <div className="grid gap-1.5 rounded-[var(--radius-panel)] bg-white p-2 shadow-[var(--shadow-float)] ring-1 ring-forest-950/5 lg:grid-cols-[1.5fr_auto_1.5fr_1fr_0.75fr_0.75fr_auto]">
        <BarField label="Pick-up" icon={MapPin}>
          {pickupCell}
        </BarField>
        <button
          type="button"
          onClick={() => setDirection((d) => (d === "from" ? "to" : "from"))}
          aria-label="Swap pick-up and destination"
          className="grid place-items-center rounded-[0.875rem] bg-bone-50 px-3 py-2 text-[var(--ink-muted)] ring-1 ring-bone-200 transition-colors hover:bg-white hover:text-forest-800"
        >
          <ArrowLeftRight className="size-4 rotate-90 lg:rotate-0" />
        </button>
        <BarField label="Destination" icon={MapPin} className={cn(missingArea && "ring-2 ring-red-600")}>
          {destinationCell}
        </BarField>
        <BarField label="Date" icon={CalendarDays}>
          <input
            type="date"
            name="date"
            required
            defaultValue={initial.date && /^\d{4}-\d{2}-\d{2}$/.test(initial.date) ? initial.date : localDatePlus(1)}
            min={todayLocal()}
            className={control}
          />
        </BarField>
        <BarField label="Time" icon={Clock3}>
          <input type="time" name="time" required value={time} onChange={(e) => setTime(e.target.value)} className={control} />
        </BarField>
        <BarField label="Passengers" icon={Users}>
          <select name="passengers" value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} className={control}>
            {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </BarField>
        <Button type="button" onClick={search} variant="accent" size="lg" className="h-auto min-h-14 rounded-[0.875rem] px-7">
          <Search className="size-5" />
          Search
        </Button>
      </div>
      {missingArea ? (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          Choose where you&rsquo;re going to see prices.
        </p>
      ) : null}

      {/* --------------------------------------------------------- Results */}
      {searched ? (
        <div ref={resultsRef} className="mt-10 scroll-mt-28 space-y-6">
          {!zone || tooMany ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6 sm:p-8">
              <h3 className="text-xl">We&rsquo;ll quote this one</h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ink-muted)]">
                {tooMany
                  ? `Groups over ${largest} need a bigger vehicle than we book online.`
                  : "That trip isn't on our price list yet."}{" "}
                Send your requirements so the desk can check options and provide a written quotation.
              </p>
              <Button type="button" variant="accent" size="lg" className="mt-6" onClick={sendAsRequest} disabled={requesting}>
                {requesting ? "Preparing…" : "Send as a request"}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xl">
                  {pickup} <span className="text-clay-500" aria-hidden>→</span> {dropoff}
                </h3>
                <p className="text-sm text-[var(--ink-muted)]">
                  {zone.name}
                  {zone.distance ? ` · ${zone.distance}` : ""}
                </p>
              </div>

              <ul className="space-y-3">
                {VEHICLES.map((v) => {
                  const fits = v.seats >= passengers;
                  const selected = vehicle === v.key;
                  const total = fits ? quoteZoneTrip({ zone, vehicle: v.key, point, fromPoint, time }).totalMinor : null;
                  return (
                    <li
                      key={v.key}
                      className={cn(
                        "flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border bg-[var(--paper-raised)] p-5 transition-colors",
                        selected ? "border-forest-800 ring-1 ring-forest-800" : "border-[var(--line)]",
                        !fits && "opacity-50",
                      )}
                    >
                      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-clay-100 text-clay-700">
                        <Car className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{v.label}</p>
                        <p className="text-2xs text-[var(--ink-muted)]">
                          {fits ? `${v.note} · Meet & greet · Flight tracking · 60 min free waiting` : `Seats ${v.seats} — too small for ${passengers}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="tnum font-display text-2xl font-semibold">{total ? formatMoney(total) : "—"}</p>
                          {total && total !== fareFor(zone, v.key) ? (
                            <p className="text-2xs text-[var(--ink-faint)]">incl. fees below</p>
                          ) : (
                            <p className="text-2xs text-[var(--ink-faint)]">per vehicle</p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant={selected ? "primary" : "outline"}
                          disabled={!fits}
                          onClick={() => setVehicleKey(v.key)}
                        >
                          {selected ? (
                            <>
                              <Check className="size-4" /> Selected
                            </>
                          ) : (
                            "Select"
                          )}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {vehicle && quote ? (
                <div className="grid gap-6 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr]">
                  <input type="hidden" name="vehicle" value={vehicle} />
                  <div className="space-y-4">
                    <h3 className="text-lg">Trip details</h3>
                    <label className="flex flex-col gap-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                      Flight / train number
                      <input
                        name="flight"
                        placeholder="KQ101"
                        className="rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-4 py-3 text-sm normal-case tracking-normal text-[var(--ink)] outline-none focus-visible:border-lake-600"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                      Special requests
                      <textarea
                        name="notes"
                        rows={2}
                        placeholder="Child seat, a second stop…"
                        className="resize-y rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-4 py-3 text-sm normal-case tracking-normal text-[var(--ink)] outline-none focus-visible:border-lake-600"
                      />
                    </label>
                  </div>

                  <div className="flex flex-col">
                    <dl className="space-y-1.5 rounded-[var(--radius-inset)] bg-[var(--paper-sunken)] p-4 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-[var(--ink-muted)]">{VEHICLES.find((v) => v.key === vehicle)?.label} fare</dt>
                        <dd className="tnum">{formatMoney(quote.fareMinor)}</dd>
                      </div>
                      {quote.extras.map((x) => (
                        <div key={x.label} className="flex justify-between gap-3">
                          <dt className="text-[var(--ink-muted)]">{x.label}</dt>
                          <dd className="tnum">{formatMoney(x.minor)}</dd>
                        </div>
                      ))}
                      <div className="flex justify-between gap-3 border-t border-[var(--line)] pt-2 font-semibold">
                        <dt>Total</dt>
                        <dd className="tnum text-base">{formatMoney(quote.totalMinor)}</dd>
                      </div>
                      <p className="pt-1 text-2xs leading-relaxed text-[var(--ink-faint)]">
                        Review the quoted inclusions, waiting allowance, parking, tolls and any luggage or child-seat conditions before accepting.
                      </p>
                    </dl>

                    {booking.status === "error" ? (
                      <p
                        role="alert"
                        className="mt-3 flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-red-200 bg-red-50 p-3 text-2xs leading-relaxed text-red-900"
                      >
                        <AlertTriangle className="mt-px size-3.5 shrink-0" />
                        <span>{booking.message}</span>
                      </p>
                    ) : null}

                    <Button
                      type="submit"
                      variant="accent"
                      size="lg"
                      className="mt-4 w-full"
                      disabled={booking_pending || booking.status === "success"}
                    >
                      {booking_pending || booking.status === "success" ? "Holding your transfer…" : "Continue to payment"}
                    </Button>
                    <button
                      type="button"
                      onClick={sendAsRequest}
                      disabled={requesting}
                      className="mt-3 text-center text-2xs text-[var(--ink-muted)] underline-offset-4 hover:underline"
                    >
                      {requesting ? "Preparing…" : "Rather ask first? Send it as a request"}
                    </button>
                    <p className="mt-2 text-center text-2xs text-[var(--ink-faint)]">Nothing is charged until you confirm on the next step.</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--ink-muted)]">Select a vehicle to continue.</p>
              )}
            </>
          )}
        </div>
      ) : null}
    </form>
  );
}
