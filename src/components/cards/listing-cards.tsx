import Link from "next/link";
import { ArrowUpRight, Clock, Fuel, Gauge, MapPin, Users } from "lucide-react";
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
      <span className="text-2xs uppercase tracking-[0.14em] text-[var(--ink-faint)]">
        from
      </span>
      <span className="tnum font-display text-xl font-semibold text-[var(--ink)]">
        {formatMoney(amount)}
      </span>
      <span className="text-2xs text-[var(--ink-faint)]">{unit}</span>
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
        "transition-all duration-500 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-1 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-float)]",
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
          {tour.badge ? <Badge tone="ember">{tour.badge}</Badge> : <span />}
          <span className="rounded-full bg-forest-950/55 px-3 py-1 text-2xs font-semibold text-bone-50 backdrop-blur">
            {tour.durationDays}D / {tour.nights}N
          </span>
        </div>
        <p className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 text-sm font-medium text-bone-50">
          <MapPin className="size-3.5 text-ember-400" />
          {tour.destination}
        </p>
      </Media>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg leading-snug">
            <Link
              href={`/tours/${tour.slug}`}
              className="after:absolute after:inset-0"
            >
              {tour.name}
            </Link>
          </h3>
          <ArrowUpRight className="mt-1 size-4 shrink-0 text-[var(--ink-faint)] transition-transform duration-500 [transition-timing-function:var(--ease-out-expo)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ember-500" />
        </div>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--ink-muted)]">
          {tour.summary}
        </p>

        <ul className="mt-4 flex flex-wrap gap-1.5">
          {tour.activities.slice(0, 3).map((a) => (
            <li
              key={a}
              className="rounded-full bg-[color-mix(in_oklab,var(--ink)_5%,transparent)] px-2.5 py-1 text-2xs text-[var(--ink-muted)]"
            >
              {a}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <PriceFrom amount={tour.priceFrom} unit="/ person" />
          <ListingRating rating={tour.rating} reviews={tour.reviews} />
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
        "transition-all duration-500 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-1 hover:shadow-[var(--shadow-float)]",
        className,
      )}
    >
      <Media
        seed={hotel.slug}
        src={hotel.image}
        alt={hotel.name}
        sizes="(max-width: 640px) 100vw, 220px"
        className="aspect-[16/10] w-full shrink-0 sm:aspect-auto sm:w-[42%]"
      >
        {hotel.badge ? (
          <Badge tone="ember" className="absolute left-3 top-3">
            {hotel.badge}
          </Badge>
        ) : null}
      </Media>

      <div className="flex min-w-0 flex-1 flex-col p-5">
        <p className="flex items-center gap-1 text-2xs text-[var(--ink-faint)]">
          {hotel.stars ? (
            <span className="text-ember-500" aria-label={`${hotel.stars} star`}>
              {"★".repeat(hotel.stars)}
            </span>
          ) : null}
          <span className="truncate">{hotel.stars ? "· " : ""}{hotel.location}</span>
        </p>

        <h3 className="mt-2 text-lg leading-snug">
          <Link
            href={`/hotels/${hotel.slug}`}
            className="after:absolute after:inset-0"
          >
            {hotel.name}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--ink-muted)]">
          {hotel.summary}
        </p>

        <ul className="mt-3 flex flex-wrap gap-1.5">
          {hotel.amenities.slice(0, 3).map((a) => (
            <li
              key={a}
              className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-2xs text-[var(--ink-muted)]"
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
        "transition-all duration-500 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-1 hover:shadow-[var(--shadow-float)]",
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
          {vehicle.badge ? <Badge tone="ember">{vehicle.badge}</Badge> : null}
        </div>
      </Media>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-2xs uppercase tracking-[0.14em] text-[var(--ink-faint)]">
          {vehicle.year} · {vehicle.provider}
        </p>
        <h3 className="mt-1.5 text-lg leading-snug">
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
              className="inline-flex items-center gap-1.5 text-2xs text-[var(--ink-muted)]"
            >
              <s.icon className="size-3.5 text-clay-600" />
              {s.label}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <PriceFrom amount={vehicle.pricePerDay} unit="/ day" />
          <ListingRating rating={vehicle.rating} reviews={vehicle.reviews} />
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------- Destination tile */

export function DestinationTile({
  destination,
  className,
  size = "sm",
}: {
  destination: Destination;
  className?: string;
  size?: "sm" | "lg";
}) {
  return (
    <Link
      href={`/tours?q=${encodeURIComponent(destination.name)}`}
      className={cn(
        "group relative block overflow-hidden rounded-[var(--radius-card)]",
        "transition-transform duration-500 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-1",
        className,
      )}
    >
      <Media
        seed={destination.slug}
        src={destinationImages[destination.slug]}
        alt={`${destination.name}, ${destination.region}`}
        sizes="(max-width: 768px) 50vw, 33vw"
        className="h-full w-full"
      />
      <div className="on-media absolute inset-0 flex flex-col justify-end p-5">
        <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-ember-400">
          {destination.region}
        </p>
        <h3
          className={cn(
            "mt-1 text-bone-50",
            size === "lg" ? "text-4xl sm:text-5xl" : "text-2xl",
          )}
        >
          {destination.name}
        </h3>
        {size === "lg" ? (
          <p className="mt-2 max-w-xs text-sm text-bone-100/85">
            {destination.blurb}
          </p>
        ) : null}
        {destination.stays + destination.tours > 0 ? (
          <p className="mt-3 flex items-center gap-3 text-2xs text-bone-100/70">
            {destination.tours > 0 ? (
              <span className="tnum">
                {destination.tours} {destination.tours === 1 ? "tour" : "tours"}
              </span>
            ) : null}
            {destination.tours > 0 && destination.stays > 0 ? <span aria-hidden>·</span> : null}
            {destination.stays > 0 ? (
              <span className="tnum">
                {destination.stays} {destination.stays === 1 ? "stay" : "stays"}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export { Clock };
