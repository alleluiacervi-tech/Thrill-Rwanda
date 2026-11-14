import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { AvailabilityForm, type Resource } from "@/components/dashboard/availability-form";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { db } from "@/lib/db";
import { requireProvider } from "@/lib/session";
import { toUtcDay } from "@/lib/booking";

export default async function ProviderAvailabilityPage() {
  const { providerId } = await requireProvider("/provider/availability");

  const [tours, rooms, vehicles] = await Promise.all([
    db.tour.findMany({ where: { providerId }, select: { id: true, name: true } }),
    db.room.findMany({
      where: { hotel: { providerId } },
      select: { id: true, name: true, hotel: { select: { name: true } } },
    }),
    db.vehicle.findMany({
      where: { providerId },
      select: { id: true, make: true, model: true, year: true },
    }),
  ]);

  const resources: Resource[] = [
    ...tours.map((t) => ({ id: t.id, label: `${t.name} (tour)`, serviceType: "TOUR" as const })),
    ...rooms.map((r) => ({ id: r.id, label: `${r.hotel.name} — ${r.name}`, serviceType: "ROOM" as const })),
    ...vehicles.map((v) => ({ id: v.id, label: `${v.make} ${v.model} ${v.year}`, serviceType: "VEHICLE" as const })),
  ];

  // The next 30 days, so a provider can see at a glance what is sold and
  // what is closed without opening a calendar widget.
  const from = toUtcDay(new Date());
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 30);

  const ids = resources.map((r) => r.id);
  const upcoming = ids.length
    ? await db.availability.findMany({
        where: { resourceId: { in: ids }, day: { gte: from, lt: to } },
        orderBy: { day: "asc" },
      })
    : [];


  // Roll days up per listing: one row per listing, not 30.
  const summary = resources.map((r) => {
    const days = upcoming.filter((a) => a.resourceId === r.id);
    return {
      label: r.label,
      open: days.filter((d) => !d.isBlocked && d.unitsBooked < d.unitsTotal).length,
      sold: days.filter((d) => d.unitsBooked > 0).length,
      closed: days.filter((d) => d.isBlocked).length,
      tracked: days.length,
    };
  });

  return (
    <>
      <DashboardHead
        title="Availability"
        lede="Close dates you can't take, and reopen them when you can. This is what the booking engine checks before it holds a place."
      />

      {resources.length === 0 ? (
        <EmptyPanel
          title="Nothing to manage yet"
          body="Once you have listings, their calendars appear here."
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr]">
          <AvailabilityForm resources={resources} />

          <div className="min-w-0">
            <h2 className="mb-4 text-xl">Next 30 days</h2>
            <TableShell>
              <thead>
                <tr>
                  <Th>Listing</Th>
                  <Th className="text-right">Bookable</Th>
                  <Th className="text-right">With bookings</Th>
                  <Th className="text-right">Closed</Th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <Tr key={s.label}>
                    <Td className="max-w-[18rem] truncate">{s.label}</Td>
                    <Td className="tnum text-right">{s.open}</Td>
                    <Td className="tnum text-right">{s.sold}</Td>
                    <Td className="tnum text-right">{s.closed}</Td>
                  </Tr>
                ))}
              </tbody>
            </TableShell>
            <p className="mt-3 text-2xs text-[var(--ink-faint)]">
              Counts are days in the next 30. A day can be both bookable and
              have bookings on it if capacity remains.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
