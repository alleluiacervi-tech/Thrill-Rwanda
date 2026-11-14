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
        "group flex min-w-0 flex-col justify-center gap-1 px-5 py-3.5 transition-colors",
        "hover:bg-bone-100/70 focus-within:bg-bone-100/70",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.16em] text-bone-500">
        <Icon className="size-3 text-clay-600" />
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full bg-transparent text-sm font-medium text-bone-900 outline-none placeholder:text-bone-400 tnum";

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
    <div className={cn("w-full", className)}>
      {/* Tabs sit on top of the panel, sharing its rounded top edge */}
      <div role="tablist" aria-label="What are you booking?" className="flex gap-1 overflow-x-auto no-bar">
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
                "relative flex items-center gap-2 whitespace-nowrap rounded-t-xl px-5 py-3 text-sm font-medium transition-all duration-300",
                "[transition-timing-function:var(--ease-out-expo)]",
                isActive
                  ? "bg-bone-50 text-forest-800"
                  : "bg-forest-950/35 text-bone-100/75 backdrop-blur hover:bg-forest-950/55 hover:text-bone-50",
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={submit} className="rounded-b-2xl rounded-tr-2xl bg-bone-50 p-2 shadow-[var(--shadow-float)]">
        <div
          className={cn(
            "grid grid-cols-1 divide-y divide-bone-200 sm:grid-cols-2 sm:divide-y-0 lg:divide-x",
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
              <Field label="Pick-up" icon={MapPin}>
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
              <Field label="Destination" icon={MapPin}>
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
            <Field label={copy.where} icon={Car}>
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
            <Field label={copy.where} icon={MapPin}>
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
            <Field label={copy.people} icon={Users}>
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

          <div className="flex items-center p-1.5">
            <Button type="submit" variant="accent" size="lg" className="w-full lg:aspect-square lg:w-auto lg:px-0">
              <Search className="size-5" />
              <span className="lg:sr-only">Search</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
