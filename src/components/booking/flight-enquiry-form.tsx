"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowLeftRight, ArrowRight, CalendarDays, Check, History, Mail, MessageCircle, Pencil, Phone, Plane, PlaneLanding,
  PlaneTakeoff, Plus, ReceiptText, Trash2, UsersRound,
} from "lucide-react";
import { submitFlightEnquiry } from "@/app/actions/flight-enquiry";
import {
  airportCodeOf, ENQUIRY_CONSENT_TEXT, flightLegSchema, MAX_FLIGHT_LEGS, type FlightEnquiryState, type FlightLeg,
} from "@/lib/flight-enquiry-schema";
import { PICK_DESTINATION_EVENT, type DestinationPick } from "@/lib/flight-destinations";
import { airlines, isAirlineCode } from "@/lib/flight-airlines";
import { cn } from "@/lib/utils";
import { AirlineLogo } from "./flight-marks";
import { AirportFlag, AirportInput } from "./flight-airport-input";
import { Calendar, DropField, fieldDate, itineraryDate, latestDate, nightsBetween, Stepper } from "./flight-search-controls";
import s from "./flight-planner.module.css";

type LegDraft = Omit<FlightLeg, "origin"> & { origin?: string; id: number };
const cabins = { ECONOMY: "Economy", PREMIUM_ECONOMY: "Premium economy", BUSINESS: "Business", FIRST: "First" };
const tripTypes = [["RETURN", "Round trip"], ["ONE_WAY", "One way"], ["MULTI_CITY", "Multi-city"]] as const;
const MAX_PARTY = 20;
const initialRoute = { origin: "Kigali (KGL)", destination: "", departureDate: "", returnDate: "", adults: "1", children: "0", infants: "0", cabin: "ECONOMY" };
const initial: FlightEnquiryState = { status: "idle" };

/* Recent searches: kept in this browser only, as a convenience. */
const RECENT_KEY = "thrill:recent-flight-searches";
const RECENT_EVENT = "thrill:recent-flight-searches";
type Recent = typeof initialRoute & { tripType: "RETURN" | "ONE_WAY" };
const readRecent = () => {
  try { return localStorage.getItem(RECENT_KEY) ?? ""; } catch { return ""; }
};
const subscribeRecent = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener(RECENT_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(RECENT_EVENT, callback);
  };
};
function writeRecent(list: Recent[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(RECENT_EVENT));
  } catch {}
}

/** "Kigali (KGL)" → KGL and Kigali; free text keeps what was typed. */
function place(value: string) {
  const code = airportCodeOf(value);
  const city = value.replace(/\s*\([a-z]{3}\)\s*$/i, "").trim();
  return { code: code ?? (city.slice(0, 3).toUpperCase() || "—"), city: city || value };
}

function Endpoint({ value, end = false }: { value: string; end?: boolean }) {
  const { code, city } = place(value);
  return (
    <span className={cn(s.endpoint, end && s.endpointEnd)}>
      <b>{code}</b>
      <small><AirportFlag value={value} /> {city}</small>
    </span>
  );
}

function Path({ label }: { label?: string }) {
  return (
    <span className={s.path} aria-hidden>
      <span className={s.pathLine}><i /><Plane size={16} /><i /></span>
      {label ? <small>{label}</small> : null}
    </span>
  );
}

/**
 * Guide prices for the departure calendar: the cheapest one-way fare seen per
 * day between two airports (/api/fares/calendar). Empty until both ends are
 * airports, when fares are off, or when nothing is known for the route.
 */
