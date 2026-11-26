import Link from "next/link";
import { ArrowRight, Briefcase, CalendarDays, Plane, UsersRound } from "lucide-react";
import type { FareResult } from "@/lib/duffel/mapping";
import { CABIN_LABEL, travellersText, type ShopSearch } from "@/lib/flight-shop-rules";
import s from "./flight-shop.module.css";

/* Plain, server-rendered pieces of the online booking pages. */

const dayText = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const timeOf = (local: string) => local.slice(11, 16);
/** Whole days between two airport-local times: "+1" for an overnight arrival. */
const daysLater = (from: string, to: string) =>
  Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86_400_000);

export function SearchSummary({ search, place }: { search: ShopSearch; place: (code: string) => string }) {
  return (
    <div className={s.summary}>
      <p className={s.summaryRoute}>
        <span>{place(search.from)}</span>
        <Plane aria-hidden className={s.summaryPlane} />
        <span>{place(search.to)}</span>
      </p>
      <ul className={s.summaryFacts}>
        <li><CalendarDays aria-hidden />{dayText(search.depart)}{search.return ? ` to ${dayText(search.return)}` : ", one way"}</li>
        <li><UsersRound aria-hidden />{travellersText(search)}, {CABIN_LABEL[search.cabin].toLowerCase()}</li>
      </ul>
      <Link href="/flights#flight-request" className={s.change}>Change search</Link>
    </div>
  );
}

function Leg({ slice, label }: { slice: FareResult["slices"][number]; label?: string }) {
  const first = slice.segments[0];
  const last = slice.segments[slice.segments.length - 1];
  const via = slice.segments.slice(0, -1).map((seg) => seg.to);
  const later = first && last ? daysLater(first.departLocal, last.arriveLocal) : 0;
  if (!first || !last) return null;
  return (
    <div className={s.leg}>
      {label ? <span className={s.legLabel}>{label}</span> : null}
      <span className={s.time}>
        <b>{timeOf(first.departLocal)}</b>
        <small>{slice.from}</small>
      </span>
      <span className={s.track} aria-hidden>
        <small>{slice.duration}</small>
        <span className={s.line}>
          {via.map((code) => <i key={code} />)}
        </span>
        <small>{slice.stops === 0 ? "Nonstop" : `${slice.stops} stop${slice.stops > 1 ? "s" : ""}, ${via.join(", ")}`}</small>
      </span>
      <span className={s.time}>
        <b>{timeOf(last.arriveLocal)}{later > 0 ? <sup>+{later}</sup> : null}</b>
        <small>{slice.to}</small>
      </span>
      <span className="sr-only">
        {`Departs ${slice.from} ${timeOf(first.departLocal)}, arrives ${slice.to} ${timeOf(last.arriveLocal)}${later > 0 ? ` ${later} day${later > 1 ? "s" : ""} later` : ""}, ${slice.duration}, ${slice.stops === 0 ? "nonstop" : `via ${via.join(", ")}`}.`}
      </span>
    </div>
  );
}

export function AirlineMark({ airline }: { airline: FareResult["airline"] }) {
  return (
    <span className={s.airline}>
      {airline.logo ? (
        // Duffel serves each airline's mark; a plain img keeps remote images out of the optimiser.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={airline.logo} alt="" width={28} height={28} loading="lazy" />
      ) : (
        <span className={s.airlineCode} aria-hidden>{airline.code}</span>
      )}
      <span>{airline.name}</span>
    </span>
  );
}

export function FareRow({ fare, href, returning, price, sub }: {
  fare: FareResult;
  href: string;
  returning: boolean;
  /** What the traveller pays, already formatted. */
  price: string;
  /** A second line under the price, such as the airline's own dollar fare. */
  sub?: string;
}) {
  return (
    <li className={s.fare}>
      <div className={s.fareMain}>
        <AirlineMark airline={fare.airline} />
        {fare.slices.map((slice, i) => (
          <Leg key={i} slice={slice} label={returning ? `${i === 0 ? "Out" : "Back"}, ${dayText(slice.segments[0]?.departLocal ?? "")}` : undefined} />
        ))}
        <p className={s.fareMeta}>
          <Briefcase aria-hidden />
          {fare.baggage}
          {fare.fareBrand ? <span>{fare.fareBrand}</span> : null}
        </p>
      </div>
      <div className={s.fareBuy}>
        <span className={s.total}>
          <small>Total</small>
          <b>{price}</b>
          {sub ? <small>{sub}</small> : null}
        </span>
        <Link href={href} className={s.select} aria-label={`Select ${fare.airline.name}, ${price}`}>
          Select <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </li>
  );
}

export function ShopNotice({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={s.notice} role="status">
      <p className={s.noticeTitle}>{title}</p>
      <div className={s.noticeBody}>{children}</div>
      {action}
    </div>
  );
}

export function StaffPreview({ missing }: { missing: string[] }) {
  return (
    <div className={s.test} role="note">
      <p>Staff preview. Travellers cannot book until:</p>
      <ul>{missing.map((line) => <li key={line}>{line}</li>)}</ul>
    </div>
  );
}
