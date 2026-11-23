"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, CalendarHeart, Check, Landmark, UsersRound } from "lucide-react";
import { VENUE_STYLES } from "@/lib/journey-requests";
import { prefillWedding, venueKinds } from "@/lib/wedding-request";
import { Calendar, DropField, itineraryDate, latestDate } from "./flight-search-controls";
import { GuestCount } from "./wedding-request-form";
import s from "./journey-form.module.css";

/** "Save the date" in the hero: three answers, then on to the full request. */
export function WeddingDateChecker({ today }: { today: string }) {
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState("100");
  const [style, setStyle] = useState("");
  const [panel, setPanel] = useState<string | null>(null);
  const toggle = (id: string) => (open: boolean) => setPanel(open ? id : null);

  return (
    <div className={s.checker}>
      <p className={s.checkerTitle}>
        <span>Save the date</span>
        <small>Three answers, and we start checking venues</small>
      </p>
      <div className={s.checkerGrid}>
        <DropField id="checker-date" icon={<CalendarHeart />} label="The date" title="Choose the date of the day"
          value={date ? itineraryDate(date) : ""} placeholder="Choose a date" open={panel === "date"} onOpenChange={toggle("date")}>
          <Calendar value={date} min={today} max={latestDate(today)} onPick={(day) => { setDate(day); setPanel("guests"); }} />
        </DropField>
        <DropField id="checker-guests" icon={<UsersRound />} label="Guests" title="How many guests?" className={s.anchored}
          value={`${guests} guests`} placeholder="" open={panel === "guests"} onOpenChange={toggle("guests")}>
          <div className={s.popGuests}>
            <GuestCount value={guests} onChange={setGuests} />
            <button type="button" className={s.popDone} onClick={() => setPanel("style")}>Done</button>
          </div>
        </DropField>
        <DropField id="checker-style" icon={<Landmark />} label="Setting" title="The kind of venue" className={s.anchored} align="end"
          value={style} placeholder="Any kind of venue" open={panel === "style"} onOpenChange={toggle("style")}>
          <ul className={s.styleList}>
            {VENUE_STYLES.map((option) => (
              <li key={option}>
                <button type="button" aria-pressed={style === option} onClick={() => { setStyle(option); setPanel(null); }}>
                  {option}
                  {style === option ? <Check size={16} strokeWidth={3} aria-hidden /> : null}
                </button>
              </li>
            ))}
          </ul>
        </DropField>
        <button type="button" className={s.checkerGo}
          onClick={() => { setPanel(null); prefillWedding({ startDate: date, partySize: guests, venueStyle: style }); }}>
          Check this date <ArrowRight size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** The four kinds of venue; choosing one starts the request with it. */
export function VenueKinds() {
  return (
    <ul className={s.kinds}>
      {venueKinds.map((kind, i) => (
        <li key={kind.style}>
          <button type="button" className={s.kind} onClick={() => prefillWedding({ venueStyle: kind.style })}
            aria-label={`${kind.name}: ask about this kind of venue`}>
            <Image src={kind.image} alt="" fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className={s.kindImage} style={kind.imagePosition ? { objectPosition: kind.imagePosition } : undefined} />
            <span className={s.kindScrim} aria-hidden />
            <span className={s.kindNumber} aria-hidden>{String(i + 1).padStart(2, "0")}</span>
            <span className={s.kindArrow} aria-hidden><ArrowUpRight size={17} /></span>
            <span className={s.kindText}>
              <b>{kind.name}</b>
              <span>{kind.body}</span>
              <small>{kind.suits}</small>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
