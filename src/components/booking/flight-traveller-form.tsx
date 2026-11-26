"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { bookFlightOnline, type CheckoutState } from "@/app/actions/flight-booking";
import { formatQuoteMoney } from "@/lib/quote-rules";
import s from "./flight-traveller-form.module.css";

type Seat = { id: string; kind: "ADULT" | "CHILD" | "INFANT" };
type Person = { title: string; givenNames: string; surname: string; dateOfBirth: string; nationality: string; documentNumber: string; documentExpiry: string };
const blank: Person = { title: "", givenNames: "", surname: "", dateOfBirth: "", nationality: "", documentNumber: "", documentExpiry: "" };
const KIND_LABEL = { ADULT: "Adult", CHILD: "Child", INFANT: "Infant" } as const;
const KIND_NOTE = { ADULT: "12 or over", CHILD: "2 to 11 on the day of travel", INFANT: "Under 2, on an adult's lap" } as const;

/**
 * The traveller and contact details for one fare, then "Continue to payment".
 * Names go to the airline exactly as typed, so the form asks for them as the
 * passport prints them.
 */
export function TravellerForm({ offerId, seats, totalRwf, breakdown, countries, submissionKey, today }: {
  offerId: string;
  seats: Seat[];
  totalRwf: number;
  breakdown: { label: string; amount: string }[];
  countries: { code: string; name: string }[];
  submissionKey: string;
  today: string;
}) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(bookFlightOnline, { status: "idle" });
  const [people, setPeople] = useState<Person[]>(() => seats.map(() => ({ ...blank })));
  const [contact, setContact] = useState({ contactName: "", email: "", phone: "+250 " });
  const [accept, setAccept] = useState(false);
  // A price change answered by the server becomes the total the traveller confirms next.
  const total = state.status === "error" && state.newTotalRwf ? state.newTotalRwf : totalRwf;
  const numbered = seats.map((seat, i) => `${KIND_LABEL[seat.kind]} ${seats.slice(0, i + 1).filter((x) => x.kind === seat.kind).length}`);

  const set = (i: number, key: keyof Person, value: string) => setPeople((list) => list.map((p, j) => (j === i ? { ...p, [key]: value } : p)));
  const payload = JSON.stringify({
    submissionKey,
    offerId,
    ...contact,
    travellers: seats.map((seat, i) => ({ offerPassengerId: seat.id, ...people[i] })),
    expectedTotalRwf: total,
    accept,
  });

  return (
    <form action={action} className={s.form}>
      <input type="hidden" name="payload" value={payload} />

      {seats.map((seat, i) => (
        <fieldset key={seat.id} className={s.person}>
          <legend>
            <span>{numbered[i]}</span>
            <small>{KIND_NOTE[seat.kind]}</small>
          </legend>
          <div className={s.grid}>
            <label className={s.title}>
              Title
              <select required value={people[i].title} onChange={(e) => set(i, "title", e.target.value)}>
                <option value="" disabled>Choose</option>
                <option value="MR">Mr</option>
                <option value="MS">Ms</option>
                <option value="MRS">Mrs</option>
                <option value="MISS">Miss</option>
              </select>
            </label>
            <label className={s.name}>
              Given names
              <input required autoComplete={i === 0 ? "given-name" : "off"} maxLength={60} value={people[i].givenNames}
                onChange={(e) => set(i, "givenNames", e.target.value)} placeholder="As in the passport" />
            </label>
            <label className={s.name}>
              Surname
              <input required autoComplete={i === 0 ? "family-name" : "off"} maxLength={60} value={people[i].surname}
                onChange={(e) => set(i, "surname", e.target.value)} placeholder="As in the passport" />
            </label>
            <label>
              Date of birth
              <input required type="date" max={today} value={people[i].dateOfBirth} onChange={(e) => set(i, "dateOfBirth", e.target.value)} />
            </label>
            <label>
              Passport country
              <select required value={people[i].nationality} onChange={(e) => set(i, "nationality", e.target.value)}>
                <option value="" disabled>Choose</option>
                {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </label>
            <label>
              Passport number
              <input required maxLength={20} autoCapitalize="characters" value={people[i].documentNumber}
                onChange={(e) => set(i, "documentNumber", e.target.value)} />
            </label>
            <label>
              Passport expiry
              <input required type="date" min={today} value={people[i].documentExpiry} onChange={(e) => set(i, "documentExpiry", e.target.value)} />
            </label>
          </div>
        </fieldset>
      ))}

      <fieldset className={s.person}>
        <legend><span>Contact for this booking</span><small>The e-ticket and any airline change go here</small></legend>
        <div className={s.grid}>
          <label className={s.third}>
            Your full name
            <input required autoComplete="name" maxLength={120} value={contact.contactName} onChange={(e) => setContact({ ...contact, contactName: e.target.value })} />
          </label>
          <label className={s.third}>
            Email
            <input required type="email" autoComplete="email" maxLength={254} value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
          </label>
          <label className={s.third}>
            Phone, with country code
            <input required type="tel" autoComplete="tel" maxLength={24} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
          </label>
        </div>
      </fieldset>

      <div className={s.summary}>
        <dl>
          {breakdown.map((line) => (
            <div key={line.label}><dt>{line.label}</dt><dd>{line.amount}</dd></div>
          ))}
          <div className={s.sum}><dt>Total to pay</dt><dd>{formatQuoteMoney(total, "RWF")}</dd></div>
        </dl>
        <label className={s.accept}>
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} required />
          <span>
            The names, dates of birth and passport details match each passport, and I accept the fare rules above and
            the <Link href="/legal/terms" target="_blank" rel="noopener noreferrer">booking terms</Link>. The ticket is bought once payment is verified.
          </span>
        </label>
        {state.status === "error" ? <p role="alert" className={s.error}>{state.message}</p> : null}
        <button type="submit" className={s.go} disabled={pending}>
          <LockKeyhole size={16} aria-hidden />
          {pending ? "Checking with the airline…" : state.status === "error" && state.newTotalRwf ? `Confirm ${formatQuoteMoney(total, "RWF")} and pay` : "Continue to payment"}
          {!pending ? <ArrowRight size={16} aria-hidden /> : null}
        </button>
        <p className={s.small}>You choose how to pay on the next page. Nothing is charged until you approve the payment there.</p>
      </div>
    </form>
  );
}
