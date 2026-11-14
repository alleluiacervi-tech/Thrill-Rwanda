"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Car, Clock3, MapPin, Plane, Search, Tent, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TypeAhead } from "@/components/search/type-ahead";
import { PICKUP_POINTS, groupZones, pickupPoint, type PublicZone } from "@/lib/transfer-zones-shared";
import { cn } from "@/lib/utils";

type TabKey = "stays" | "safaris" | "cars" | "transfers";

const tabs: { key: TabKey; label: string; icon: React.ElementType; href: string }[] = [
  { key: "stays", label: "Stays", icon: MapPin, href: "/hotels" },
  { key: "safaris", label: "Safaris", icon: Tent, href: "/tours" },
  { key: "cars", label: "Car Hire", icon: Car, href: "/cars" },
  { key: "transfers", label: "Transfers", icon: Plane, href: "/transfers" },
];

// Each tab asks the questions its booking needs, in that trade's words.
const COPY: Record<
  TabKey,
  { where: string; placeholder: string; from: string; to?: string; people?: string; times?: boolean }
> = {
  stays: { where: "Where to", placeholder: "Kigali, Musanze, a hotel name…", from: "Check in", to: "Check out", people: "Guests" },
  safaris: { where: "Destination", placeholder: "Volcanoes, Nyungwe, Akagera…", from: "Departure", to: "Return", people: "Travellers" },
  cars: { where: "Choose a car", placeholder: "All cars", from: "Pick-up date", to: "Drop-off date", times: true },
  transfers: { where: "Pick-up", placeholder: "Kigali Airport, a hotel, an address…", from: "Date", people: "Passengers", times: true },
};

