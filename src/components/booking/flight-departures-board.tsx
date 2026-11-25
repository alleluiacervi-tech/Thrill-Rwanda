"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { ArrowRight, ChevronRight } from "lucide-react";
import { allDestinations, destinationRegions, KIGALI, PICK_DESTINATION_EVENT, placeLabel, popularDestinations, type Destination, type DestinationPick } from "@/lib/flight-destinations";
import type { BoardFare, FareBoard } from "@/lib/fare-board";
import { FlightGlobe } from "./flight-globe";
import s from "./flight-departures-board.module.css";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const dateText = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Great-circle distance from Kigali, rounded to 10 km: a fact, unlike a guessed flight time. */
function distanceText(place: Destination) {
  if (place.lat === undefined || place.lon === undefined) return null;
  const rad = Math.PI / 180;
  const a =
    Math.sin(((place.lat - KIGALI.lat) * rad) / 2) ** 2 +
    Math.cos(KIGALI.lat * rad) * Math.cos(place.lat * rad) * Math.sin(((place.lon - KIGALI.lon) * rad) / 2) ** 2;
  const km = Math.round((2 * 6371 * Math.asin(Math.sqrt(a))) / 10) * 10;
  return `${km.toLocaleString("en-GB")} km`;
}
const placeMeta = (place: Destination) => {
  const country = regionNames.of(place.country) ?? place.country;
  const km = distanceText(place);
  return km ? `${country}, ${km} from Kigali` : country;
};

const routed = allDestinations.filter((place): place is Destination & { lat: number; lon: number } => place.lat !== undefined && place.lon !== undefined);

type View = "cheap" | "deals" | "trending" | "all";
/** [phone, wider]: the full names do not fit side by side on a phone. */
const VIEW_LABEL: Record<View, [string, string]> = {
  cheap: ["Cheapest", "Cheap flights"],
  deals: ["Deals", "Best deals"],
  trending: ["Trending", "Trending"],
  all: ["Regions", "By region"],
};

/**
 * The fares band: the board beside the globe. Cheap flights, Best deals and
 * Trending appear only when there is real data behind them
 * (src/lib/fare-board.ts); All destinations is always there. The rows in view
 * light their routes on the globe, the row under the pointer turns the globe
 * to it, and choosing a city fills the search (with the fare's date, if any).
 */
