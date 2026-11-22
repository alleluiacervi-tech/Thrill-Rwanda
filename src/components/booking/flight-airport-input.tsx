"use client";

import { createContext, useContext, useId, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { featuredAirport } from "@/lib/flight-enquiry-schema";
import { CountryFlag } from "./flight-marks";

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
  return <CountryFlag country={directory ? directory.airportCountry(value) : featuredAirport(value)?.country} />;
}

export function AirportInput({ value, onChange, label, inputRef }: {
  value: string; onChange: (value: string) => void; label: string; inputRef?: Ref<HTMLInputElement>;
}) {
  const id = useId();
  const { directory, load } = useContext(AirportDirectory);
  const suggestions = useMemo(() => directory?.airportSuggestions(value), [directory, value]);
  return <>
    <span className="flex min-w-0 items-center gap-2">
      <AirportFlag value={value} />
      <input ref={inputRef} aria-label={label} required maxLength={120} list={id} value={value}
        placeholder="City or airport" onFocus={load} onChange={event => { onChange(event.target.value); load(); }} />
    </span>
    <datalist id={id}>{suggestions?.map(({ code, city, country }) =>
      <option key={code} value={`${city} (${code})`}>{directory?.countryName(country)}</option>
    )}</datalist>
  </>;
}
