"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowRight, BellRing, Check, Mail, MessageCircle, Phone, UsersRound } from "lucide-react";
import { submitServiceEnquiry } from "@/app/actions/service-enquiry";
import { useSite } from "@/components/layout/site-context";
import { ADD_ONS, journeyForm } from "@/lib/journey-requests";
import type { FlightEnquiryState } from "@/lib/flight-enquiry-schema";
import { RESIDENCIES, RESIDENCY_LABELS, type Residency } from "@/lib/residency";
import { cn } from "@/lib/utils";
import { Stepper } from "./flight-search-controls";
import s from "./journey-form.module.css";

const kinds = [
  ["PUBLIC", "The next editions", BellRing],
  ["PRIVATE", "A private edition for my group", UsersRound],
] as const;
const places = ["Akagera", "Nyungwe", "Volcanoes & Musanze", "Lake Kivu", "Kigali", "Anywhere in Rwanda"];
const channels = [["WHATSAPP", "WhatsApp", MessageCircle], ["EMAIL", "Email", Mail], ["PHONE", "Phone", Phone]] as const;
const monthName = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

/** The six months from this one, as "Dec 2026". */
function nextMonths(today: string) {
  const first = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(first);
    d.setUTCMonth(d.getUTCMonth() + i);
    return monthName.format(d);
  });
}

/**
 * "Be first to know": the Tembera request. It asks for places, months and a
 * rate rather than exact dates, because editions set their own dates. The
 * choices are written into the message so the desk reads them as one note.
 */
