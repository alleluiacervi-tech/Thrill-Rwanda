import { getSite } from "@/lib/settings";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { ActionButton } from "@/components/dashboard/action-button";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/primitives";
import { setListingPublished } from "@/app/actions/provider";
import { Pagination } from "@/components/ui/pagination";
import { paginate } from "@/lib/pagination";
import { db } from "@/lib/db";
import { requireProvider } from "@/lib/session";
import { formatMoney } from "@/lib/utils";

// Each section pages independently, so opening page 2 of the vehicles doesn't move the tours.
const PER_SECTION = 10;

export default async function ProviderListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const site = await getSite();
  const { providerId, kinds } = await requireProvider("/provider/listings");

  const params = await searchParams;
  // Set when a guard turned them away from a category they aren't approved for.
  const denied = typeof params.denied === "string" ? params.denied : "";
  const [tourCount, hotelCount, vehicleCount] = await Promise.all([
    db.tour.count({ where: { providerId } }),
    db.hotel.count({ where: { providerId } }),
    db.vehicle.count({ where: { providerId } }),
  ]);

  const tourPage = paginate(params, tourCount, PER_SECTION, "tours");
  const hotelPage = paginate(params, hotelCount, PER_SECTION, "hotels");
  const vehiclePage = paginate(params, vehicleCount, PER_SECTION, "vehicles");

  const [tours, hotels, vehicles] = await Promise.all([
    db.tour.findMany({
      where: { providerId },
      orderBy: { name: "asc" },
      skip: tourPage.skip,
      take: tourPage.take,
      select: { id: true, name: true, slug: true, destination: true, priceMinor: true, currency: true, isPublished: true, maxParticipants: true },
    }),
    db.hotel.findMany({
      where: { providerId },
      orderBy: { name: "asc" },
      skip: hotelPage.skip,
      take: hotelPage.take,
      select: {
        id: true, name: true, slug: true, location: true, isPublished: true,
        rooms: { select: { id: true, name: true, quantity: true, pricePerNightMinor: true, currency: true, isPublished: true } },
      },
    }),
    db.vehicle.findMany({
      where: { providerId },
      orderBy: [{ make: "asc" }, { model: "asc" }],
      skip: vehiclePage.skip,
      take: vehiclePage.take,
      select: { id: true, make: true, model: true, year: true, slug: true, category: true, pricePerDayMinor: true, currency: true, isPublished: true },
    }),
  ]);

  const total = tourCount + hotelCount + vehicleCount;

  return (
    <>
      <DashboardHead
        title="Listings"
        lede={`Everything you offer through ${site.name}. Unpublishing hides a listing from search without deleting it or affecting existing bookings.`}
        action={
          <div className="flex flex-wrap gap-2">
            {kinds.includes("TOUR") && (
              <Button href="/provider/listings/tours/new" variant="quiet">
                <Plus className="size-4" />
                Tour
              </Button>
            )}
            {kinds.includes("HOTEL") && (
              <Button href="/provider/listings/hotels/new" variant="quiet">
                <Plus className="size-4" />
                Property
              </Button>
            )}
            {kinds.includes("CAR") && (
              <Button href="/provider/listings/vehicles/new" variant="accent">
                <Plus className="size-4" />
                Vehicle
              </Button>
            )}
          </div>
        }
      />

      {denied ? (
        <p
          role="alert"
          className="mb-6 rounded-[var(--radius-inset)] border border-clay-300 bg-clay-100 p-4 text-sm text-clay-900"
        >
          Your account isn&rsquo;t approved to list{" "}
          {denied === "car" ? "vehicles" : denied === "hotel" ? "properties" : "tours"}. Contact
          {site.name} if you&rsquo;d like this category added.
        </p>
      ) : null}

      {total === 0 ? (
        <EmptyPanel
          title="No listings yet"
          body="Add your first tour, property or vehicle. Everything starts as a draft — nothing is bookable until you publish it."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {kinds.includes("TOUR") && (
                <Button href="/provider/listings/tours/new" variant="quiet">
                  Add a tour
                </Button>
              )}
              {kinds.includes("HOTEL") && (
                <Button href="/provider/listings/hotels/new" variant="quiet">
                  Add a property
                </Button>
              )}
              {kinds.includes("CAR") && (
                <Button href="/provider/listings/vehicles/new" variant="accent">
                  Add a vehicle
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <div className="space-y-10">
          {tours.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl">Tours &amp; safaris</h2>
              <TableShell>
                <thead>
                  <tr><Th>Tour</Th><Th>Destination</Th><Th className="text-right">Price</Th><Th>Seats</Th><Th>Status</Th><Th /></tr>
                </thead>
                <tbody>
                  {tours.map((t) => (
                    <Tr key={t.id}>
                      <Td>
                        <Link href={`/tours/${t.slug}`} className="link-draw font-medium">{t.name}</Link>
                      </Td>
                      <Td>{t.destination}</Td>
                      <Td className="tnum whitespace-nowrap text-right">{formatMoney(t.priceMinor, t.currency)}</Td>
                      <Td className="tnum">{t.maxParticipants}</Td>
                      <Td><PublishBadge published={t.isPublished} /></Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-3">
                          <PublishToggle kind="TOUR" id={t.id} published={t.isPublished} />
                          <EditLink href={`/provider/listings/tours/${t.id}/edit`} />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableShell>
              <Pagination
                page={tourPage}
                pathname="/provider/listings"
                params={params}
                label="tours"
                param="tours"
              />
            </section>
          )}

          {hotels.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl">Hotels &amp; rooms</h2>
              <div className="space-y-5">
                {hotels.map((h) => (
                  <div key={h.id} className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/hotels/${h.slug}`} className="link-draw text-lg font-medium">{h.name}</Link>
                        <p className="text-2xs text-[var(--ink-faint)]">{h.location}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <PublishBadge published={h.isPublished} />
                        <PublishToggle kind="HOTEL" id={h.id} published={h.isPublished} />
                        <EditLink href={`/provider/listings/hotels/${h.id}/edit`} />
                      </div>
                    </div>

                    <ul className="mt-4 divide-y divide-[var(--line)] border-t border-[var(--line)]">
                      {h.rooms.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{r.name}</p>
                            <p className="tnum text-2xs text-[var(--ink-faint)]">
                              {r.quantity} {r.quantity === 1 ? "unit" : "units"} · {formatMoney(r.pricePerNightMinor, r.currency)} / night
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <PublishBadge published={r.isPublished} />
                            <PublishToggle kind="ROOM" id={r.id} published={r.isPublished} />
                          </div>
                        </li>
                      ))}
                    </ul>

                    <p className="mt-3 text-2xs text-[var(--ink-faint)]">
                      Room names, prices and counts are edited on the property.
                      Publishing is per room, so a type you are not selling can
                      be hidden without touching the others.
                    </p>
                  </div>
                ))}
              </div>
              <Pagination
                page={hotelPage}
                pathname="/provider/listings"
                params={params}
                label="properties"
                param="hotels"
              />
            </section>
          )}

          {vehicles.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl">Vehicles</h2>
              <TableShell>
                <thead>
                  <tr><Th>Vehicle</Th><Th>Category</Th><Th className="text-right">Per day</Th><Th>Status</Th><Th /></tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <Tr key={v.id}>
                      <Td>
                        <Link href={`/cars/${v.slug}`} className="link-draw font-medium">{v.make} {v.model}</Link>
                        <span className="tnum block text-2xs text-[var(--ink-faint)]">{v.year}</span>
                      </Td>
                      <Td>{v.category}</Td>
                      <Td className="tnum whitespace-nowrap text-right">{formatMoney(v.pricePerDayMinor, v.currency)}</Td>
                      <Td><PublishBadge published={v.isPublished} /></Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-3">
                          <PublishToggle kind="VEHICLE" id={v.id} published={v.isPublished} />
                          <EditLink href={`/provider/listings/vehicles/${v.id}/edit`} />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableShell>
              <Pagination
                page={vehiclePage}
                pathname="/provider/listings"
                params={params}
                label="vehicles"
                param="vehicles"
              />
            </section>
          )}
        </div>
      )}
    </>
  );
}

function EditLink({ href }: { href: string }) {
  return (
    <Link href={href} className="link-draw text-2xs text-clay-700">
      Edit
    </Link>
  );
}

function PublishBadge({ published }: { published: boolean }) {
  return (
    <Badge tone={published ? "forest" : "outline"}>
      {published ? "Live" : "Hidden"}
    </Badge>
  );
}

function PublishToggle({
  kind,
  id,
  published,
}: {
  kind: "TOUR" | "HOTEL" | "VEHICLE" | "ROOM";
  id: string;
  published: boolean;
}) {
  return (
    <ActionButton
      action={setListingPublished}
      fields={{ kind, id, publish: published ? "false" : "true" }}
      variant={published ? "ghost" : "primary"}
    >
      {published ? "Unpublish" : "Publish"}
    </ActionButton>
  );
}
