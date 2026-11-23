import Link from "next/link";
import { ArrowRight, Clock3, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Media } from "@/components/ui/media";
import { dateParts, formatRun } from "@/lib/departure-rules";
import type { Edition } from "@/lib/departures";
import { TEMBERA } from "@/lib/journeys";
import {
  RESIDENCY_LABELS,
  allRates,
  hasTieredPricing,
} from "@/lib/residency";
import { cn, formatMoney } from "@/lib/utils";

/**
 * Tembera u Rwanda editions: one card per bookable date.
 *
 * `bookable` is true only while trips can be booked directly (Admin → Launch)
 * and the offer itself is not quote-only. Otherwise the same card asks for a
 * request instead, and shows no price: a price belongs on the written quote.
 */

export const requestHref = (edition: Edition) =>
  `/enquire?journey=TEMBERA&subject=${encodeURIComponent(
    `${edition.tour.name}, ${formatRun(edition.departure.startsOn, edition.departure.lastDay)}`,
  )}`;

export const bookHref = (edition: Edition) =>
  `/tours/${edition.tour.slug}?from=${edition.departure.startsOn}#book`;

function seatsLabel(left: number) {
  if (left < 1) return "Full";
  if (left <= 5) return `Only ${left} ${left === 1 ? "place" : "places"} left`;
  return `${left} places left`;
}

export function EditionCard({
  edition,
  bookable,
}: {
  edition: Edition;
  bookable: boolean;
}) {
  const { tour, departure } = edition;
  const date = dateParts(departure.startsOn);
  const full = departure.seatsLeft < 1;
  const direct = bookable && !tour.enquiryOnly;

  return (
    <article className="group flex flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--line)] bg-white transition-[transform,box-shadow,border-color] duration-500 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-1 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-float)]">
      <div className="relative aspect-[16/9] overflow-hidden bg-forest-950">
        {/* Without a photograph, Media draws the in-palette placeholder instead of a blank box. */}
        <Media
          seed={tour.slug}
          src={tour.image}
          alt=""
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="absolute inset-0"
        />
        <div aria-hidden className="scrim-b absolute inset-0" />

        {/* The calendar leaf: the date is the product. */}
        <div className="absolute left-4 top-4 w-[4.75rem] overflow-hidden rounded-xl bg-white text-center shadow-[0_12px_28px_-12px_rgb(4_14_10/0.7)]">
          <p className="bg-sun-500 py-1 text-2xs font-bold uppercase tracking-[0.14em] text-forest-950">
            {date.month}
          </p>
          <p className="tnum pt-1 font-display text-[2rem] leading-none text-forest-950">
            {date.day}
          </p>
          <p className="pb-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-bone-600">
            {date.weekday}
          </p>
        </div>

        <span
          className={cn(
            "tnum absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-md",
            full
              ? "bg-black/55 text-white ring-1 ring-white/25"
              : departure.seatsLeft <= 5
                ? "bg-sun-500 text-forest-950"
                : "bg-white/90 text-forest-950",
          )}
        >
          <Users className="size-3.5" aria-hidden />
          {seatsLabel(departure.seatsLeft)}
        </span>

        <p className="on-media absolute inset-x-0 bottom-0 flex items-center gap-1.5 p-4 text-sm font-medium text-white">
          <MapPin className="size-4 shrink-0 text-sun-400" aria-hidden />
          {tour.destination}
        </p>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <p className="tnum text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--label)]">
          {formatRun(departure.startsOn, departure.lastDay)}
        </p>
        <h3 className="mt-2 text-[1.625rem] leading-[1.1]">
          <Link href={`/tours/${tour.slug}`} className="hover:underline hover:decoration-sun-500 hover:underline-offset-4">
            {tour.name}
          </Link>
        </h3>
        {departure.note ? (
          <p className="mt-1.5 text-sm font-medium text-clay-700">{departure.note}</p>
        ) : null}
        {tour.summary ? (
          <p className="mt-3 line-clamp-2 text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
            {tour.summary}
          </p>
        ) : null}

        <p className="mt-4 flex items-center gap-1.5 text-sm text-[var(--ink-muted)]">
          <Clock3 className="size-4 text-clay-600" aria-hidden />
          {tour.durationDays} {tour.durationDays === 1 ? "day" : "days"}, all-inclusive
        </p>

        <div className="mt-auto pt-6">
          {direct ? (
            <dl
              className={cn(
                "grid gap-2 border-t border-[var(--line)] pt-4",
                hasTieredPricing(tour) ? "grid-cols-3" : "grid-cols-1",
              )}
            >
              {(hasTieredPricing(tour)
                ? allRates(tour)
                : [{ residency: "CITIZEN" as const, perPersonMinor: tour.priceMinor }]
              ).map(({ residency, perPersonMinor }) => (
                <div key={residency}>
                  <dt className="text-2xs leading-tight text-[var(--ink-faint)]">
                    {hasTieredPricing(tour) ? RESIDENCY_LABELS[residency] : "Per person"}
                  </dt>
                  <dd className="tnum mt-1 font-display text-xl leading-none">
                    {formatMoney(perPersonMinor)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="border-t border-[var(--line)] pt-4 text-sm font-semibold text-forest-700">
              Price on your written quote
            </p>
          )}

          <Button
            href={direct && !full ? bookHref(edition) : requestHref(edition)}
            variant={direct && !full ? "accent" : "primary"}
            size="lg"
            className="mt-5 w-full"
            data-service="TRIP"
            data-placement="SERVICE_REQUEST"
          >
            {full ? "Join the waiting list" : direct ? "Book this edition" : "Request a place"}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </article>
  );
}

/** The soonest edition, as one line. For the campaign band on other pages. */
export function NextEdition({ edition }: { edition: Edition }) {
  const { tour, departure } = edition;
  return (
    <Link
      href={TEMBERA.href + "#editions"}
      className="group mt-8 flex max-w-xl items-center gap-4 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/15 transition-colors hover:bg-white/[0.12]"
    >
      <span className="w-14 shrink-0 overflow-hidden rounded-lg bg-white text-center">
        <span className="block bg-sun-500 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-forest-950">
          {dateParts(departure.startsOn).month}
        </span>
        <span className="tnum block py-0.5 font-display text-2xl leading-none text-forest-950">
          {dateParts(departure.startsOn).day}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xs font-semibold uppercase tracking-[0.14em] text-sun-300">
          Next edition
        </span>
        <span className="block truncate font-display text-xl leading-tight text-white">
          {tour.name}
        </span>
        <span className="tnum block text-sm text-forest-100/80">
          {formatRun(departure.startsOn, departure.lastDay)} · {seatsLabel(departure.seatsLeft)}
        </span>
      </span>
      <ArrowRight
        className="size-5 shrink-0 text-sun-400 transition-transform duration-300 group-hover:translate-x-1"
        aria-hidden
      />
    </Link>
  );
}
