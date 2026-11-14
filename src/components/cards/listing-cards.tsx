import Link from "next/link";
import { ArrowUpRight, Clock, Fuel, Gauge, MapPin, Mountain, Users } from "lucide-react";
import { Media } from "@/components/ui/media";
import { Badge, Rating } from "@/components/ui/primitives";
import type { CatalogueHotel, CatalogueTour, CatalogueVehicle } from "@/lib/catalogue";
import type { Destination } from "@/lib/content";
import { destinationImages } from "@/lib/images";
import { cn, formatMoney } from "@/lib/utils";

/* --------------------------------------------------------------- Price tag */

function PriceFrom({
  amount,
  unit,
}: {
  amount: number;
  unit: string;
}) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span className="text-xs text-[var(--ink-faint)]">From</span>
      <span className="tnum font-display text-[1.375rem] font-medium leading-none tracking-[-0.02em] text-[var(--ink)]">
        {formatMoney(amount)}
      </span>
      <span className="text-xs text-[var(--ink-faint)]">{unit}</span>
    </p>
  );
}

// Real review averages only. A listing nobody has reviewed says so instead of showing a number.
export function ListingRating({ rating, reviews }: { rating: number | null; reviews: number }) {
  if (rating === null) return null;
  return <Rating value={rating} count={reviews} />;
}

/* --------------------------------------------------------------- Tour card */