export function FlightRoutes({ formId, fares, children }: { formId: string; fares: FareBoard; children: React.ReactNode }) {
  // Every tab is always there. One without data says so and offers the way in,
  // rather than vanishing; nothing on it is invented.
  const views: View[] = ["cheap", "deals", "trending", "all"];
  const [view, setView] = useState<View>(() => views.find((v) => v !== "all" && fares[v].length > 0) ?? "cheap");
  const [region, setRegion] = useState(destinationRegions[0].id);
  const [focus, setFocus] = useState<string | null>(null);

  const choose = useCallback((place: Destination, departureDate?: string) => {
    document.getElementById(formId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    const detail: DestinationPick = departureDate ? { destination: placeLabel(place), departureDate } : placeLabel(place);
    window.dispatchEvent(new CustomEvent(PICK_DESTINATION_EVENT, { detail }));
  }, [formId]);

  const fareRows = useMemo(() => (view === "cheap" ? fares.cheap : view === "deals" ? fares.deals : []), [view, fares]);
  const empty = view !== "all" && fares[view].length === 0;
  // Until our own requests can rank Trending: where travellers search from Kigali, or our usual list.
  const searched = view === "trending" && empty && fares.popular.length > 0;
  const fallback = searched ? fares.popular : popularDestinations.map((place) => ({ place, fare: undefined as BoardFare | undefined }));
  const lit =
    view === "all"
      ? destinationRegions.find((item) => item.id === region)!.places.map((place) => place.code)
      : empty
        ? fallback.map((item) => item.place.code)
        : view === "trending"
          ? fares.trending.map((t) => t.place.code)
          : fareRows.map((fare) => fare.place.code);
  const prices = useMemo(() => {
    const list = searched
      ? fares.popular.flatMap((p) => (p.fare ? [p.fare] : []))
      : view === "trending"
        ? fares.trending.flatMap((t) => (t.fare ? [t.fare] : []))
        : fareRows;
    return list.length ? Object.fromEntries(list.map((fare) => [fare.place.code, fare.price])) : undefined;
  }, [view, fares, fareRows, searched]);

  const hover = { onFocus: setFocus };

  return (
    <div className={s.routes}>
      <div className={s.routesText}>
        {children}
        <div className={s.board}>
          <div className={s.views} role="tablist" aria-label="Fares from Kigali">
              {views.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  id={`fares-tab-${item}`}
                  aria-selected={item === view}
                  aria-controls="fares-panel"
                  tabIndex={item === view ? 0 : -1}
                  onClick={() => setView(item)}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                    const i = views.indexOf(view);
                    const next = views[(i + (event.key === "ArrowRight" ? 1 : -1) + views.length) % views.length];
                    setView(next);
                    document.getElementById(`fares-tab-${next}`)?.focus();
                  }}
                >
                  <span className={s.short}>{VIEW_LABEL[item][0]}</span>
                  <span className={s.long}>{VIEW_LABEL[item][1]}</span>
                </button>
              ))}
          </div>

          <div id="fares-panel" role="tabpanel" aria-labelledby={`fares-tab-${view}`}>
            {view === "all" ? (
              <AllDestinations region={region} onRegionChange={setRegion} onChoose={choose} {...hover} />
            ) : view === "deals" && empty ? (
              <div className={s.empty}>
                <p className={s.emptyTitle}>No deals flagged yet</p>
                <p>
                  A route shows here when its fare drops at least 10% below its own average over the last 30 days. Our
                  daily fare check needs a few weeks of prices before it can tell.
                </p>
                <button type="button" className={s.emptyAction} onClick={() => setView("cheap")}>
                  See fares from Kigali <ArrowRight size={16} aria-hidden />
                </button>
              </div>
            ) : empty ? (
              <ul className={s.rows} key={`${view}-popular`}>
                {fallback.map(({ place, fare }) => (
                  <li key={place.code}>
                    <Row place={place} meta={placeMeta(place)} action={view === "cheap" ? "Get fare" : "Plan route"}
                      price={fare?.price} onChoose={() => choose(place, fare?.date)} {...hover} />
                  </li>
                ))}
              </ul>
            ) : view === "trending" ? (
              <ul className={s.rows} key="trending">
                {fares.trending.map(({ place, rank, fare }) => (
                  <li key={place.code}>
                    <Row place={place} onChoose={() => choose(place, fare?.date)} {...hover}
                      meta={rank === 1 ? "Most requested this month" : `Number ${rank} this month`}
                      price={fare?.price} />
                  </li>
                ))}
              </ul>
            ) : (
              <ul className={s.rows} key={view}>
                {fareRows.map((fare) => (
                  <li key={fare.place.code}>
                    <Row place={fare.place} onChoose={() => choose(fare.place, fare.date)} {...hover}
                      meta={fareMeta(fare)} note={fare.note} price={fare.price} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className={s.foot}>
            {view === "all"
              ? "Not on the board? Type any city or airport in the search. The desk can quote any route."
              : view === "deals" && empty
                ? "Fares change by the hour; the desk confirms yours in writing."
                : view === "cheap" && empty
                  ? "Prices from our daily fare check appear here. Until then, choose a city and the desk sends you today's lowest fare in writing."
                  : searched
                    ? "Where travellers searching from Kigali want to fly this week, from Aviasales searches; not in any order. Prices are the lowest one-way fares we found."
                    : view === "trending" && empty
                    ? "The routes our travellers ask for most. Once a month of requests is counted, this list ranks them."
                    : view === "trending"
                      ? "Ranked by the flight requests our desk received in the last 30 days."
                      : fares.source === "skyscanner"
                        ? "Lowest one-way economy fare for one adult that Skyscanner found in the last 4 days. A guide price: the desk confirms yours in writing."
                        : fares.source === "travelpayouts"
                          ? `Lowest one-way economy fare for one adult seen in recent Aviasales searches, checked${fares.checkedOn ? ` on ${dateText(fares.checkedOn)}` : ""}. A guide price: the desk confirms yours in writing.`
                          : fares.source === "manual"
                          ? `One-way economy fare for one adult, checked by our Kigali desk${fares.checkedOn ? ` on ${dateText(fares.checkedOn)}` : ""}. Seats at this price can sell out; the desk confirms yours in writing.`
                          : `Lowest one-way economy fare for one adult, found by our daily check${fares.checkedOn ? ` on ${dateText(fares.checkedOn)}` : ""}. Fares change by the hour; the desk confirms yours in writing.`}
          </p>
          {/* Skyscanner's usage guidelines: "Powered by" and their mark, linking to skyscanner.net, wherever their prices show. */}
          {fares.source === "skyscanner" && prices ? (
            <a className={s.credit} href="https://www.skyscanner.net" target="_blank" rel="noopener noreferrer">
              Powered by <span className={s.creditMark}>Skyscanner</span>
            </a>
          ) : null}
        </div>
      </div>
      <div className={s.globe}>
        <FlightGlobe places={routed} highlight={lit} focus={focus} onPick={(place) => choose(place)} prices={prices} />
        <p className={s.globeHint} aria-hidden>Drag to turn. Choose a city to plan the route.</p>
      </div>
    </div>
  );
}

function fareMeta(fare: BoardFare) {
  // -1: Skyscanner says only that the flight connects, not how many times.
  const stops = fare.stops === 0 ? "nonstop" : fare.stops < 0 ? "connecting" : fare.stops === 1 ? "1 stop" : `${fare.stops} stops`;
  return { date: dateText(fare.date), stops, airline: fare.airline };
}

/** One line of the board: flag, city and what we know, then the price or the way in. */
function Row({ place, meta, note, price, action = "Plan route", onChoose, onFocus }: {
  place: Destination;
  /** "One way" and the airline are dropped on phones, where the line has no room (the footnote says one way). */
  meta: string | { date: string; stops: string; airline: string };
  note?: string;
  price?: string;
  /** The words on the button when there is no price. */
  action?: string;
  onChoose: () => void;
  onFocus: (code: string | null) => void;
}) {
  const country = regionNames.of(place.country) ?? place.country;
  const spoken = typeof meta === "string" ? meta : `${meta.date}, one way, ${meta.stops}${meta.airline ? `, ${meta.airline}` : ""}`;
  return (
    <button type="button" className={s.row} onClick={onChoose}
      aria-label={`${place.city}, ${country}. ${spoken}.${note ? ` ${note}.` : ""}${price ? ` From ${price}.` : ""} ${action}.`}
      onMouseEnter={() => onFocus(place.code)} onMouseLeave={() => onFocus(null)}
      onFocus={() => onFocus(place.code)} onBlur={() => onFocus(null)}>
      <span className={s.flag} aria-hidden>
        <Image src={`/media/flags/${place.country.toLowerCase()}.svg`} alt="" width={40} height={40} unoptimized />
      </span>
      <span className={s.place}>
        <span className={s.city}>{place.city}</span>
        <span className={s.country}>
          {typeof meta === "string" ? meta : (
            <>
              {meta.date}<span className={s.wide}>, one way</span>, {meta.stops}
              {meta.airline ? <span className={s.wide}>, {meta.airline}</span> : null}
            </>
          )}
        </span>
        {note ? <span className={s.note}>{note}</span> : null}
      </span>
      {price ? (
        <span className={s.price}>
          <span className={s.from}>from</span>
          <span className={s.amount}>{price}</span>
          <ChevronRight className={s.chev} aria-hidden />
        </span>
      ) : (
        <span className={s.action}>{action} <ArrowRight size={16} aria-hidden /></span>
      )}
    </button>
  );
}

/** The regional list people ask the desk for, without prices. */
function AllDestinations({ region, onRegionChange, onFocus, onChoose }: {
  region: string;
  onRegionChange: (region: string) => void;
  onFocus: (code: string | null) => void;
  onChoose: (place: Destination) => void;
}) {
  const shown = destinationRegions.find((item) => item.id === region)!;
  return (
    <>
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
            onClick={() => onRegionChange(item.id)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
              const i = destinationRegions.findIndex((entry) => entry.id === region);
              const next = destinationRegions[(i + (event.key === "ArrowRight" ? 1 : -1) + destinationRegions.length) % destinationRegions.length];
              onRegionChange(next.id);
              document.getElementById(`board-tab-${next.id}`)?.focus();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <ul id="board-rows" role="tabpanel" aria-labelledby={`board-tab-${region}`} className={s.rows} key={region}>
        {shown.places.map((place) => (
          <li key={place.code}>
            <Row place={place} meta={placeMeta(place)} onChoose={() => onChoose(place)} onFocus={onFocus} />
          </li>
        ))}
      </ul>
    </>
  );
}
