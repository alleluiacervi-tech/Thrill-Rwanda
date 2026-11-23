import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { ActionButton } from "@/components/dashboard/action-button";
import { DeleteListingButton } from "@/components/dashboard/delete-listing-button";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { StatGrid, StatTile, StatusPill, Toolbar } from "@/components/dashboard/dash-ui";
import { adminSetListingPublished } from "@/app/actions/admin";
import { TableSearch } from "@/components/dashboard/table-search";
import { searchTerm } from "@/lib/table-query";
import { Pagination } from "@/components/ui/pagination";
import { paginateList } from "@/lib/pagination";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatMoney } from "@/lib/utils";

type Row = {
  kind: "TOUR" | "HOTEL" | "VEHICLE";
  id: string;
  name: string;
  provider: string;
  detail: string;
  price: string;
  isPublished: boolean;
  bookings: number;
  roomTypes?: number;
  publishedRooms?: number;
};

const KINDS = new Set(["TOUR", "HOTEL", "VEHICLE"]);

/** Row kind to the URL segment the shared edit route expects. */
const SEGMENT = { TOUR: "tours", HOTEL: "hotels", VEHICLE: "vehicles" } as const;

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/listings");

  const raw = await searchParams;
  const kindParam = Array.isArray(raw.kind) ? raw.kind[0] : raw.kind;
  const kind = kindParam && KINDS.has(kindParam) ? (kindParam as Row["kind"]) : "";

  const [tours, hotels, vehicles] = await Promise.all([
    db.tour.findMany({ include: { provider: { select: { businessName: true } } }, orderBy: { name: "asc" } }),
    db.hotel.findMany({
      include: {
        provider: { select: { businessName: true } },
        _count: { select: { rooms: true } },
        rooms: { select: { id: true, isPublished: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.vehicle.findMany({ include: { provider: { select: { businessName: true } } }, orderBy: { make: "asc" } }),
  ]);

  // One grouped count for every listing; a hotel is booked through its rooms.
  const bookingGroups = await db.booking.groupBy({ by: ["resourceId"], _count: { _all: true } });
  const booked = new Map(bookingGroups.map((g) => [g.resourceId, g._count._all]));
  const bookingsOf = (ids: string[]) => ids.reduce((n, rid) => n + (booked.get(rid) ?? 0), 0);

  const all: Row[] = [
    ...tours.map((t) => ({
      kind: "TOUR" as const, id: t.id, name: t.name,
      provider: t.provider.businessName, detail: t.destination,
      price: formatMoney(t.priceMinor, t.currency), isPublished: t.isPublished,
      bookings: bookingsOf([t.id]),
    })),
    ...hotels.map((h) => ({
      kind: "HOTEL" as const, id: h.id, name: h.name,
      provider: h.provider.businessName, detail: `${h.location} · ${h._count.rooms} room types`,
      price: "—", isPublished: h.isPublished,
      bookings: bookingsOf(h.rooms.map((r) => r.id)), roomTypes: h._count.rooms,
      publishedRooms: h.rooms.filter((room) => room.isPublished).length,
    })),
    ...vehicles.map((v) => ({
      kind: "VEHICLE" as const, id: v.id, name: `${v.make} ${v.model}`,
      provider: v.provider.businessName, detail: `${v.category} · ${v.year}`,
      price: formatMoney(v.pricePerDayMinor, v.currency), isPublished: v.isPublished,
      bookings: bookingsOf([v.id]),
    })),
  ];

  const q = searchTerm(raw).toLowerCase();
  const matches = (r: Row) =>
    !q ||
    r.name.toLowerCase().includes(q) ||
    r.provider.toLowerCase().includes(q) ||
    r.detail.toLowerCase().includes(q);

  const filtered = (kind ? all.filter((r) => r.kind === kind) : all).filter(matches);
  const { page, items: rows } = paginateList(raw, filtered);

  const chips = [
    { value: "", label: "All", count: all.length },
    { value: "TOUR", label: "Tours & safaris", count: tours.length },
    { value: "HOTEL", label: "Hotels", count: hotels.length },
    { value: "VEHICLE", label: "Vehicles", count: vehicles.length },
  ];

  const live = all.filter((r) => r.isPublished && !(r.kind === "HOTEL" && !r.publishedRooms)).length;
  const needsRoom = all.filter((r) => r.kind === "HOTEL" && r.isPublished && !r.publishedRooms).length;
  const hidden = all.filter((r) => !r.isPublished).length;

  const TITLE: Record<string, string> = {
    "": "All listings",
    TOUR: "Tours & safaris",
    HOTEL: "Hotels & rooms",
    VEHICLE: "Vehicles",
  };

  return (
    <>
      <DashboardHead
        title={TITLE[kind]}
        lede="Tours, properties and vehicles. A hotel needs a published room type to go live."
        action={
          <div className="flex flex-wrap gap-2">
            <Button href="/admin/listings/new/tours" variant="quiet">
              <Plus className="size-4" />
              Tour
            </Button>
            <Button href="/admin/listings/new/hotels" variant="quiet">
              <Plus className="size-4" />
              Property
            </Button>
            <Button href="/admin/listings/new/vehicles" variant="accent">
              <Plus className="size-4" />
              Vehicle
            </Button>
          </div>
        }
      />

      <StatGrid>
        <StatTile label="Listings" value={all.length} href="/admin/listings" />
        <StatTile label="Live" value={live} tone="good" note="visible to travellers" />
        <StatTile label="Hidden" value={hidden} note="unpublished" />
        <StatTile label="Hotels needing a room" value={needsRoom} tone={needsRoom ? "alert" : "good"} note="published, no room live" href="/admin/listings?kind=HOTEL" />
      </StatGrid>

      <Toolbar>
        <TableSearch
          className="sm:w-72"
          pathname="/admin/listings"
          placeholder="Listing, provider or destination"
        />
      </Toolbar>

      <FilterChips
        basePath="/admin/listings"
        param="kind"
        current={kind}
        chips={chips}
        label="Filter by listing type"
      />

      {rows.length === 0 ? (
        <EmptyPanel
          title={kind ? "Nothing of that type yet" : "No listings yet"}
          body={
            kind
              ? "Try another type, or wait for a provider to add one."
              : "Choose Tour, Property or Vehicle above to add a listing for an approved provider."
          }
        />
      ) : (
        <TableShell>
          <thead>
            <tr><Th>Listing</Th><Th>Type</Th><Th>Provider</Th><Th className="text-right">Price</Th><Th>Status</Th><Th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={`${r.kind}:${r.id}`}>
                <Td>
                  <Link href={`/admin/listings/${SEGMENT[r.kind]}/${r.id}/edit`} className="link-draw block max-w-[16rem] truncate font-medium">{r.name}</Link>
                  <span className="block max-w-[16rem] truncate text-2xs text-[var(--ink-faint)]">{r.detail}</span>
                  {r.kind === "HOTEL" && <span className="block text-2xs">{r.publishedRooms} published room types</span>}
                </Td>
                <Td className="whitespace-nowrap text-xs text-[var(--ink-muted)]">{r.kind === "TOUR" ? "Tour" : r.kind === "HOTEL" ? "Hotel" : "Vehicle"}</Td>
                <Td className="max-w-[12rem] truncate">{r.provider}</Td>
                <Td className="tnum whitespace-nowrap text-right">{r.price}</Td>
                <Td>
                  <StatusPill tone={!r.isPublished ? "neutral" : r.kind === "HOTEL" && !r.publishedRooms ? "warn" : "good"}>
                    {r.isPublished ? r.kind === "HOTEL" && !r.publishedRooms ? "Needs a published room" : "Published" : "Hidden"}
                  </StatusPill>
                </Td>
                <Td>
                  <div className="flex items-center gap-3 whitespace-nowrap">
                    <ActionButton
                      action={adminSetListingPublished}
                      fields={{ kind: r.kind, id: r.id, publish: r.isPublished ? "false" : "true" }}
                      variant={r.isPublished ? "ghost" : "primary"}
                    >
                      {r.isPublished ? "Unpublish" : "Publish"}
                    </ActionButton>
                    <Link
                      href={`/admin/listings/${SEGMENT[r.kind]}/${r.id}/edit`}
                      className="link-draw text-2xs text-clay-700"
                    >
                      Edit
                    </Link>
                    <DeleteListingButton
                      kind={r.kind}
                      id={r.id}
                      name={r.name}
                      bookings={r.bookings}
                      roomTypes={r.roomTypes}
                    />
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <Pagination page={page} pathname="/admin/listings" params={raw} label="listings" />
    </>
  );
}
