"use client";

import { useCallback, useState } from "react";
import { ArrowRight } from "lucide-react";
import { allDestinations, destinationRegions, PICK_DESTINATION_EVENT, placeLabel, type Destination } from "@/lib/flight-destinations";
import { FlightGlobe } from "./flight-globe";
import { CountryFlag } from "./flight-marks";
import s from "./flight-departures-board.module.css";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** Letters on split-flap tiles, as on an airport board. */
function Flaps({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} aria-hidden>
      {[...text].map((letter, i) => <span key={i} className={s.flap} style={{ animationDelay: `${i * 70}ms` }}>{letter}</span>)}
    </span>
  );
}

const routed = allDestinations.filter((place): place is Destination & { lat: number; lon: number } => place.lat !== undefined && place.lon !== undefined);

/**
 * The departures band: the board beside the globe. The region chosen on the
 * board lights its routes on the globe, the row under the pointer turns the
 * globe towards that route, and a city chosen on either fills the search.
 */
export function FlightRoutes({ formId, children }: { formId: string; children: React.ReactNode }) {
  const [region, setRegion] = useState(destinationRegions[0].id);
  const [focus, setFocus] = useState<string | null>(null);
  const lit = destinationRegions.find((item) => item.id === region)!.places.map((place) => place.code);
  const choose = useCallback((place: Destination) => {
    document.getElementById(formId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.dispatchEvent(new CustomEvent(PICK_DESTINATION_EVENT, { detail: placeLabel(place) }));
  }, [formId]);

  return (
    <div className={s.routes}>
      <div className={s.routesText}>
        {children}
        <DeparturesBoard region={region} onRegionChange={setRegion} onFocus={setFocus} onChoose={choose} />
      </div>
      <div className={s.globe}>
        <FlightGlobe places={routed} highlight={lit} focus={focus} onPick={choose} />
        <p className={s.globeHint} aria-hidden>Drag to turn · choose a city to plan the route</p>
      </div>
    </div>
  );
}

/** "Departures from Kigali": destinations people ask the desk for, by region. */
export function DeparturesBoard({ region, onRegionChange, onFocus, onChoose }: {
  region: string;
  onRegionChange: (region: string) => void;
  onFocus: (code: string | null) => void;
  onChoose: (place: Destination) => void;
}) {
  const shown = destinationRegions.find((item) => item.id === region)!;
  const setRegion = onRegionChange;
  const choose = onChoose;

  return (
    <div className={s.board}>
      <div className={s.tabs} role="tablist" aria-label="Regions">
        {destinationRegions.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`board-tab-${item.id}`}
            aria-selected={item.id === region}
            aria-controls="board-rows"
            tabIndex={item.id === region ? 0 : -1}
            onClick={() => setRegion(item.id)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
              const i = destinationRegions.findIndex((entry) => entry.id === region);
              const next = destinationRegions[(i + (event.key === "ArrowRight" ? 1 : -1) + destinationRegions.length) % destinationRegions.length];
              setRegion(next.id);
              document.getElementById(`board-tab-${next.id}`)?.focus();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={s.head} aria-hidden>
        <span>To</span>
        <span className={s.headCity}>Destination</span>
        <span className={s.headAction}>Fares</span>
      </div>

      <ul id="board-rows" role="tabpanel" aria-labelledby={`board-tab-${region}`} className={s.rows} key={region}>
        {shown.places.map((place) => {
          const country = regionNames.of(place.country) ?? place.country;
          return (
            <li key={place.code}>
              <button type="button" className={s.row} onClick={() => choose(place)} aria-label={`Plan Kigali to ${place.city}, ${country}`}
                onMouseEnter={() => onFocus(place.code)} onMouseLeave={() => onFocus(null)}
                onFocus={() => onFocus(place.code)} onBlur={() => onFocus(null)}>
                <Flaps text={place.code} className={s.code} />
                <span className={s.place}>
                  <span className={s.city}>{place.city}</span>
                  <span className={s.country}><CountryFlag country={place.country} /> <span>{country}</span></span>
                </span>
                <span className={s.action}>Plan route <ArrowRight size={16} aria-hidden /></span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className={s.foot}>Not on the board? Type any city or airport in the search. The desk can quote any route.</p>
    </div>
  );
}
