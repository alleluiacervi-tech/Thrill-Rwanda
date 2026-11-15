import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fuel, Gauge, ShieldCheck, Users } from "lucide-react";
import { ListingGallery } from "@/components/ui/listing-gallery";
import { PageShell, Breadcrumbs } from "@/components/layout/page-shell";
import { BookingPanel } from "@/components/booking/booking-panel";
import { VehicleCard } from "@/components/cards/listing-cards";
import {
  Badge,
  Container,
  Eyebrow,
  Rating,
  SectionHead,
} from "@/components/ui/primitives";
import { getVehicle, listVehicles } from "@/lib/catalogue";
import { formatMoney } from "@/lib/utils";
import { damageLiabilityStatement, getSiteSettings } from "@/lib/settings";
import { getSite } from "@/lib/settings";

// Prebuild the pages that exist now; any listing added later renders on its first visit.
export const revalidate = 300;

export async function generateStaticParams() {
  try {
    return (await listVehicles()).map((x) => ({ slug: x.slug }));
  } catch {
    // An unreachable database at build time should not fail the deploy.
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const site = await getSite();
  const { slug } = await params;
  const v = await getVehicle(slug);
  if (!v) return { title: "Vehicle not found" };

  const name = `${v.make} ${v.model} (${v.year})`;
  return {
    title: `${name} hire`,
    description: `Hire a ${name} in Rwanda — ${v.seats} seats, ${v.transmission.toLowerCase()}, ${v.fuel.toLowerCase()}. ${v.features.join(", ")}.`,
    alternates: { canonical: `/cars/${v.slug}` },
    openGraph: { title: `${name} · ${site.name}` },
  };
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vehicle = await getVehicle(slug);
  if (!vehicle) notFound();

  const name = `${vehicle.make} ${vehicle.model}`;
  const { depositPercent, damageLiabilityText } = await getSiteSettings();
  const related = (await listVehicles()).filter((v) => v.slug !== vehicle.slug).slice(0, 3);

  const spec = [
    { icon: Users, label: "Seats", value: String(vehicle.seats) },
    { icon: Gauge, label: "Transmission", value: vehicle.transmission },
    { icon: Fuel, label: "Fuel", value: vehicle.fuel },
  ];

  return (
    <PageShell>
      {/* A car crops badly full-bleed, so the photos sit in a frame below the title instead. */}
      <section className="border-b border-[var(--line)] bg-[var(--paper-raised)] pb-8 pt-8">
        <Container wide>
          <Breadcrumbs
            items={[{ label: "Car Hire", href: "/cars" }, { label: name }]}
            className="mb-6"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="forest">{vehicle.category}</Badge>
            {vehicle.badge ? <Badge tone="sun">{vehicle.badge}</Badge> : null}
          </div>
          <h1 className="mt-4 text-display-sm">
            {name}{" "}
            <span className="tnum font-sans text-2xl font-normal text-[var(--ink-faint)]">
              {vehicle.year}
            </span>
          </h1>
          {vehicle.rating !== null ? (
            <div className="mt-4">
              <Rating value={vehicle.rating} count={vehicle.reviews} />
            </div>
          ) : null}
        </Container>
      </section>

      <Container wide className="grid gap-14 py-12 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
        <div className="min-w-0">
          <ListingGallery
            seed={vehicle.slug}
            images={vehicle.images}
            alt={name}
            layout="framed"
            className="mb-10 aspect-[16/10] w-full"
          />

          <dl className="grid grid-cols-3 gap-4">
            {spec.map((s) => (
              <div
                key={s.label}
                className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-5"
              >
                <dt className="flex items-center gap-2 text-2xs uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  <s.icon className="size-3.5 text-clay-600" />
                  {s.label}
                </dt>
                <dd className="mt-2 font-display text-xl font-semibold">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>

          <section className="mt-14">
            <Eyebrow>What the hire price includes</Eyebrow>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {vehicle.features.map((f) => (
                <li
                  key={f}
                  className="rounded-[var(--radius-inset)] border border-[var(--line)] px-4 py-3 text-sm text-[var(--ink-muted)]"
                >
                  {f}
                </li>
              ))}
              {vehicle.driverPerDay ? (
                <li className="rounded-[var(--radius-inset)] border border-[var(--line)] px-4 py-3 text-sm text-[var(--ink-muted)]">
                  Driver available at {formatMoney(vehicle.driverPerDay)} per day
                </li>
              ) : (
                <li className="rounded-[var(--radius-inset)] border border-[var(--line)] px-4 py-3 text-sm text-[var(--ink-muted)]">
                  Self-drive only
                </li>
              )}
            </ul>

            {vehicle.insuranceCharge ? (
              <p className="mt-4 rounded-[var(--radius-inset)] border border-clay-300 bg-clay-100 p-4 text-2xs leading-relaxed text-clay-900">
                {damageLiabilityStatement(
                  damageLiabilityText,
                  formatMoney(vehicle.insuranceCharge),
                )}{" "}
                You accept this when you book.
              </p>
            ) : null}
          </section>

          <section className="mt-14">
            <Eyebrow>Before you drive</Eyebrow>
            <ul className="mt-6 space-y-3 text-sm leading-relaxed text-[var(--ink-muted)]">
              <li>
                Valid driving licence held for at least two years, plus a
                passport or national ID at collection.
              </li>
              <li>
                Insurance coverage and excess require confirmation. Any security
                deposit is taken at handover and released on return.
              </li>
              <li>
                Collection from Kigali (Kigali International Airport or the city centre).
                Delivery to your hotel can be arranged.
              </li>
            </ul>
          </section>

          <section className="mt-14 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-sunken)] p-7">
            <h3 className="flex items-center gap-2.5 text-lg">
              <ShieldCheck className="size-5 text-clay-700" />
              Supplied by {vehicle.provider}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
              Ask the desk to confirm the operator, driver arrangements, insurance terms and handover requirements for your dates.
            </p>
          </section>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <BookingPanel
            title={`${name} (${vehicle.year})`}
            slug={vehicle.slug}
            unitLabel="per day"
            priceMinor={vehicle.pricePerDay}
            maxGuests={vehicle.seats}
            mode="VEHICLE"
            depositPercent={depositPercent}
            driverPerDay={vehicle.driverPerDay}
            insuranceCharge={vehicle.insuranceCharge}
            damageStatement={
              vehicle.insuranceCharge
                ? damageLiabilityStatement(
                    damageLiabilityText,
                    formatMoney(vehicle.insuranceCharge),
                  )
                : undefined
            }
          />
        </aside>
      </Container>

      <section className="border-t border-[var(--line)] py-20">
        <Container wide>
          <SectionHead eyebrow="Also available" title="Other vehicles" />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((v) => (
              <VehicleCard key={v.slug} vehicle={v} />
            ))}
          </div>
        </Container>
      </section>
    </PageShell>
  );
}
