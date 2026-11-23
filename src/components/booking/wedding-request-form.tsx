"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, CalendarRange, Check, Mail, MessageCircle, Minus, Phone, Plus, Sparkles } from "lucide-react";
import { submitServiceEnquiry } from "@/app/actions/service-enquiry";
import { useSite } from "@/components/layout/site-context";
import { ADD_ONS, EVENT_NEEDS, EVENT_TYPES, journeyForm } from "@/lib/journey-requests";
import type { FlightEnquiryState } from "@/lib/flight-enquiry-schema";
import {
  MAX_WEDDING_GUESTS, venueKinds, WEDDING_PREFILL_EVENT, weddingLocations, type WeddingPrefill,
} from "@/lib/wedding-request";
import { cn } from "@/lib/utils";
import { Calendar, DropField, fieldDate, itineraryDate, latestDate, nightsBetween } from "./flight-search-controls";
import s from "./journey-form.module.css";

/* -------------------------------------------------------------- GuestCount */

const presets = [30, 80, 150, 250, 400];

export function GuestCount({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const n = Number(value) || 0;
  const set = (next: number) => onChange(String(Math.min(MAX_WEDDING_GUESTS, Math.max(1, next))));
  return (
    <div className={s.guests}>
      <div className={s.dial}>
        <button type="button" aria-label="Ten fewer guests" disabled={n <= 1} onClick={() => set(n - 10)}><Minus size={18} /></button>
        <label>
          <input type="number" inputMode="numeric" min={1} max={MAX_WEDDING_GUESTS} value={value} aria-label="Guests expected"
            onChange={(event) => onChange(event.target.value)} onBlur={() => set(n || 1)} />
          <small aria-hidden>guests</small>
        </label>
        <button type="button" aria-label="Ten more guests" disabled={n >= MAX_WEDDING_GUESTS} onClick={() => set(n + 10)}><Plus size={18} /></button>
      </div>
      <div className={s.presets} role="group" aria-label="Quick guest counts">
        {presets.map((preset) => (
          <button key={preset} type="button" aria-pressed={n === preset} onClick={() => set(preset)}>{preset}</button>
        ))}
        <button type="button" aria-pressed={n === MAX_WEDDING_GUESTS} onClick={() => set(MAX_WEDDING_GUESTS)}>{MAX_WEDDING_GUESTS}</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- form */

const STEPS = ["The day", "The setting", "Your details"] as const;
/** Which step shows each field, for jumping back to a server error. */
const stepOf: Record<string, number> = {
  eventType: 0, startDate: 0, endDate: 0, partySize: 0,
  venueStyle: 1, location: 1, needs: 1, message: 1, addOns: 1, budget: 1,
};
const channels = [["WHATSAPP", "WhatsApp", MessageCircle], ["EMAIL", "Email", Mail], ["PHONE", "Phone", Phone]] as const;
const initialState: FlightEnquiryState = { status: "idle" };

export function WeddingRequestForm({
  submissionKey,
  context,
  today,
  initial,
}: {
  submissionKey: string;
  context: string;
  today: string;
  /** Answers known before the couple starts, e.g. the venue they chose. */
  initial?: { venueStyle?: string; location?: string };
}) {
  const site = useSite();
  const copy = journeyForm("WEDDING");
  const [state, action, pending] = useActionState(submitServiceEnquiry, initialState);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({
    eventType: "Wedding", startDate: "", endDate: "", partySize: "100",
    venueStyle: initial?.venueStyle ?? "", location: initial?.location ?? "", message: "", budget: "",
    name: "", phone: "", email: "", replyChannel: "WHATSAPP",
  });
  const [flexible, setFlexible] = useState(false);
  const [multiDay, setMultiDay] = useState(false);
  const [needs, setNeeds] = useState<string[]>(["Venue reservation"]);
  const [addOns, setAddOns] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [panel, setPanel] = useState<string | null>(null);
  const [issue, setIssue] = useState("");
  const top = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const done = useRef<HTMLHeadingElement>(null);
  const set = (key: keyof typeof values, value: string) => setValues((old) => ({ ...old, [key]: value }));
  const flip = (list: string[], item: string) => (list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  const max = latestDate(today);
  const offered = copy.addOns.filter((item) => {
    const addOn = ADD_ONS.find((a) => a.label === item);
    return addOn && site.publications[addOn.service] !== "HIDDEN";
  });
  const days = multiDay && values.endDate ? nightsBetween(values.startDate, values.endDate) + 1 : 1;

  // The date checker and the venue cards hand their answers to this form.
  useEffect(() => {
    function prefill(event: Event) {
      const detail = (event as CustomEvent<WeddingPrefill>).detail;
      setValues((old) => ({
        ...old,
        ...(detail.startDate ? { startDate: detail.startDate, endDate: old.endDate && old.endDate < detail.startDate ? "" : old.endDate } : {}),
        ...(detail.partySize ? { partySize: detail.partySize } : {}),
        ...(detail.venueStyle ? { venueStyle: detail.venueStyle } : {}),
      }));
      setIssue("");
      setStep(detail.venueStyle && !detail.startDate ? 1 : 0);
    }
    window.addEventListener(WEDDING_PREFILL_EVENT, prefill);
    return () => window.removeEventListener(WEDDING_PREFILL_EVENT, prefill);
  }, []);

  // A server error sends the couple back to the step that holds the field.
  const [answered, setAnswered] = useState(state);
  if (state !== answered) {
    setAnswered(state);
    if (state.status === "error")
      setStep(Math.min(2, ...Object.keys(state.fieldErrors ?? {}).map((field) => stepOf[field] ?? 2)));
  }

  useEffect(() => {
    if (state.status === "success") done.current?.focus();
  }, [state.status]);

  function check(at: number) {
    const n = Number(values.partySize);
    if (at === 0 && (!Number.isInteger(n) || n < 1 || n > MAX_WEDDING_GUESTS)) return `Choose between 1 and ${MAX_WEDDING_GUESTS} guests.`;
    if (at === 0 && multiDay && values.endDate && !values.startDate) return "Choose the first day as well as the last.";
    if (at === 1 && !values.location.trim()) return "Tell us where you would like the venue, or choose “Open to ideas”.";
    if (at === 1 && values.message.trim().length < 10) return "Tell us a little about the day (at least 10 characters).";
    return "";
  }
  function go(next: number) {
    if (next > step) {
      for (let at = step; at < next; at++) {
        const problem = check(at);
        if (problem) { setStep(at); setIssue(problem); return; }
      }
    }
    setIssue("");
    setPanel(null);
    setStep(next);
    requestAnimationFrame(() => {
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      heading.current?.focus({ preventScroll: true });
    });
  }
  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    // Enter in a text field moves on a step instead of sending the request early.
    if (event.key === "Enter" && step < 2 && (event.target as HTMLElement).tagName === "INPUT") {
      event.preventDefault();
      go(step + 1);
    }
  }

  const occasion = values.eventType === "Something else" ? "A celebration" : values.eventType;
  const when = values.startDate
    ? multiDay && values.endDate && values.endDate !== values.startDate
      ? `${fieldDate(values.startDate)} – ${fieldDate(values.endDate)}`
      : itineraryDate(values.startDate)
    : "Date to be decided";

  /* ---------------------------------------------------------- confirmation */

  if (state.status === "success") return (
    <section className={s.card} role="status">
      <div className={s.received}>
        <p className={s.kicker}>Request received</p>
        <h2 ref={done} tabIndex={-1}>We are checking <em>your date</em></h2>
        <p className={s.receivedLede}>
          {occasion} · {when} · {values.partySize} guests{values.location ? ` · ${values.location}` : ""}
        </p>
        <p className={s.receivedBody}>
          Our desk will look for venues that are free and reply by {values.replyChannel === "EMAIL" ? "email" : values.replyChannel === "PHONE" ? "phone" : "WhatsApp"} with what each includes, the cost and the terms, in writing. Nothing is reserved or charged until you accept.
        </p>
        <div className={s.reference}>
          <span>Your reference</span>
          <strong>{state.reference}</strong>
        </div>
        {site.publications.TRIP !== "HIDDEN" ? (
          <Link href="/experiences/honeymoon" className={s.receivedLink}>Plan the honeymoon too <ArrowRight size={15} aria-hidden /></Link>
        ) : null}
      </div>
    </section>
  );

  /* ------------------------------------------------------------------ form */

  return (
    <div ref={top} className={s.cardWrap}>
      <form action={action} onReset={(event) => event.preventDefault()} onKeyDown={onKeyDown} className={s.card} noValidate={step < 2}>
        {/* Every answer travels as a hidden field, so the steps can come and go. */}
        <input type="hidden" name="submissionKey" value={submissionKey} />
        <input type="hidden" name="context" value={context} />
        <input type="hidden" name="journey" value="WEDDING" />
        <input type="hidden" name="service" value="EVENT" />
        {Object.entries({
          ...values, endDate: multiDay ? values.endDate : "", needs: needs.join(", "), addOns: addOns.join(", "),
          organization: "", students: "", chaperones: "", ageGroup: "", learningFocus: "", pickup: "", dropoff: "",
        }).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
        {flexible ? <input type="hidden" name="flexible" value="on" /> : null}
        {consent ? <input type="hidden" name="consent" value="on" /> : null}
        <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label></div>

        <header className={s.head}>
          <p className={s.summary} aria-live="polite">
            <Sparkles size={15} aria-hidden />
            <span>{occasion}</span>
            <i aria-hidden>·</i><span>{when}</span>
            <i aria-hidden>·</i><span>{values.partySize || "—"} guests</span>
            {values.venueStyle ? <><i aria-hidden>·</i><span>{values.venueStyle}</span></> : null}
          </p>
          <ol className={s.steps}>
            {STEPS.map((label, i) => (
              <li key={label}>
                <button type="button" aria-current={i === step ? "step" : undefined} data-done={i < step || undefined}
                  disabled={i > step} onClick={() => go(i)}>
                  <span>{i < step ? <Check size={13} strokeWidth={3} aria-hidden /> : i + 1}</span>
                  {label}
                </button>
              </li>
            ))}
          </ol>
        </header>

        <div className={s.body}>
          <h2 ref={heading} tabIndex={-1} className={s.stepTitle}>
            {step === 0 ? <>When is <em>the day?</em></> : step === 1 ? <>Where do you <em>picture it?</em></> : <>Where should we <em>reply?</em></>}
          </h2>

          {state.status === "error" ? (
            <div role="alert" className={s.error}>
              <b>{state.message}</b>
              {state.fieldErrors ? <span> {Object.values(state.fieldErrors).join(". ")}.</span> : null}
            </div>
          ) : null}

          {step === 0 ? (
            <div className={s.fields}>
              <fieldset className={s.group}>
                <legend>What are you celebrating?</legend>
                <div className={s.chips}>
                  {EVENT_TYPES.map((type) => (
                    <label key={type}>
                      <input type="radio" name="eventChoice" checked={values.eventType === type} onChange={() => set("eventType", type)} />
                      <span>{type}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className={s.group}>
                <p className={s.groupLabel}>The date</p>
                <div className={s.dateRow}>
                  <DropField id="wedding-date" icon={<CalendarDays />} label={multiDay ? "First day" : "Date of the day"} title="Choose the date"
                    value={values.startDate ? itineraryDate(values.startDate) : ""} placeholder="Choose a date" open={panel === "start"}
                    onOpenChange={(open) => setPanel(open ? "start" : null)}>
                    <Calendar value={values.startDate} min={today} max={max}
                      rangeEnd={multiDay && values.endDate ? values.endDate : undefined}
                      onPick={(day) => {
                        setValues((old) => ({ ...old, startDate: day, endDate: old.endDate && old.endDate < day ? "" : old.endDate }));
                        setPanel(multiDay ? "end" : null);
                      }} />
                  </DropField>
                  {multiDay ? (
                    <DropField id="wedding-end" icon={<CalendarRange />} label="Last day" title="Choose the last day"
                      value={values.endDate ? itineraryDate(values.endDate) : ""} placeholder="Choose a date"
                      hint={days > 1 ? `${days} days of celebrations` : undefined}
                      open={panel === "end"} onOpenChange={(open) => setPanel(open ? "end" : null)}>
                      <Calendar value={values.endDate} min={values.startDate || today} max={max} rangeStart={values.startDate || undefined}
                        onPick={(day) => { set("endDate", day); setPanel(null); }} />
                    </DropField>
                  ) : null}
                </div>
                <div className={s.toggles}>
                  <label className={s.toggle}><input type="checkbox" checked={multiDay} onChange={(e) => { setMultiDay(e.target.checked); if (!e.target.checked) set("endDate", ""); }} /><span>More than one day</span></label>
                  <label className={s.toggle}><input type="checkbox" checked={flexible} onChange={(e) => setFlexible(e.target.checked)} /><span>We could consider other dates</span></label>
                </div>
                {!values.startDate ? <p className={s.note}>No date yet? Leave it empty and tell us the season you have in mind.</p> : null}
              </div>

              <div className={s.group}>
                <p className={s.groupLabel}>{copy.party}</p>
                <GuestCount value={values.partySize} onChange={(value) => set("partySize", value)} />
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className={s.fields}>
              <fieldset className={s.group}>
                <legend>The kind of venue you picture</legend>
                <div className={s.styles}>
                  {[...venueKinds, null].map((kind) => {
                    const style = kind?.style ?? "Not sure yet";
                    return (
                      <label key={style}>
                        <input type="radio" name="styleChoice" checked={values.venueStyle === style} onChange={() => set("venueStyle", style)} />
                        <span>
                          {kind ? (
                            <Image src={kind.image} alt="" fill sizes="(min-width: 768px) 12rem, 45vw" className={s.styleImage}
                              style={kind.imagePosition ? { objectPosition: kind.imagePosition } : undefined} />
                          ) : null}
                          <b>{kind?.name ?? "Not sure yet"}</b>
                          <i aria-hidden><Check size={13} strokeWidth={3} /></i>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className={s.group}>
                <label className={s.groupLabel} htmlFor="wedding-location">{copy.location.label}</label>
                <div className={s.chips} role="group" aria-label="Suggested places">
                  {weddingLocations.map((place) => (
                    <button key={place} type="button" className={s.chip} aria-pressed={values.location === place} onClick={() => set("location", place)}>{place}</button>
                  ))}
                </div>
                <input id="wedding-location" className={s.input} maxLength={200} placeholder={copy.location.placeholder}
                  value={values.location} onChange={(e) => set("location", e.target.value)} />
              </div>

              <fieldset className={s.group}>
                <legend>What should we arrange?</legend>
                <div className={s.chips}>
                  {EVENT_NEEDS.map((need) => (
                    <label key={need}>
                      <input type="checkbox" checked={needs.includes(need)} onChange={() => setNeeds(flip(needs, need))} />
                      <span><Check size={13} strokeWidth={3} aria-hidden />{need}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className={s.group}>
                <label className={s.groupLabel} htmlFor="wedding-message">{copy.message.label}</label>
                <textarea id="wedding-message" className={s.input} rows={4} maxLength={4000} placeholder={copy.message.placeholder}
                  value={values.message} onChange={(e) => set("message", e.target.value)} />
              </div>

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
                  <p className={s.note}>We check these alongside the venue and return one written quote.</p>
                </fieldset>
              ) : null}

              <div className={s.group}>
                <label className={s.groupLabel} htmlFor="wedding-budget">Budget and currency <small>optional</small></label>
                <input id="wedding-budget" className={s.input} maxLength={100} placeholder="For example, USD 15,000 in total"
                  value={values.budget} onChange={(e) => set("budget", e.target.value)} />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className={s.fields}>
              <fieldset className={s.group}>
                <legend>Reply by</legend>
                <div className={s.chips}>
                  {channels.map(([value, label, Icon]) => (
                    <label key={value}>
                      <input type="radio" name="channelChoice" checked={values.replyChannel === value} onChange={() => set("replyChannel", value)} />
                      <span><Icon size={15} aria-hidden />{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className={s.pair}>
                <label className={s.labelled}>Your names
                  <input className={s.input} required minLength={2} maxLength={120} autoComplete="name" placeholder="For example, Aline & David"
                    value={values.name} onChange={(e) => set("name", e.target.value)} />
                </label>
                <label className={s.labelled}>{values.replyChannel === "WHATSAPP" ? "WhatsApp number" : "Phone number"}{values.replyChannel === "EMAIL" ? <small> optional</small> : null}
                  <input className={s.input} type="tel" required={values.replyChannel !== "EMAIL"} maxLength={40} autoComplete="tel" placeholder="+250 7…"
                    value={values.phone} onChange={(e) => set("phone", e.target.value)} />
                </label>
                <label className={cn(s.labelled, s.wide)}>Email{values.replyChannel !== "EMAIL" ? <small> optional</small> : null}
                  <input className={s.input} type="email" required={values.replyChannel === "EMAIL"} maxLength={254} autoComplete="email"
                    value={values.email} onChange={(e) => set("email", e.target.value)} />
                </label>
              </div>
              {context ? <p className={s.about}><b>About:</b> {context}</p> : null}
              <p className={s.note}>Please do not enter passport numbers, identity documents or payment-card details.</p>
              <label className={s.consent}>
                <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>I have read the <Link href="/legal/privacy" target="_blank" rel="noopener noreferrer">privacy notice</Link> (opens in a new tab) and agree to be contacted about this request.</span>
              </label>
            </div>
          ) : null}

          {issue ? <p role="alert" className={s.error}>{issue}</p> : null}
        </div>

        <footer className={s.foot}>
          {step > 0 ? (
            <button type="button" className={s.back} onClick={() => go(step - 1)}><ArrowLeft size={16} aria-hidden /> Back</button>
          ) : <p className={s.footNote}>Nothing is reserved or charged by sending this.</p>}
          {step < 2 ? (
            <button type="button" className={s.next} onClick={() => go(step + 1)}>
              {step === 0 ? "Next: the setting" : "Next: your details"} <ArrowRight size={17} aria-hidden />
            </button>
          ) : (
            <button type="submit" className={s.next} disabled={pending}>
              {pending ? "Sending…" : "Check our date"} {pending ? null : <ArrowRight size={17} aria-hidden />}
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}