function today(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Shared field shell so every input in the panel lines up on one baseline. */
function Field({
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
        "group flex min-w-0 flex-col justify-center gap-1 bg-white px-4 py-3 transition-colors lg:px-5 lg:py-3.5",
        "hover:bg-bone-50 focus-within:bg-bone-50",
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

// 16px on phones: anything smaller makes iOS zoom the whole page when a field takes focus.
const inputCls =
  "w-full bg-transparent text-base font-medium text-bone-900 outline-none placeholder:font-normal placeholder:text-bone-500 tnum lg:text-[0.9375rem]";

// Phones lay the fields out two-up; the wide ones take the full row.
const wide = "col-span-2 lg:col-span-1";

export function SearchPanel({
  className,
  hotelPlaces = [],
  safariPlaces = [],
  transferZones = [],
  cars = [],
}: {
  className?: string;
  /** Hotel towns and names, for the Stays suggestions. */
  hotelPlaces?: string[];
  /** Safari destinations and trip names, for the Safaris suggestions. */
  safariPlaces?: string[];
  /** Transfer zone prices: the transfers tab picks an airport and an area from them. */
  transferZones?: PublicZone[];
  /** The fleet, for the Car Hire dropdown. */
  cars?: { slug: string; name: string; category: string }[];
}) {
  const [tab, setTab] = React.useState<TabKey>("safaris");
  const [where, setWhere] = React.useState("");
  const [point, setPoint] = React.useState(PICKUP_POINTS[0]!.key);
  const [area, setArea] = React.useState("");
  const [car, setCar] = React.useState("");
  const [from, setFrom] = React.useState(today(7));
  const [to, setTo] = React.useState(today(10));
  const [fromTime, setFromTime] = React.useState("10:00");
  const [toTime, setToTime] = React.useState("10:00");
  const [people, setPeople] = React.useState(2);
  const router = useRouter();

  const active = tabs.find((t) => t.key === tab)!;
  const copy = COPY[tab];
  // The list under the first field: places that make sense for this kind of booking.
  const suggestions = tab === "stays" ? hotelPlaces : safariPlaces;
  const carCategories = [...new Set(cars.map((c) => c.category))];

  function switchTab(next: TabKey) {
    setTab(next);
    // A hotel name means nothing to the car search, and vice versa.
    setWhere("");
  }

  // Transfers: the airport or station, then an area from its zone list.
  const table = pickupPoint(point)?.table;
  const areaGroups = groupZones(transferZones.filter((z) => z.origin === table));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (tab === "transfers") {
      params.set("point", point);
      if (area) params.set("area", area);
      params.set("date", from);
      params.set("time", fromTime);
      params.set("passengers", String(people));
    } else if (tab === "cars") {
      params.set("from", from);
      params.set("to", to);
      params.set("fromTime", fromTime);
      params.set("toTime", toTime);
      // A chosen car goes straight to its page, dates filled in; otherwise the whole fleet.
      router.push(`${car ? `/cars/${car}` : "/cars"}?${params.toString()}`);
      return;
    } else {
      if (where) params.set("q", where);
      params.set("from", from);
      params.set("to", to);
      params.set("guests", String(people));
    }
    router.push(`${active.href}?${params.toString()}`);
  }

  const timeField = (label: string, value: string, set: (v: string) => void) => (
    <Field label={label} icon={Clock3}>
      <input type="time" className={inputCls} value={value} onChange={(e) => set(e.target.value)} />
    </Field>
  );

  return (
    <div
      className={cn(
        "w-full rounded-[var(--radius-panel)] bg-white p-2 shadow-[var(--shadow-float)] ring-1 ring-forest-950/5",
        className,
      )}
    >
      {/* One object: the tabs are a segmented control inside the panel, not folders on top of it. */}
      <div role="tablist" aria-label="What are you booking?" className="flex gap-1 overflow-x-auto p-1 no-bar">
        {tabs.map((t) => {
          const isActive = t.key === tab;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => switchTab(t.key)}
              className={cn(
                "relative flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors duration-300 sm:px-5",
                "[transition-timing-function:var(--ease-out-expo)]",
                isActive
                  ? "bg-forest-800 text-bone-50 shadow-[0_1px_2px_rgb(7_28_21/0.25)]"
                  : "text-bone-700 hover:bg-bone-100 hover:text-forest-900",
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={submit} className="mt-1">
        {/* Hairlines come from the 1px gap over a tinted ground, so they stay right at every column count. */}
        <div
          className={cn(
            "grid grid-cols-2 gap-px overflow-hidden rounded-[1.25rem] border border-bone-200 bg-bone-200",
            // Cars and transfers carry times, so their row has more columns.
            tab === "cars"
              ? "lg:grid-cols-[1.25fr_1fr_0.9fr_1fr_0.9fr_auto]"
              : tab === "transfers"
                ? "lg:grid-cols-[1.2fr_1.2fr_1fr_0.7fr_0.9fr_auto]"
                : "lg:grid-cols-[1.5fr_1fr_1fr_0.9fr_auto]",
          )}
        >
          {tab === "transfers" ? (
            <>
              <Field label="Pick-up" icon={MapPin} className={wide}>
                <select
                  className={cn(inputCls, "cursor-pointer")}
                  value={point}
                  onChange={(e) => {
                    const next = pickupPoint(e.target.value);
                    if (next?.table !== table) setArea("");
                    setPoint(e.target.value);
                  }}
                >
                  {PICKUP_POINTS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Destination" icon={MapPin} className={wide}>
                <TypeAhead
                  options={areaGroups.flatMap((g) =>
                    g.zones.flatMap((z) =>
                      z.areas
                        .filter((a) => a !== pickupPoint(point)?.short)
                        .map((a) => ({ value: a, label: a, hint: g.name })),
                    ),
                  )}
                  value={area}
                  onChange={setArea}
                  placeholder={pickupPoint(point)?.pointToPoint ? "Type a town, e.g. Rubavu" : "Type your area, e.g. Kiyovu"}
                  aria-label="Destination"
                  className={cn(inputCls, "cursor-text")}
                />
              </Field>
            </>
          ) : tab === "cars" ? (
            <Field label={copy.where} icon={Car} className={wide}>
              <select className={cn(inputCls, "cursor-pointer")} value={car} onChange={(e) => setCar(e.target.value)}>
                <option value="">{copy.placeholder}</option>
                {carCategories.map((category) => (
                  <optgroup key={category} label={category}>
                    {cars
                      .filter((c) => c.category === category)
                      .map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </Field>
          ) : (
            <Field label={copy.where} icon={MapPin} className={wide}>
              <input
                className={inputCls}
                placeholder={copy.placeholder}
                list={`sw-places-${tab}`}
                value={where}
                onChange={(e) => setWhere(e.target.value)}
              />
              <datalist id={`sw-places-${tab}`}>
                {suggestions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
          )}

          <Field label={copy.from} icon={CalendarDays}>
            <input type="date" className={inputCls} value={from} min={today()} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          {copy.times ? timeField(tab === "cars" ? "Pick-up time" : "Time", fromTime, setFromTime) : null}

          {copy.to ? (
            <Field label={copy.to} icon={CalendarDays}>
              <input type="date" className={inputCls} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </Field>
          ) : null}
          {tab === "cars" ? timeField("Drop-off time", toTime, setToTime) : null}

          {copy.people ? (
            <Field label={copy.people} icon={Users} className={wide}>
              <select
                className={cn(inputCls, "cursor-pointer")}
                value={people}
                onChange={(e) => setPeople(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} {tab === "transfers" ? (n === 1 ? "passenger" : "passengers") : n === 1 ? "person" : "people"}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <div className={cn("flex items-center bg-white p-2", wide)}>
            <Button type="submit" variant="accent" size="lg" className="h-13 w-full gap-2.5 px-7 font-semibold lg:h-14">
              <Search className="size-[1.125rem]" strokeWidth={2.25} />
              Search
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
