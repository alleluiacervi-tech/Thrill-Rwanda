"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, ArrowRight, CalendarDays, Check, ChevronDown, Plane, PlaneLanding, PlaneTakeoff, Ticket, UsersRound } from "lucide-react";
import { submitFlightEnquiry } from "@/app/actions/flight-enquiry";
import { ENQUIRY_CONSENT_TEXT, flightLegSchema, MAX_FLIGHT_LEGS, routeAirports, type FlightEnquiryState, type FlightLeg } from "@/lib/flight-enquiry-schema";
import { Button } from "@/components/ui/button";
import s from "./flight-planner.module.css";

const destinations = routeAirports.slice(1);
type LegDraft = Omit<FlightLeg, "origin"> & { origin?: string; id: number };
const cabins = { ECONOMY: "Economy", PREMIUM_ECONOMY: "Premium economy", BUSINESS: "Business", FIRST: "First" };
const counts = ["adults", "children", "infants"] as const;
const initialRoute = { origin: "Kigali (KGL)", destination: "", departureDate: "", returnDate: "", adults: "1", children: "0", infants: "0", cabin: "ECONOMY" };
const initial: FlightEnquiryState = { status: "idle" };
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value + "T12:00:00Z"));

function Airway() {
  return <span className={s.airway} aria-hidden><i /><Plane size={17} /><i /></span>;
}

