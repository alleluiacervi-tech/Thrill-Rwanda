"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, CarFront, MapPin, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AIRPORT_SEDAN_SEATS,
  AIRPORT_TRANSFER_LABEL,
  formatTransferRwf,
  transferTimeSchema,
  type AirportTransferDirection,
} from "@/lib/airport-transfer-pricing";

type Direction = AirportTransferDirection | "OTHER";
type Place = { placeId: string; label: string };
type Estimate = { distanceMeters: number; durationMinutes: number; fareRwf: number };
type EstimateResult = { key: string; pending?: boolean; fare?: Estimate; error?: string };

const inputClass = "mt-1.5 w-full rounded-lg border border-[var(--line-strong)] bg-white px-3.5 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-forest-700";
const unavailable = "Map lookup is temporarily unavailable. You can still request a quote.";

async function lookup<T>(body: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/transfers/map", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || unavailable);
  return data as T;
}

function GoogleAttribution() {
  return (
    <div className="px-2.5 pb-[5px] pt-2.5">
      <Image src="/google-maps-attribution.png" alt="Google Maps" width={98} height={18} unoptimized />
    </div>
  );
}

export function AirportTransferEstimate({
  partySize, time, errors,
}: {
  partySize: number;
  time: string;
  errors?: Record<string, string>;
}) {
  const [direction, setDirection] = useState<Direction>("OTHER");
  const [location, setLocation] = useState("");
  const [manualPickup, setManualPickup] = useState("");
  const [manualDropoff, setManualDropoff] = useState("");
  const [token, setToken] = useState("");
  const [selected, setSelected] = useState<Place>();
  const [matching, setMatching] = useState<{ key: string; places: Place[]; error?: string }>();
  const [estimate, setEstimate] = useState<EstimateResult>();
  const latestLookup = useRef<AbortController | null>(null);
  const other = direction === "OTHER";
  const from = direction === "FROM_AIRPORT";
  const input = location.trim();
  const matchKey = `${token}:${input}`;
  const estimateKey = `${direction}:${selected?.placeId ?? ""}:${time}:${partySize}`;
  const result = estimate?.key === estimateKey ? estimate : undefined;
  const fits = Number.isInteger(partySize) && partySize > 0 && partySize <= AIRPORT_SEDAN_SEATS;
  const matches = matching?.key === matchKey && !selected && fits ? matching : undefined;
  const canSearch = !other && fits && !!token && !selected && input.length >= 3 && input.length <= 160;

  useEffect(() => {
    if (!canSearch) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const { places } = await lookup<{ places: Place[] }>({ kind: "places", input, sessionToken: token }, controller.signal);
        if (!controller.signal.aborted) setMatching({ key: matchKey, places });
      } catch {
        if (!controller.signal.aborted) setMatching({ key: matchKey, places: [], error: unavailable });
      }
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [canSearch, input, matchKey, token]);

  function chooseDirection(next: Direction) {
    if (next === direction) return;
    latestLookup.current?.abort();
    setDirection(next);
    setSelected(undefined);
    setEstimate(undefined);
    setToken(next === "OTHER" ? "" : crypto.randomUUID());
  }

  async function checkFare() {
    if (!selected || !fits || other || !transferTimeSchema.safeParse(time).success) return;
    latestLookup.current?.abort();
    const controller = new AbortController();
    latestLookup.current = controller;
    setEstimate({ key: estimateKey, pending: true });
    setToken("");
    try {
      const fare = await lookup<Estimate>({
        kind: "estimate", placeId: selected.placeId, sessionToken: token || undefined,
        direction, time, passengers: partySize,
      }, controller.signal);
      if (!controller.signal.aborted) setEstimate({ key: estimateKey, fare });
    } catch (error) {
      if (!controller.signal.aborted) {
        setEstimate({ key: estimateKey, error: error instanceof Error ? error.message : unavailable });
      }
    }
  }

  const missing = errors?.pickup || errors?.dropoff;
  return (
    <section className="space-y-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-bone-50 p-4 sm:p-5" aria-label="Transfer route">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-forest-900">Where are you travelling?</legend>
        <div className="flex flex-wrap gap-2">
          {([
            ["FROM_AIRPORT", "From Kigali Airport"],
            ["TO_AIRPORT", "To Kigali Airport"],
            ["OTHER", "Another route"],
          ] as const).map(([value, label]) => (
            <label key={value}>
              <input type="radio" checked={direction === value} onChange={() => chooseDirection(value)} className="peer sr-only" name="transferDirection" value={value} />
              <span className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-[var(--line-strong)] bg-white px-3.5 text-sm peer-checked:border-forest-800 peer-checked:bg-forest-800 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-forest-700 peer-focus-visible:ring-offset-2">
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {other ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Pickup location
            <input name="pickup" required maxLength={200} value={manualPickup} onChange={(e) => setManualPickup(e.target.value)} className={inputClass} aria-invalid={!!missing} />
          </label>
          <label className="text-sm font-medium">
            Drop-off location
            <input name="dropoff" required maxLength={200} value={manualDropoff} onChange={(e) => setManualDropoff(e.target.value)} className={inputClass} aria-invalid={!!missing} />
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <input type="hidden" name={from ? "pickup" : "dropoff"} value={AIRPORT_TRANSFER_LABEL} />
          {selected ? <input type="hidden" name="transferPlaceId" value={selected.placeId} /> : null}
          <div className="flex items-center gap-2 text-sm text-forest-900">
            <Plane className="size-4" aria-hidden />
            {from ? "Pickup" : "Drop-off"} at {AIRPORT_TRANSFER_LABEL}
          </div>
          <label className="block text-sm font-medium">
            {from ? "Drop-off" : "Pickup"} hotel or address
            <input
              name={from ? "dropoff" : "pickup"}
              required
              maxLength={200}
              value={location}
              autoComplete="off"
              onChange={(e) => {
                latestLookup.current?.abort();
                if (selected || !token) setToken(crypto.randomUUID());
                setLocation(e.target.value);
                setSelected(undefined);
                setEstimate(undefined);
              }}
              className={inputClass}
              aria-invalid={!!missing}
              aria-describedby={fits ? "transfer-map-lookup-note" : undefined}
            />
          </label>
          {fits ? (
            <p id="transfer-map-lookup-note" className="text-xs text-[var(--ink-muted)]">
              Type the property name or address. The location you type is sent to Google Maps for suggestions. Select a match to get a fare estimate.
            </p>
          ) : (
            <p className="text-sm text-[var(--ink-muted)]">The desk will check vehicles and rates for your group.</p>
          )}
          {matches?.places.length || selected ? (
            <div className="rounded-lg border border-[var(--line)] bg-white">
              {selected ? (
                <p className="flex gap-2 px-3 pt-3 text-sm"><MapPin className="size-4 shrink-0 text-forest-700" aria-hidden /> {selected.label}</p>
              ) : (
                <ul aria-label="Suggested locations">
                  {matches?.places.map((place) => (
                    <li key={place.placeId}>
                      <button
                        type="button"
                        onClick={() => setSelected(place)}
                        className="flex w-full items-center gap-2 border-b border-[var(--line)] px-3 py-2.5 text-left text-sm hover:bg-bone-100 focus-visible:bg-bone-100"
                      >
                        <MapPin className="size-4 shrink-0 text-forest-700" aria-hidden />
                        {place.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <GoogleAttribution />
            </div>
          ) : matches ? (
            <p role="status" className="text-sm text-[var(--ink-muted)]">
              {matches.error || "No places matched. You can still send the address to the desk."}
            </p>
          ) : null}
          {selected && fits ? (
            <div className="space-y-2">
              <Button type="button" size="sm" variant="outline" onClick={checkFare} disabled={result?.pending || !transferTimeSchema.safeParse(time).success}>
                <CarFront className="size-4" aria-hidden />
                {result?.pending ? "Checking your route…" : "Estimate sedan fare"}
              </Button>
              {result?.error ? <p role="status" className="text-sm text-[var(--ink-muted)]">{result.error}</p> : null}
              {result?.fare ? (
                <div role="status" className="grid gap-3 rounded-lg border border-forest-200 bg-white p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-[var(--ink-muted)]">Estimated fare per sedan</p>
                    <p className="mt-1 text-2xl font-semibold text-forest-900">{formatTransferRwf(result.fare.fareRwf)}</p>
                  </div>
                  <div className="border-t border-[var(--line)] text-sm sm:border-l sm:border-t-0 sm:pl-4">
                    <p className="flex items-center gap-1.5 pt-2 sm:pt-0">
                      <ArrowDown className="size-3.5 text-forest-700" aria-hidden />
                      {(result.fare.distanceMeters / 1000).toFixed(1)} km · about {result.fare.durationMinutes} min driving
                    </p>
                    <GoogleAttribution />
                  </div>
                  <p className="text-sm text-[var(--ink-muted)] sm:col-span-2">The desk checks availability, luggage, included waiting, and the final price in your written quote.</p>
                </div>
              ) : null}
              {!transferTimeSchema.safeParse(time).success ? (
                <p className="text-sm text-[var(--ink-muted)]">Enter a pickup time above to see the fare.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      {missing ? <p role="alert" className="text-sm text-red-700">{missing}</p> : null}
    </section>
  );
}