export function TemberaRequestForm({ submissionKey, today, context }: { submissionKey: string; today: string; context: string }) {
  const site = useSite();
  const copy = journeyForm("TEMBERA");
  const [state, action, pending] = useActionState(submitServiceEnquiry, { status: "idle" } as FlightEnquiryState);
  const [kind, setKind] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [party, setParty] = useState(1);
  const [where, setWhere] = useState<string[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [rate, setRate] = useState<Residency | "">("");
  const [addOns, setAddOns] = useState<string[]>([]);
  const [contact, setContact] = useState({ name: "", phone: "", email: "", notes: "", replyChannel: "WHATSAPP" });
  const [consent, setConsent] = useState(false);
  const done = useRef<HTMLHeadingElement>(null);
  const flip = (list: string[], item: string) => (list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  const set = (key: keyof typeof contact, value: string) => setContact((old) => ({ ...old, [key]: value }));
  const offered = copy.addOns.filter((item) => {
    const addOn = ADD_ONS.find((a) => a.label === item);
    return addOn && site.publications[addOn.service] !== "HIDDEN";
  });

  useEffect(() => {
    if (state.status === "success") done.current?.focus();
  }, [state.status]);

  const location = where.length === 0 || where.includes("Anywhere in Rwanda") ? "Anywhere in Rwanda" : where.join(", ");
  const message = [
    kind === "PRIVATE" ? `A private edition for a group of ${party}.` : `Tell me when the next editions open, for ${party} ${party === 1 ? "place" : "places"}.`,
    months.length ? `Months: ${months.join(", ")}.` : "",
    rate ? `Rate: ${RESIDENCY_LABELS[rate]}.` : "",
    contact.notes.trim() ? `Notes: ${contact.notes.trim()}` : "",
  ].filter(Boolean).join("\n");

  if (state.status === "success") return (
    <section className={s.card} role="status">
      <div className={s.received}>
        <p className={s.kicker}>You are on the list</p>
        <h2 ref={done} tabIndex={-1}><span lang="rw">Murakoze</span>, <em>see you on the road</em></h2>
        <p className={s.receivedLede}>{kind === "PRIVATE" ? `A private edition for ${party}` : `${party} ${party === 1 ? "place" : "places"}`} · {location}</p>
        <p className={s.receivedBody}>
          {kind === "PRIVATE"
            ? "Our desk will come back with a route, dates and a written price for your group."
            : "We will write as soon as an edition opens that matches what you asked for, with the dates, the route, what is included and the price."}
        </p>
        <div className={s.reference}><span>Your reference</span><strong>{state.reference}</strong></div>
      </div>
    </section>
  );

  return (
    <form action={action} onReset={(event) => event.preventDefault()} className={s.card}>
      <input type="hidden" name="submissionKey" value={submissionKey} />
      <input type="hidden" name="context" value={context} />
      <input type="hidden" name="journey" value="TEMBERA" />
      <input type="hidden" name="service" value="TRIP" />
      {Object.entries({
        partySize: String(party), location, message, name: contact.name, phone: contact.phone, email: contact.email,
        replyChannel: contact.replyChannel, addOns: addOns.join(", "), startDate: "", endDate: "", budget: "",
        eventType: "", venueStyle: "", needs: "", organization: "", students: "", chaperones: "", ageGroup: "",
        learningFocus: "", pickup: "", dropoff: "",
      }).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      {consent ? <input type="hidden" name="consent" value="on" /> : null}
      <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label></div>

      <div className={s.body}>
        <h2 className={s.stepTitle} lang="rw">Tembera <em>u Rwanda</em></h2>
        <div className={s.fields}>
          <fieldset className={s.group}>
            <legend>What should we tell you about?</legend>
            <div className={s.chips}>
              {kinds.map(([value, label, Icon]) => (
                <label key={value}>
                  <input type="radio" name="kindChoice" checked={kind === value} onChange={() => setKind(value)} />
                  <span><Icon size={15} aria-hidden />{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className={cn(s.group, s.narrow)}>
            <Stepper label={kind === "PRIVATE" ? "People in your group" : copy.party} note={kind === "PRIVATE" ? "Schools, teams, families" : "Seats to keep for you"}
              value={party} min={1} max={kind === "PRIVATE" ? 200 : 30} onChange={setParty} />
          </div>

          <fieldset className={s.group}>
            <legend>{copy.location.label} <small>choose any</small></legend>
            <div className={s.chips}>
              {places.map((place) => (
                <label key={place}>
                  <input type="checkbox" checked={where.includes(place)} onChange={() => setWhere(flip(where, place))} />
                  <span><Check size={13} strokeWidth={3} aria-hidden />{place}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className={s.group}>
            <legend>When could you travel? <small>optional</small></legend>
            <div className={s.chips}>
              {nextMonths(today).map((month) => (
                <label key={month}>
                  <input type="checkbox" checked={months.includes(month)} onChange={() => setMonths(flip(months, month))} />
                  <span><Check size={13} strokeWidth={3} aria-hidden />{month}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className={s.group}>
            <legend>Your rate <small>optional, it sets the price we quote</small></legend>
            <div className={s.chips}>
              {RESIDENCIES.map((residency) => (
                <label key={residency}>
                  <input type="radio" name="rateChoice" checked={rate === residency} onChange={() => setRate(residency)} />
                  <span>{RESIDENCY_LABELS[residency]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {offered.length ? (
            <fieldset className={cn(s.group, s.extras)}>
              <legend>Add to this request</legend>
              <div className={s.chips}>
                {offered.map((item) => (
                  <label key={item}>
                    <input type="checkbox" checked={addOns.includes(item)} onChange={() => setAddOns(flip(addOns, item))} />
                    <span><Check size={13} strokeWidth={3} aria-hidden />{item}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className={s.group}>
            <label className={s.groupLabel} htmlFor="tembera-notes">Anything else? <small>optional</small></label>
            <textarea id="tembera-notes" className={s.input} rows={3} maxLength={3500} placeholder={copy.message.placeholder}
              value={contact.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <div className={s.divider} />

          <fieldset className={s.group}>
            <legend>Reply by</legend>
            <div className={s.chips}>
              {channels.map(([value, label, Icon]) => (
                <label key={value}>
                  <input type="radio" name="channelChoice" checked={contact.replyChannel === value} onChange={() => set("replyChannel", value)} />
                  <span><Icon size={15} aria-hidden />{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className={s.pair}>
            <label className={s.labelled}>Your name
              <input className={s.input} required minLength={2} maxLength={120} autoComplete="name" value={contact.name} onChange={(e) => set("name", e.target.value)} />
            </label>
            <label className={s.labelled}>{contact.replyChannel === "WHATSAPP" ? "WhatsApp number" : "Phone number"}{contact.replyChannel === "EMAIL" ? <small> optional</small> : null}
              <input className={s.input} type="tel" required={contact.replyChannel !== "EMAIL"} maxLength={40} autoComplete="tel" placeholder="+250 7…"
                value={contact.phone} onChange={(e) => set("phone", e.target.value)} />
            </label>
            <label className={cn(s.labelled, s.wide)}>Email{contact.replyChannel !== "EMAIL" ? <small> optional</small> : null}
              <input className={s.input} type="email" required={contact.replyChannel === "EMAIL"} maxLength={254} autoComplete="email"
                value={contact.email} onChange={(e) => set("email", e.target.value)} />
            </label>
          </div>
          <label className={s.consent}>
            <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I have read the <Link href="/legal/privacy" target="_blank" rel="noopener noreferrer">privacy notice</Link> (opens in a new tab) and agree to be contacted about this request.</span>
          </label>
          {state.status === "error" ? (
            <div role="alert" className={s.error}>
              <b>{state.message}</b>
              {state.fieldErrors ? <span> {Object.values(state.fieldErrors).join(". ")}.</span> : null}
            </div>
          ) : null}
        </div>
      </div>

      <footer className={s.foot}>
        <p className={s.footNote}>Nothing is booked or charged by sending this.</p>
        <button type="submit" className={s.next} disabled={pending}>
          {pending ? "Sending…" : kind === "PRIVATE" ? "Plan our edition" : "Tell me first"} {pending ? null : <ArrowRight size={17} aria-hidden />}
        </button>
      </footer>
    </form>
  );
}