export function FlightEnquiryForm({ submissionKey, today }: { submissionKey: string; today: string }) {
  const [state, action, pending] = useActionState(submitFlightEnquiry, initial);
  const [route, setRoute] = useState(initialRoute);
  const [tripType, setTripType] = useState("RETURN");
  const multi = tripType === "MULTI_CITY";
  const [nonstop, setNonstop] = useState(false);
  const [drafts, setDrafts] = useState<LegDraft[]>([{ id: 1, destination: "", departureDate: "" }]);
  const nextLegId = useRef(2);
  const additional = multi ? drafts.map((leg, i) => ({
    ...leg, origin: leg.origin ?? (i === 0 ? route.destination : drafts[i - 1].destination),
  })) : [];
  const legs: FlightLeg[] = [route, ...additional];
  function changeLeg(id: number, key: keyof FlightLeg, value: string) {
    setDrafts(current => current.map(leg => leg.id === id ? { ...leg, [key]: value } : leg));
  }
  const [flexible, setFlexible] = useState(false);
  const [review, setReview] = useState(false);
  const [issue, setIssue] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [channel, setChannel] = useState("WHATSAPP");
  const departure = useRef<HTMLInputElement>(null);
  const firstAirport = useRef<HTMLInputElement>(null);
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const successTitle = useRef<HTMLHeadingElement>(null);
  const [contact, setContact] = useState({ name: "", email: "", phone: "", baggage: "", notes: "", consent: false });
  const set = (key: keyof typeof route, value: string) => setRoute(old => ({ ...old, [key]: value }));
  const party = counts.reduce((sum, key) => sum + Number(route[key]), 0);
  const cabin = cabins[route.cabin as keyof typeof cabins];
  const travellers = `${party} ${party === 1 ? "traveller" : "travellers"}`;
  useEffect(() => {
    if (state.status === "success") successTitle.current?.focus();
    else if (review) reviewTitle.current?.focus();
  }, [review, state.status]);

  function editRoute() {
    setReview(false);
    requestAnimationFrame(() => firstAirport.current?.focus());
  }
  if (state.status === "success") return (
    <section className={s.panel} role="status">
      <Check className="mb-2 text-forest-700" aria-hidden />
      <h2 ref={successTitle} tabIndex={-1} className="text-3xl">Flight request received</h2>
      {legs.map((leg, i) => <p key={i} className="mt-2">{leg.origin} → {leg.destination} · {dateLabel(leg.departureDate)}</p>)}
      {tripType === "RETURN" && <p>Return · {dateLabel(route.returnDate)}</p>}
      {nonstop && <p className="mt-2">Nonstop flights requested</p>}
      <p className="mt-3">Our desk will check availability and send your written quote.</p>
      <p className="mt-4 break-all text-sm">Enquiry reference <strong>{state.reference}</strong></p>
    </section>
  );

  if (!review) return <>
    <form className={s.panel} onSubmit={event => {
      event.preventDefault();
      for (const [i, leg] of legs.entries()) {
        const checked = flightLegSchema.safeParse(leg);
        if (!checked.success) {
          setIssue(`Flight ${i + 1} · ${checked.error.issues[0].message}`); return;
        }
        if (i > 0 && leg.departureDate < legs[i - 1].departureDate) {
          setIssue("Enter the flights in departure date order."); return;
        }
      }
      if (party > 20 || Number(route.infants) > Number(route.adults)) {
        setExpanded(true); setIssue("Choose up to 20 travellers, with at least one adult per infant."); return;
      }
      setIssue(""); setExpanded(false); setReview(true);
    }}>
      <div className={s.topline}>
        <fieldset className={s.tripTypes}>
          <legend className="sr-only">Trip type</legend>
          {[["RETURN", "Round trip"], ["ONE_WAY", "One way"], ["MULTI_CITY", "Multi-city"]].map(([value, label]) => <label key={value}>
            <input type="radio" checked={tripType === value} onChange={() => setTripType(value)} name="tripType" value={value} />
            <span>{label}</span>
          </label>)}
        </fieldset>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={nonstop} onChange={e => setNonstop(e.target.checked)} />Nonstop only</label>
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={flexible} onChange={e => setFlexible(e.target.checked)} />Flexible dates</label>
        </div>
      </div>
      <div className={multi ? s.multiControls : s.controls}>
        {multi && <p className={s.legHeading}>Flight 1</p>}
        <div className={s.routeFields}>
          <label className={s.cell}><span><PlaneTakeoff />From</span>
            <input ref={firstAirport} aria-label="From city or airport" required maxLength={120} list="flight-airports" value={route.origin} placeholder="City or airport" onChange={e => set("origin", e.target.value)} />
          </label>
          <button className={s.swap} type="button" aria-label="Swap airports" onClick={() => setRoute(old => ({ ...old, origin: old.destination, destination: old.origin }))}><ArrowLeftRight size={15} /></button>
          <label className={s.cell}><span><PlaneLanding />To</span>
            <input aria-label="To city or airport" required maxLength={120} list="flight-airports" value={route.destination} placeholder="City or airport" onChange={e => set("destination", e.target.value)} />
          </label>
          <datalist id="flight-airports">{routeAirports.map(a => <option key={a.code} value={`${a.city} (${a.code})`} />)}</datalist>
        </div>
        <div className={s.dates}>
          <label className={s.cell}><span><CalendarDays />Departure</span><input ref={departure} type="date" required min={today} value={route.departureDate} onChange={e => set("departureDate", e.target.value)} /></label>
          {tripType === "RETURN" && <label className={s.cell}><span><CalendarDays />Return</span><input type="date" required min={route.departureDate || today} value={route.returnDate} onChange={e => set("returnDate", e.target.value)} /></label>}
        </div>
        {additional.map((leg, i) => <fieldset key={leg.id} className={s.leg}>
          <legend className={s.legHeading}>Flight {i + 2}</legend>
          <div className={s.legFields}>
            <div className={s.routeFields}>
              {(["origin", "destination"] as const).map(key => <label key={key} className={s.cell}>
                <span>{key === "origin" ? <PlaneTakeoff /> : <PlaneLanding />}{key === "origin" ? "From" : "To"}</span>
                <input required list="flight-airports" maxLength={120} placeholder="City or airport" value={leg[key]} onChange={e => changeLeg(leg.id, key, e.target.value)} />
              </label>)}
            </div>
            <label className={s.cell}><span><CalendarDays />Departure</span>
              <input required type="date" min={legs[i].departureDate || today} value={leg.departureDate} onChange={e => changeLeg(leg.id, "departureDate", e.target.value)} />
            </label>
          </div>
          {additional.length > 1 && <button type="button" className="mt-2 text-sm underline" aria-label={`Remove flight ${i + 2}`} onClick={() => {
            setDrafts(drafts.filter(item => item.id !== leg.id).map(item =>
              item.id === additional[i + 1]?.id ? { ...item, origin: additional[i + 1].origin } : item
            ));
          }}>Remove flight</button>}
        </fieldset>)}
        {multi && legs.length < MAX_FLIGHT_LEGS && <button type="button" className={s.addLeg} onClick={() => {
          const leg = { id: nextLegId.current++, destination: "", departureDate: "" };
          setDrafts(current => [...current, leg]);
        }}>+ Add flight</button>}
        <button type="button" className={s.cell} aria-expanded={expanded} aria-controls="flight-party" onClick={() => setExpanded(!expanded)}><span><UsersRound />Travellers &amp; cabin</span><strong>{party} · {cabin} <ChevronDown size={14} /></strong></button>
        <Button type="submit" variant="accent" className="h-full min-h-12 rounded-xl">Continue <ArrowRight size={17} /></Button>
      </div>
      <div id="flight-party" hidden={!expanded} className={s.party}>
        {counts.map(key => <label key={key}>{key[0].toUpperCase() + key.slice(1)}<select aria-label={key[0].toUpperCase() + key.slice(1)} value={route[key]} onChange={e => set(key, e.target.value)}>{Array.from({ length: key === "adults" ? 20 : 21 }, (_, i) => i + (key === "adults" ? 1 : 0)).map(n => <option key={n}>{n}</option>)}</select></label>)}
        <label>Cabin<select aria-label="Cabin" value={route.cabin} onChange={e => set("cabin", e.target.value)}>{Object.entries(cabins).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
      </div>
      {issue && <p role="alert" className="mt-3 text-sm text-red-800">{issue}</p>}
    </form>
    <section className="pt-8 sm:pt-10">
      <h2 className="mb-4 text-2xl text-forest-950 sm:text-3xl">Plan a route from Kigali</h2>
      <div className={s.cards}>{destinations.map(({ code, city }) => (
        <button type="button" key={code} className={s.card} aria-label={`Plan Kigali to ${city}`} onClick={() => {
          setRoute(old => ({ ...old, origin: initialRoute.origin, destination: `${city} (${code})` })); setIssue(""); departure.current?.focus();
        }}>
          <span className={s.cardBody}><span><b>KGL</b><small>Kigali</small></span><Airway /><span><b>{code}</b><small>{city}</small></span></span>
          <span className={s.stub}><ArrowRight size={19} /></span>
        </button>
      ))}</div>
    </section>
  </>;

  return <>
    <section className={s.itinerary} aria-label="Requested itinerary">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 ref={reviewTitle} tabIndex={-1} className="flex items-center gap-2 text-lg"><Ticket size={18} />Your itinerary</h2><button type="button" onClick={editRoute} className="text-sm underline underline-offset-4">Edit journey</button></div>
      {legs.map((leg, i) => <div key={i} className="border-b border-[var(--line)] pb-3">
        <div className={s.reviewRoute}><strong>{leg.origin}</strong><Airway /><strong>{leg.destination}</strong></div>
        <p className="text-sm">{multi && `Flight ${i + 1} · `}{dateLabel(leg.departureDate)}{tripType === "RETURN" && ` — ${dateLabel(route.returnDate)}`}</p>
      </div>)}
      <p className="mt-3 text-sm">{tripType === "RETURN" ? "Round trip" : multi ? "Multi-city" : "One way"} · {travellers} · {cabin}{nonstop && " · Nonstop only"}{flexible && " · Flexible dates"}</p>
    </section>
    <form action={action} onReset={event => event.preventDefault()} className={s.contact}>
      <input type="hidden" name="submissionKey" value={submissionKey} />
      {Object.entries({ ...route, tripType, returnDate: tripType === "RETURN" ? route.returnDate : "" }).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      {flexible && <input type="hidden" name="flexible" value="on" />}
      {nonstop && <input type="hidden" name="nonstopOnly" value="on" />}
      {additional.map(leg => <div hidden key={leg.id}>
        <input type="hidden" name="legOrigin" value={leg.origin} />
        <input type="hidden" name="legDestination" value={leg.destination} />
        <input type="hidden" name="legDate" value={leg.departureDate} />
      </div>)}
      <label hidden>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <h2 className="text-2xl">Where can we reach you?</h2>
      <div className={s.contactFields}>
        <label>Your name<input name="name" autoComplete="name" required minLength={2} maxLength={120} value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })} /></label>
        <label>Phone or WhatsApp<input type="tel" name="phone" autoComplete="tel" required maxLength={40} value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} /></label>
        <label>Preferred reply<select aria-label="Preferred reply" name="replyChannel" value={channel} onChange={e => setChannel(e.target.value)}><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option><option value="PHONE">Phone</option></select></label>
        <label>Email{channel !== "EMAIL" && " (optional)"}<input name="email" type="email" required={channel === "EMAIL"} autoComplete="email" maxLength={254} value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} /></label>
      </div>
      <details><summary className="cursor-pointer text-sm font-semibold">Baggage and special requests</summary>
        <div className={s.contactFields}><label>Baggage preference<input name="baggage" maxLength={500} value={contact.baggage} onChange={e => setContact({ ...contact, baggage: e.target.value })} /></label><label>Travel notes<textarea name="notes" maxLength={2000} rows={2} value={contact.notes} onChange={e => setContact({ ...contact, notes: e.target.value })} /></label></div>
      </details>
      <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" name="consent" required checked={contact.consent} onChange={e => setContact({ ...contact, consent: e.target.checked })} /><span>{ENQUIRY_CONSENT_TEXT} <Link href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy notice</Link></span></label>
      {state.status === "error" && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.fieldErrors ? Object.values(state.fieldErrors).join(". ") : state.message}</div>}
      <Button type="submit" variant="accent" disabled={pending}>{pending ? "Sending…" : "Request flight quote"}<ArrowRight size={16} /></Button>
    </form>
  </>;
}
