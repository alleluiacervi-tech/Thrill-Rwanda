"use client";

import { createContext, useContext, useId, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { featuredAirport } from "@/lib/flight-enquiry-schema";
import { allDestinations, placeLabel, popularDestinations, type Destination } from "@/lib/flight-destinations";
import { CountryFlag } from "./flight-marks";
import s from "./flight-planner.module.css";

type Directory = typeof import("@/lib/flight-geography");
const AirportDirectory = createContext<{ directory?: Directory; load: () => void }>({ load: () => {} });

export function AirportDirectoryProvider({ children }: { children: ReactNode }) {
  const [directory, setDirectory] = useState<Directory>();
  const loading = useRef(false);
  function load() {
    if (directory || loading.current) return;
    loading.current = true;
    import("@/lib/flight-geography").then(setDirectory).catch(() => {
      // Free-text entry stays available. Retry the download on the next interaction.
      loading.current = false;
    });
  }
  return <AirportDirectory.Provider value={{ directory, load }}>{children}</AirportDirectory.Provider>;
}

export function AirportFlag({ value }: { value: string }) {
  const { directory } = useContext(AirportDirectory);
  const known = allDestinations.find((place) => placeLabel(place) === value)?.country;
  return <CountryFlag country={known ?? (directory ? directory.airportCountry(value) : featuredAirport(value)?.country)} />;
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/**
 * Free text with a suggestion list (ARIA combobox). Any place can be typed;
 * picking a suggestion writes it as "City (CODE)" so the desk gets the airport.
 */
export function AirportInput({ value, onChange, label, inputRef, placeholder = "City or airport", suggestPopular = false }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  inputRef?: Ref<HTMLInputElement>;
  placeholder?: string;
  /** Offer popular destinations while the field is empty. */
  suggestPopular?: boolean;
}) {
  const id = useId();
  const { directory, load } = useContext(AirportDirectory);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const typed = value.trim() !== "";
  const options: Destination[] = useMemo(
    () => (typed ? directory?.airportSuggestions(value) ?? [] : suggestPopular ? popularDestinations : []),
    [directory, value, typed, suggestPopular],
  );
  const shown = open && options.length > 0;
  const current = Math.min(active, options.length - 1);

  function pick(place: Destination) {
    onChange(placeLabel(place));
    setOpen(false);
  }

  return (
    <span className={s.combo}>
      <AirportFlag value={value} />
      <input
        ref={inputRef}
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={`${id}-list`}
        aria-activedescendant={shown ? `${id}-${current}` : undefined}
        autoComplete="off"
        spellCheck={false}
        required
        maxLength={120}
        value={value}
        placeholder={placeholder}
        onFocus={(event) => { load(); setOpen(true); event.currentTarget.select(); }}
        onBlur={() => setOpen(false)}
        onChange={(event) => { onChange(event.target.value); setActive(0); setOpen(true); load(); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!shown) return setOpen(true);
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActive((current + step + options.length) % options.length);
          } else if (event.key === "Enter" && shown) {
            event.preventDefault();
            pick(options[current]);
          } else if (event.key === "Escape" && shown) {
            event.stopPropagation();
            setOpen(false);
          }
        }}
      />
      <ul id={`${id}-list`} role="listbox" aria-label={`${label} suggestions`} className={s.suggest} hidden={!shown}>
        {!typed && shown ? <li role="presentation" className={s.suggestHead}>Popular from Kigali</li> : null}
        {options.map((place, i) => (
          <li
            key={place.code}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === current}
            onMouseDown={(event) => { event.preventDefault(); pick(place); }}
            onMouseEnter={() => setActive(i)}
          >
            <CountryFlag country={place.country} />
            <span>
              <b>{place.city}</b>
              <small>{regionNames.of(place.country) ?? place.country}</small>
            </span>
            <code>{place.code}</code>
          </li>
        ))}
      </ul>
    </span>
  );
}