function useFareCalendar(origin: string, destination: string) {
  const from = airportCodeOf(origin);
  const to = airportCodeOf(destination);
  const key = from && to && from !== to ? `${from}-${to}` : "";
  const [loaded, setLoaded] = useState<{ key: string; prices: Record<string, string> }>({ key: "", prices: {} });
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    fetch(`/api/fares/calendar?from=${from}&to=${to}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { currency: string | null; days: Record<string, { price: number }> } | null) => {
        if (!body?.currency) return setLoaded({ key, prices: {} });
        const money = new Intl.NumberFormat("en-US", { style: "currency", currency: body.currency, maximumFractionDigits: 0 });
        setLoaded({ key, prices: Object.fromEntries(Object.entries(body.days).map(([day, fare]) => [day, money.format(Math.ceil(fare.price))])) });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [key, from, to]);
  return key && loaded.key === key ? loaded.prices : undefined;
}

export function FlightEnquiryForm({ submissionKey, today }: { submissionKey: string; today: string }) {
  const [state, action, pending] = useActionState(submitFlightEnquiry, initial);
  const [route, setRoute] = useState(initialRoute);
  const [tripType, setTripType] = useState<(typeof tripTypes)[number][0]>("RETURN");
  const multi = tripType === "MULTI_CITY";
  const [nonstop, setNonstop] = useState(false);
  const [flexible, setFlexible] = useState(false);
  const [preferredAirline, setPreferredAirline] = useState<keyof typeof airlines | "">("");
  const [drafts, setDrafts] = useState<LegDraft[]>([{ id: 1, destination: "", departureDate: "" }]);
  const nextLegId = useRef(2);
  const [panel, setPanel] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const [issue, setIssue] = useState("");
  const [swaps, setSwaps] = useState(0);
  const [channel, setChannel] = useState("WHATSAPP");
  const [contact, setContact] = useState({ name: "", email: "", phone: "", baggage: "", notes: "", consent: false });
  const firstAirport = useRef<HTMLInputElement>(null);
  const searchTop = useRef<HTMLFormElement>(null);
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const successTitle = useRef<HTMLHeadingElement>(null);

  const additional = multi ? drafts.map((leg, i) => ({
    ...leg, origin: leg.origin ?? (i === 0 ? route.destination : drafts[i - 1].destination),
  })) : [];
  const legs: FlightLeg[] = [route, ...additional];
  const count = { adults: Number(route.adults), children: Number(route.children), infants: Number(route.infants) };
  const party = count.adults + count.children + count.infants;
  const room = MAX_PARTY - party;
  const cabin = cabins[route.cabin as keyof typeof cabins];
  const travellers = `${party} ${party === 1 ? "traveller" : "travellers"}`;
  const tripLabel = tripTypes.find(([value]) => value === tripType)![1];
  const max = latestDate(today);
  const nights = nightsBetween(route.departureDate, route.returnDate);
  const calendar = useFareCalendar(route.origin, route.destination);
  const recentRaw = useSyncExternalStore(subscribeRecent, readRecent, () => "");
  const recent = useMemo(() => {
    try {
      const list = JSON.parse(recentRaw || "[]");
      return Array.isArray(list) ? (list as Recent[]).filter((r) => r?.origin && r?.destination && r.departureDate >= today).slice(0, 3) : [];
    } catch { return []; }
  }, [recentRaw, today]);
  function remember() {
    if (multi) return;
    const entry: Recent = { ...route, returnDate: tripType === "RETURN" ? route.returnDate : "", tripType };
    const same = (r: Recent) => r.origin === entry.origin && r.destination === entry.destination && r.departureDate === entry.departureDate && r.returnDate === entry.returnDate;
    writeRecent([entry, ...recent.filter((r) => !same(r))].slice(0, 3));
  }
  function restore({ tripType: kind, ...saved }: Recent) {
    setTripType(kind);
    setRoute({ ...initialRoute, ...saved });
    setIssue("");
    setPanel(null);
  }

  const set = (key: keyof typeof route, value: string) => setRoute(old => ({ ...old, [key]: value }));
  const toggle = (id: string) => (open: boolean) => setPanel(open ? id : null);
  function changeLeg(id: number, key: keyof FlightLeg, value: string) {
    setDrafts(current => current.map(leg => leg.id === id ? { ...leg, [key]: value } : leg));
  }

  useEffect(() => {
    if (state.status === "success") successTitle.current?.focus();
    else if (review) reviewTitle.current?.focus();
  }, [review, state.status]);

  // The departures board below fills the destination and opens the calendar.
  useEffect(() => {
    // A fare row also carries its date: the fare is one way, so the search becomes one way on that day.
    function pick(event: Event) {
      const detail = (event as CustomEvent<DestinationPick>).detail;
      const { destination, departureDate } = typeof detail === "string" ? { destination: detail, departureDate: undefined } : detail;
      setReview(false);
      setIssue("");
      if (departureDate) {
        setTripType("ONE_WAY");
        setRoute(old => ({ ...old, origin: initialRoute.origin, destination, departureDate, returnDate: "" }));
        setPanel("party");
      } else {
        setRoute(old => ({ ...old, origin: initialRoute.origin, destination }));
        setPanel("dep");
      }
    }
    window.addEventListener(PICK_DESTINATION_EVENT, pick);
    return () => window.removeEventListener(PICK_DESTINATION_EVENT, pick);
  }, []);

  function editRoute() {
    setReview(false);
    requestAnimationFrame(() => {
      searchTop.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      firstAirport.current?.focus({ preventScroll: true });
    });
  }

  function validate() {
    for (const [i, leg] of legs.entries()) {
      const name = multi ? `Flight ${i + 1} · ` : "";
      if (!leg.departureDate) {
        setPanel(i === 0 ? "dep" : `leg-${additional[i - 1].id}`);
        return `${name}Choose a departure date.`;
      }
      const checked = flightLegSchema.safeParse(leg);
      if (!checked.success) return `${name}${checked.error.issues[0].message}`;
      if (i > 0 && leg.departureDate < legs[i - 1].departureDate) return "Enter the flights in departure date order.";
    }
    if (tripType === "RETURN" && !route.returnDate) {
      setPanel("ret");
      return "Choose your return date.";
    }
    if (tripType === "RETURN" && route.returnDate < route.departureDate) return "Your return date is before your departure.";
    if (party > MAX_PARTY || count.infants > count.adults) return "Choose up to 20 travellers, with at least one adult per infant.";
    return "";
  }

  /* --------------------------------------------------------- confirmation */

  if (state.status === "success") return (
    <section className={s.issued} role="status">
      <div className={s.issuedMain}>
        <span className={s.issuedBadge}><Check size={16} strokeWidth={3} aria-hidden /> Request received</span>
        <h2 ref={successTitle} tabIndex={-1}>Your route is with our desk</h2>
        <p className={s.issuedLede}>
          Our Kigali desk will check fares for your dates and reply by {channel === "EMAIL" ? "email" : channel === "PHONE" ? "phone" : "WhatsApp"}. Every fare comes in writing, and nothing is booked or charged until you accept one.
        </p>
        <div className={s.issuedLegs}>
          {legs.map((leg, i) => (
            <div key={i} className={s.passLeg}>
              <Endpoint value={leg.origin} />
              <Path label={itineraryDate(leg.departureDate)} />
              <Endpoint value={leg.destination} end />
            </div>
          ))}
          {tripType === "RETURN" ? (
            <div className={s.passLeg}>
              <Endpoint value={route.destination} />
              <Path label={itineraryDate(route.returnDate)} />
              <Endpoint value={route.origin} end />
            </div>
          ) : null}
        </div>
        <p className={s.issuedMeta}>
          {tripLabel} · {travellers} · {cabin}{nonstop && " · Nonstop only"}{flexible && " · Flexible dates"}
          {preferredAirline ? ` · Prefers ${airlines[preferredAirline]}` : ""}
        </p>
      </div>
      <div className={s.issuedStub}>
        <p>Enquiry reference</p>
        <strong>{state.reference}</strong>
        <span className={s.barcode} aria-hidden />
        <Link href="/transfers" className={s.issuedLink}>Add an airport pickup <ArrowRight size={15} aria-hidden /></Link>
      </div>
    </section>
  );

  /* ---------------------------------------------------------------- search */

  if (!review) return (
    <form ref={searchTop} className={s.search} noValidate onSubmit={event => {
      event.preventDefault();
      const problem = validate();
      setIssue(problem);
      if (problem) return;
      setPanel(null);
      remember();
      setReview(true);
    }}>
      <div className={s.topline}>
        <fieldset className={s.tripTypes}>
          <legend className="sr-only">Trip type</legend>
          {tripTypes.map(([value, label]) => <label key={value}>
            <input type="radio" checked={tripType === value} onChange={() => { setTripType(value); setIssue(""); }} name="tripType" value={value} />
            <span>{label}</span>
          </label>)}
        </fieldset>
        <div className={s.toggles}>
          <label className={s.toggle}><input type="checkbox" checked={nonstop} onChange={e => setNonstop(e.target.checked)} /><span>Nonstop only</span></label>
          <label className={s.toggle}><input type="checkbox" checked={flexible} onChange={e => setFlexible(e.target.checked)} /><span>Flexible dates</span></label>
        </div>
      </div>

      <div className={multi ? s.multiGrid : s.grid}>
        {multi && <p className={s.legHeading}><span>1</span>Flight 1</p>}
        <div className={s.routeFields}>
          <label className={s.cell}>
            <span className={s.cellLabel}><PlaneTakeoff />From</span>
            <AirportInput inputRef={firstAirport} label="From city or airport" value={route.origin} onChange={value => set("origin", value)} />
          </label>
          <button className={s.swap} type="button" aria-label="Swap airports" onClick={() => {
            setSwaps(n => n + 1);
            setRoute(old => ({ ...old, origin: old.destination, destination: old.origin }));
          }}>
            <ArrowLeftRight size={15} style={{ transform: `rotate(${swaps * 180}deg)` }} />
          </button>
          <label className={s.cell}>
            <span className={s.cellLabel}><PlaneLanding />To</span>
            <AirportInput label="To city or airport" value={route.destination} placeholder="Where to?" suggestPopular onChange={value => set("destination", value)} />
          </label>
        </div>

        <div className={s.dates}>
          <DropField id="flight-departure" icon={<CalendarDays />} label="Departure" title="Choose your departure date"
            value={fieldDate(route.departureDate)} placeholder="Add date" open={panel === "dep"} onOpenChange={toggle("dep")}>
            <Calendar value={route.departureDate} min={today} max={max}
              prices={calendar}
              priceNote="Lowest one-way economy fare for one adult seen in recent searches, as a guide. The desk checks and confirms your fare in writing."
              rangeEnd={tripType === "RETURN" && route.returnDate ? route.returnDate : undefined}
              onPick={day => {
                setRoute(old => ({ ...old, departureDate: day, returnDate: old.returnDate && old.returnDate < day ? "" : old.returnDate }));
                setIssue("");
                setPanel(tripType === "RETURN" ? "ret" : null);
              }} />
          </DropField>
          {tripType === "RETURN" && (
            <DropField id="flight-return" icon={<CalendarDays />} label="Return" title="Choose your return date"
              value={fieldDate(route.returnDate)} placeholder="Add date"
              hint={nights > 0 ? `${nights} ${nights === 1 ? "night" : "nights"} away` : undefined}
              open={panel === "ret"} onOpenChange={toggle("ret")}>
              <Calendar value={route.returnDate} min={route.departureDate || today} max={max}
                rangeStart={route.departureDate || undefined}
                onPick={day => { set("returnDate", day); setIssue(""); setPanel(null); }} />
            </DropField>
          )}
        </div>

        {additional.map((leg, i) => <fieldset key={leg.id} className={s.leg}>
          <legend className={s.legHeading}><span>{i + 2}</span>Flight {i + 2}</legend>
          <div className={s.legFields}>
            <div className={s.routeFields}>
              {(["origin", "destination"] as const).map(key => <label key={key} className={s.cell}>
                <span className={s.cellLabel}>{key === "origin" ? <PlaneTakeoff /> : <PlaneLanding />}{key === "origin" ? "From" : "To"}</span>
                <AirportInput label={`Flight ${i + 2} ${key === "origin" ? "from" : "to"}`} value={leg[key]}
                  placeholder={key === "origin" ? "City or airport" : "Where to?"} onChange={value => changeLeg(leg.id, key, value)} />
              </label>)}
            </div>
            <DropField id={`flight-leg-${leg.id}`} icon={<CalendarDays />} label="Departure" title={`Choose the date of flight ${i + 2}`}
              value={fieldDate(leg.departureDate)} placeholder="Add date"
              open={panel === `leg-${leg.id}`} onOpenChange={toggle(`leg-${leg.id}`)}>
              <Calendar value={leg.departureDate} min={legs[i].departureDate || today} max={max}
                onPick={day => { changeLeg(leg.id, "departureDate", day); setIssue(""); setPanel(null); }} />
            </DropField>
            {additional.length > 1 && <button type="button" className={s.removeLeg} aria-label={`Remove flight ${i + 2}`} onClick={() => {
              setDrafts(drafts.filter(item => item.id !== leg.id).map(item =>
                item.id === additional[i + 1]?.id ? { ...item, origin: additional[i + 1].origin } : item
              ));
            }}><Trash2 size={16} /></button>}
          </div>
        </fieldset>)}

        {multi && legs.length < MAX_FLIGHT_LEGS && <button type="button" className={s.addLeg} onClick={() => {
          setDrafts(current => [...current, { id: nextLegId.current++, destination: "", departureDate: "" }]);
        }}><Plus size={16} /> Add another flight</button>}

        <DropField id="flight-party" icon={<UsersRound />} label="Travellers & cabin" title="Travellers and cabin" align="end"
          className={s.partyField} value={`${travellers}, ${cabin}`} placeholder="" open={panel === "party"} onOpenChange={toggle("party")}>
          <div className={s.party}>
            <Stepper label="Adults" note="12 years and over" value={count.adults} min={Math.max(1, count.infants)}
              max={count.adults + room} onChange={n => set("adults", String(n))} />
            <Stepper label="Children" note="2 to 11 years" value={count.children} min={0}
              max={count.children + room} onChange={n => set("children", String(n))} />
            <Stepper label="Infants" note="Under 2, on an adult's lap" value={count.infants} min={0}
              max={Math.min(count.adults, count.infants + room)} onChange={n => set("infants", String(n))} />
            <fieldset className={s.cabins}>
              <legend>Cabin</legend>
              {Object.entries(cabins).map(([value, name]) => <label key={value}>
                <input type="radio" name="cabinChoice" value={value} checked={route.cabin === value} onChange={() => set("cabin", value)} />
                <span>{name}</span>
              </label>)}
            </fieldset>
            <p className={s.partyNote}>Up to {MAX_PARTY} travellers per request. Larger party? <Link href="/groups">Plan it as a group</Link>.</p>
            <button type="button" className={s.done} onClick={() => setPanel(null)}>Done</button>
          </div>
        </DropField>

        <button type="submit" className={s.go}>
          <span>Continue</span>
          <ArrowRight size={18} aria-hidden />
        </button>
      </div>
      {issue && <p role="alert" className={s.issue}>{issue}</p>}
      {recent.length > 0 && !multi ? (
        <div className={s.recent}>
          <span className={s.recentLabel}><History size={14} aria-hidden /> Recent</span>
          <ul>
            {recent.map((entry) => (
              <li key={`${entry.origin}-${entry.destination}-${entry.departureDate}-${entry.returnDate}`}>
                <button type="button" onClick={() => restore(entry)}>
                  <b>{place(entry.origin).city} → {place(entry.destination).city}</b>
                  <small>{fieldDate(entry.departureDate)}{entry.returnDate ? ` – ${fieldDate(entry.returnDate)}` : ""}</small>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={s.recentClear} onClick={() => writeRecent([])}>Clear</button>
        </div>
      ) : null}
    </form>
  );

  /* ---------------------------------------------------------------- review */

  return (
    <div className={s.reviewGrid}>
      <section className={s.pass} aria-labelledby="flight-review-title">
        <div className={s.passMain}>
          <div className={s.passHead}>
            <h2 id="flight-review-title" ref={reviewTitle} tabIndex={-1}>Your itinerary</h2>
            <span>{tripLabel}</span>
          </div>
          {legs.map((leg, i) => (
            <div key={i} className={s.passLeg}>
              <Endpoint value={leg.origin} />
              <Path label={`${multi ? `Flight ${i + 1} · ` : ""}${itineraryDate(leg.departureDate)}`} />
              <Endpoint value={leg.destination} end />
            </div>
          ))}
          {tripType === "RETURN" ? (
            <div className={s.passLeg}>
              <Endpoint value={route.destination} />
              <Path label={`Return · ${itineraryDate(route.returnDate)}`} />
              <Endpoint value={route.origin} end />
            </div>
          ) : null}
        </div>
        <div className={s.passStub}>
          <dl>
            <div><dt>Travellers</dt><dd>{[
              `${count.adults} ${count.adults === 1 ? "adult" : "adults"}`,
              count.children ? `${count.children} ${count.children === 1 ? "child" : "children"}` : "",
              count.infants ? `${count.infants} ${count.infants === 1 ? "infant" : "infants"}` : "",
            ].filter(Boolean).join(", ")}</dd></div>
            <div><dt>Cabin</dt><dd>{cabin}</dd></div>
            {nonstop || flexible ? <div><dt>Options</dt><dd>{[nonstop && "Nonstop only", flexible && "Flexible dates"].filter(Boolean).join(", ")}</dd></div> : null}
          </dl>
          <button type="button" onClick={editRoute} className={s.editJourney}><Pencil size={14} aria-hidden /> Edit journey</button>
        </div>
      </section>

      <form action={action} onReset={event => event.preventDefault()} className={s.contact}>
        <input type="hidden" name="submissionKey" value={submissionKey} />
        {Object.entries({ ...route, tripType, returnDate: tripType === "RETURN" ? route.returnDate : "" }).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
        {flexible && <input type="hidden" name="flexible" value="on" />}
        {nonstop && <input type="hidden" name="nonstopOnly" value="on" />}
        {preferredAirline && <input type="hidden" name="preferredAirline" value={preferredAirline} />}
        {additional.map(leg => <div hidden key={leg.id}>
          <input type="hidden" name="legOrigin" value={leg.origin} />
          <input type="hidden" name="legDestination" value={leg.destination} />
          <input type="hidden" name="legDate" value={leg.departureDate} />
        </div>)}
        <label hidden>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>

        <div>
          <p className={s.stepLabel}>Last step</p>
          <h2 className={s.contactTitle}>Where should we send your fares?</h2>
        </div>
        <fieldset className={s.channels}>
          <legend>Reply by</legend>
          {([["WHATSAPP", "WhatsApp", MessageCircle], ["EMAIL", "Email", Mail], ["PHONE", "Phone call", Phone]] as const).map(([value, label, Icon]) => (
            <label key={value}>
              <input type="radio" name="replyChannel" value={value} checked={channel === value} onChange={() => setChannel(value)} />
              <span><Icon size={16} aria-hidden />{label}</span>
            </label>
          ))}
        </fieldset>
        <div className={s.contactFields}>
          <label>Full name<input name="name" autoComplete="name" required minLength={2} maxLength={120} value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })} /></label>
          <label>{channel === "WHATSAPP" ? "WhatsApp number" : "Phone number"}<input type="tel" name="phone" autoComplete="tel" required maxLength={40} placeholder="+250 7…" value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} /></label>
          <label className={s.wide}>Email{channel !== "EMAIL" && <small> optional</small>}<input name="email" type="email" required={channel === "EMAIL"} autoComplete="email" maxLength={254} value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} /></label>
        </div>

        <details className={s.more}>
          <summary><span>Preferred airline</span><em>{preferredAirline ? airlines[preferredAirline] : "Any airline"}</em></summary>
          <fieldset className={s.airlines}>
            <legend className="sr-only">Preferred airline</legend>
            {["", ...Object.keys(airlines)].map(code => {
              const carrier = isAirlineCode(code) ? code : "";
              return <label key={code || "any"}>
                <input type="radio" name="airlineChoice" checked={preferredAirline === carrier} value={carrier}
                  onChange={() => setPreferredAirline(carrier)} />
                <span>{carrier ? <AirlineLogo code={carrier} /> : "Any airline"}</span>
              </label>;
            })}
          </fieldset>
        </details>
        <details className={s.more}>
          <summary><span>Baggage and special requests</span><em>{contact.baggage || contact.notes ? "Added" : "Optional"}</em></summary>
          <div className={s.contactFields}>
            <label>Baggage<input name="baggage" maxLength={500} placeholder="e.g. two checked bags each" value={contact.baggage} onChange={e => setContact({ ...contact, baggage: e.target.value })} /></label>
            <label>Notes for the desk<textarea name="notes" maxLength={2000} rows={2} placeholder="Seats, assistance, meals, an airport pickup…" value={contact.notes} onChange={e => setContact({ ...contact, notes: e.target.value })} /></label>
          </div>
        </details>

        <label className={s.consent}><input type="checkbox" name="consent" required checked={contact.consent} onChange={e => setContact({ ...contact, consent: e.target.checked })} /><span>{ENQUIRY_CONSENT_TEXT} <Link href="/legal/privacy" target="_blank" rel="noopener noreferrer">Privacy notice</Link></span></label>
        {state.status === "error" && <div role="alert" className={s.serverError}>{state.fieldErrors ? Object.values(state.fieldErrors).join(". ") : state.message}</div>}
        <button type="submit" className={s.go} disabled={pending}>
          <span>{pending ? "Sending…" : "Request my fares"}</span>
          <ArrowRight size={18} aria-hidden />
        </button>
      </form>

      <aside className={s.next} aria-label="What happens next">
        <p className={s.stepLabel}>What happens next</p>
        <ol>
          <li><span><Plane size={16} aria-hidden /></span><div><b>We check the fares</b><p>Our Kigali desk compares airlines for your dates and cabin.</p></div></li>
          <li><span><ReceiptText size={16} aria-hidden /></span><div><b>You get options in writing</b><p>Each fare shows what it includes and how long the price holds.</p></div></li>
          <li><span><Check size={16} aria-hidden /></span><div><b>You decide</b><p>Nothing is booked or charged until you accept a fare.</p></div></li>
        </ol>
      </aside>
    </div>
  );
}