export function TourCard({
  tour,
  className,
  priority,
}: {
  tour: CatalogueTour;
  className?: string;
  priority?: boolean;
}) {
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)]",
        "transition-[transform,box-shadow,border-color] duration-500 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-1 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-float)] has-[a:focus-visible]:shadow-[var(--shadow-float)]",
        className,
      )}
    >
      <Media
        seed={tour.slug}
        src={tour.image}
        alt={`${tour.name} in ${tour.destination}`}
        priority={priority}
        className="aspect-[4/3]"
      >
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          {tour.badge ? <Badge tone="sun">{tour.badge}</Badge> : <span />}
          <span className="tnum rounded-full bg-white/92 px-3 py-1 text-2xs font-semibold text-forest-950 shadow-[0_1px_2px_rgb(8_20_15/0.2)]">
            {tour.durationDays} {tour.durationDays === 1 ? "day" : "days"}
            {tour.nights > 0 ? ` · ${tour.nights} ${tour.nights === 1 ? "night" : "nights"}` : ""}
          </span>
        </div>
        <p className="on-media absolute bottom-4 left-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
          <MapPin className="size-3.5 text-sun-400" />
          {tour.destination}
        </p>
      </Media>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[1.375rem] leading-[1.15]">
            <Link
              href={`/tours/${tour.slug}`}
              className="after:absolute after:inset-0"
            >
              {tour.name}
            </Link>
          </h3>
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full border border-[var(--line)] text-[var(--ink-muted)] transition-colors duration-500 [transition-timing-function:var(--ease-out-expo)] group-hover:border-sun-500 group-hover:bg-sun-500 group-hover:text-forest-950"
          >
            <ArrowUpRight className="size-4" />
          </span>
        </div>

        <p className="mt-2.5 line-clamp-2 text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
          {tour.summary}
        </p>

        <ul className="mt-4 flex flex-wrap gap-1.5">
          {tour.activities.slice(0, 3).map((a) => (
            <li
              key={a}
              className="rounded-full bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] px-2.5 py-1 text-xs text-[var(--ink-muted)]"
            >
              {a}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-5">
          <div className="flex items-end justify-between gap-3 border-t border-[var(--line)] pt-4">
          <PriceFrom amount={tour.priceFrom} unit="/ person" />
          <ListingRating rating={tour.rating} reviews={tour.reviews} />
          </div>
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------- Hotel card */

export function HotelCard({
  hotel,
  className,
}: {
  hotel: CatalogueHotel;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "group relative flex flex-col gap-0 overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] sm:flex-row",
        "transition-[transform,box-shadow,border-color] duration-500 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-1 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-float)] has-[a:focus-visible]:shadow-[var(--shadow-float)]",
        className,
      )}
    >
      <Media
        seed={hotel.slug}
        src={hotel.image}
        alt={hotel.name}
        sizes="(max-width: 640px) 100vw, 220px"
        className="aspect-[16/10] w-full shrink-0 sm:aspect-auto sm:min-h-[13.5rem] sm:w-[42%]"
      >
        {hotel.badge ? (
          <Badge tone="sun" className="absolute left-3 top-3">
            {hotel.badge}
          </Badge>
        ) : null}
      </Media>

      <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
        <p className="flex items-center gap-1 text-xs text-[var(--ink-faint)]">
          {hotel.stars ? (
            <span className="text-sun-600" aria-label={`${hotel.stars} star`}>
              {"★".repeat(hotel.stars)}
            </span>
          ) : null}
          <span className="truncate">{hotel.stars ? "· " : ""}{hotel.location}</span>
        </p>

        <h3 className="mt-2 text-[1.375rem] leading-[1.15]">
          <Link
            href={`/hotels/${hotel.slug}`}
            className="after:absolute after:inset-0"
          >
            {hotel.name}
          </Link>
        </h3>

        <p className="mt-2.5 line-clamp-2 text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
          {hotel.summary}
        </p>

        <ul className="mt-3 flex flex-wrap gap-1.5">
          {hotel.amenities.slice(0, 3).map((a) => (
            <li
              key={a}
              className="rounded-full bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] px-2.5 py-1 text-xs text-[var(--ink-muted)]"
            >
              {a}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-4">
          <PriceFrom amount={hotel.priceFrom} unit="/ night" />
          <ListingRating rating={hotel.rating} reviews={hotel.reviews} />
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------ Vehicle card */

export function VehicleCard({
  vehicle,
  className,
}: {
  vehicle: CatalogueVehicle;
  className?: string;
}) {
  const spec = [
    { icon: Users, label: `${vehicle.seats} seats` },
    { icon: Gauge, label: vehicle.transmission },
    { icon: Fuel, label: vehicle.fuel },
  ];

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)]",
        "transition-[transform,box-shadow,border-color] duration-500 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-1 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-float)] has-[a:focus-visible]:shadow-[var(--shadow-float)]",
        className,
      )}
    >
      <Media
        seed={vehicle.slug}
        src={vehicle.image}
        alt={`${vehicle.make} ${vehicle.model}`}
        className="aspect-[16/10]"
      >
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <Badge tone="forest">{vehicle.category}</Badge>
          {vehicle.badge ? <Badge tone="sun">{vehicle.badge}</Badge> : null}
        </div>
      </Media>

      <div className="flex flex-1 flex-col p-5">
        <p className="tnum text-xs text-[var(--ink-faint)]">
          {vehicle.year} · {vehicle.provider}
        </p>
        <h3 className="mt-1.5 text-xl leading-[1.15]">
          <Link
            href={`/cars/${vehicle.slug}`}
            className="after:absolute after:inset-0"
          >
            {vehicle.make} {vehicle.model}
          </Link>
        </h3>

        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {spec.map((s) => (
            <li
              key={s.label}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)]"
            >
              <s.icon className="size-3.5 text-forest-600" />
              {s.label}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-5">
          <div className="flex items-end justify-between gap-3 border-t border-[var(--line)] pt-4">
            <PriceFrom amount={vehicle.pricePerDay} unit="/ day" />
            <ListingRating rating={vehicle.rating} reviews={vehicle.reviews} />
          </div>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------- Destination panel */

/**
 * A tall photographic panel for the homepage rail. On desktop the rail's CSS
 * (.dest-rail) widens whichever panel is under the pointer, and the container
 * queries below reveal the blurb once a panel is wide enough to hold it — so
 * the text never wraps into a column it has no room in. On phones the panels
 * are a swipe rail and always show everything.
 */
export function DestinationPanel({
  destination,
  index,
  className,
}: {
  destination: Destination;
  index: number;
  className?: string;
}) {
  const hasCounts = destination.stays + destination.tours > 0;
  return (
    <Link
      href={`/tours?q=${encodeURIComponent(destination.name)}`}
      className={cn(
        "group @container relative block min-w-0 overflow-hidden rounded-[var(--radius-card)] bg-forest-950 focus-visible:outline-offset-4",
        className,
      )}
    >
      <Media
        seed={destination.slug}
        src={destinationImages[destination.slug]}
        alt={`${destination.name}, ${destination.region}`}
        sizes="(max-width: 1024px) 80vw, 40vw"
        className="absolute inset-0"
      />
      <div aria-hidden className="scrim-t absolute inset-x-0 top-0 h-28" />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4 text-white sm:p-5">
        <span className="tnum text-xs font-semibold opacity-80">{String(index + 1).padStart(2, "0")}</span>
        {destination.elevation ? (
          <span className="tnum inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/14 px-2.5 py-1 text-2xs font-semibold backdrop-blur-md ring-1 ring-white/25">
            <Mountain className="size-3" aria-hidden />
            <span className="sr-only">Altitude: </span>
            {destination.elevation}
          </span>
        ) : null}
      </div>

      <div className="on-media absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
        <p className="hidden text-2xs font-semibold uppercase tracking-[0.12em] text-sun-300 @[12rem]:block">{destination.region}</p>
        <h3 className="mt-1.5 text-[1.625rem] leading-[1.05] @[17rem]:text-4xl">{destination.name}</h3>
        <div className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-500 [transition-timing-function:var(--ease-out-expo)] @[17rem]:grid-rows-[1fr] @[17rem]:opacity-100">
          <div className="overflow-hidden">
            <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-white/85">{destination.blurb}</p>
            <p className="mt-4 flex items-center gap-3 text-sm font-semibold">
              <span className="inline-flex items-center gap-1.5">
                Explore
                <ArrowUpRight className="size-4 text-sun-400" aria-hidden />
              </span>
              {hasCounts ? (
                <span className="tnum font-normal text-white/70">
                  {[
                    destination.tours > 0 ? `${destination.tours} ${destination.tours === 1 ? "tour" : "tours"}` : null,
                    destination.stays > 0 ? `${destination.stays} ${destination.stays === 1 ? "stay" : "stays"}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

export { Clock };
