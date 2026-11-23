"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Clock3, MapPin, Users } from "lucide-react";
import { Media } from "@/components/ui/media";
import { dateParts, formatRun } from "@/lib/departure-rules";
import type { Edition } from "@/lib/departures";
import { RESIDENCIES, RESIDENCY_LABELS, hasTieredPricing, rateFor, type Residency } from "@/lib/residency";
import { cn, formatMoney } from "@/lib/utils";
import { bookHref, requestHref } from "./editions";
import s from "./editions-explorer.module.css";

const monthName = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const monthOf = (day: string) => day.slice(0, 7);
const monthLabel = (month: string) => monthName.format(new Date(`${month}-01T00:00:00Z`));

function seats(left: number) {
  if (left < 1) return "Full";
  if (left <= 5) return `Only ${left} left`;
  return `${left} places left`;
}

/**
 * The editions, with a month filter and a "my rate" switch. Each card shows
 * the one price that applies to the visitor instead of all three.
 */
export function EditionsExplorer({ editions, bookable }: { editions: Edition[]; bookable: boolean }) {
  const months = useMemo(() => [...new Set(editions.map((e) => monthOf(e.departure.startsOn)))], [editions]);
  const [month, setMonth] = useState("");
  const [rate, setRate] = useState<Residency>("CITIZEN");
  const tiered = bookable && editions.some((e) => !e.tour.enquiryOnly && hasTieredPricing(e.tour));
  const shown = month ? editions.filter((e) => monthOf(e.departure.startsOn) === month) : editions;

  return (
    <div>
      <div className={s.controls}>
        {months.length > 1 ? (
          <div className={s.months} role="group" aria-label="Filter by month">
            <button type="button" aria-pressed={month === ""} onClick={() => setMonth("")}>
              All dates <span>{editions.length}</span>
            </button>
            {months.map((m) => (
              <button key={m} type="button" aria-pressed={month === m} onClick={() => setMonth(m)}>
                {monthLabel(m)} <span>{editions.filter((e) => monthOf(e.departure.startsOn) === m).length}</span>
              </button>
            ))}
          </div>
        ) : <span />}
        {tiered ? (
          <fieldset className={s.rates}>
            <legend>Show my rate</legend>
            <div>
              {RESIDENCIES.map((residency) => (
                <label key={residency}>
                  <input type="radio" name="tembera-rate" checked={rate === residency} onChange={() => setRate(residency)} />
                  <span>{RESIDENCY_LABELS[residency]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
      </div>

      <ul className={s.grid} aria-live="polite">
        {shown.map((edition) => {
          const { tour, departure } = edition;
          const date = dateParts(departure.startsOn);
          const full = departure.seatsLeft < 1;
          const direct = bookable && !tour.enquiryOnly;
          const ownRate = hasTieredPricing(tour);
          return (
            <li key={departure.id}>
              <article className={s.card}>
                <div className={s.media}>
                  <Media seed={tour.slug} src={tour.image} alt="" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="absolute inset-0" />
                  <span className={s.scrim} aria-hidden />
                  <div className={s.leaf}>
                    <p>{date.month}</p>
                    <b>{date.day}</b>
                    <small>{date.weekday}</small>
                  </div>
                  <span className={cn(s.seats, full ? s.seatsFull : departure.seatsLeft <= 5 && s.seatsLow)}>
                    <Users size={14} aria-hidden /> {seats(departure.seatsLeft)}
                  </span>
                  <p className={s.place}><MapPin size={15} aria-hidden /> {tour.destination}</p>
                </div>
                <div className={s.body}>
                  <p className={s.run}>{formatRun(departure.startsOn, departure.lastDay)}</p>
                  <h3><Link href={`/tours/${tour.slug}`}>{tour.name}</Link></h3>
                  {departure.note ? <p className={s.note}>{departure.note}</p> : null}
                  {tour.summary ? <p className={s.summary}>{tour.summary}</p> : null}
                  <p className={s.length}><Clock3 size={15} aria-hidden /> {tour.durationDays} {tour.durationDays === 1 ? "day" : "days"}, all-inclusive</p>
                  <div className={s.foot}>
                    {direct ? (
                      <p className={s.price}>
                        <small>{ownRate ? RESIDENCY_LABELS[rate] : "Per person"}</small>
                        <b>{formatMoney(rateFor(tour, ownRate ? rate : "CITIZEN"))}</b>
                        <span>per person, everything included</span>
                      </p>
                    ) : (
                      <p className={s.quoted}>Price on your written quote</p>
                    )}
                    <Link href={direct && !full ? bookHref(edition) : requestHref(edition)}
                      className={cn(s.cta, direct && !full ? s.ctaBook : s.ctaAsk)} data-service="TRIP" data-placement="SERVICE_REQUEST">
                      {full ? "Join the waiting list" : direct ? "Book this edition" : "Request a place"}
                      <ArrowRight size={16} aria-hidden />
                    </Link>
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
