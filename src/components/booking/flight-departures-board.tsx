"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { destinationRegions, PICK_DESTINATION_EVENT, placeLabel, type Destination } from "@/lib/flight-destinations";
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

/**
 * "Departures from Kigali": destinations people ask the desk for. Choosing
 * one fills the search above and opens the calendar.
 */
export function DeparturesBoard({ formId }: { formId: string }) {
  const [region, setRegion] = useState(destinationRegions[0].id);
  const shown = destinationRegions.find((item) => item.id === region)!;

  function choose(place: Destination) {
    document.getElementById(formId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.dispatchEvent(new CustomEvent(PICK_DESTINATION_EVENT, { detail: placeLabel(place) }));
  }

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
        <span>From</span>
        <span>To</span>
        <span className={s.headCity}>Destination</span>
        <span className={s.headCountry}>Country</span>
        <span className={s.headAction}>Fares</span>
      </div>

      <ul id="board-rows" role="tabpanel" aria-labelledby={`board-tab-${region}`} className={s.rows} key={region}>
        {shown.places.map((place) => {
          const country = regionNames.of(place.country) ?? place.country;
          return (
            <li key={place.code}>
              <button type="button" className={s.row} onClick={() => choose(place)} aria-label={`Plan Kigali to ${place.city}, ${country}`}>
                <Flaps text="KGL" className={s.codeFrom} />
                <Flaps text={place.code} className={s.code} />
                <span className={s.city}>{place.city}</span>
                <span className={s.country}><CountryFlag country={place.country} /> <span>{country}</span></span>
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
