import Link from "next/link";
import { BusinessVenueForm } from "@/components/dashboard/business-venue-form";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function BusinessVenuesPage() {
  await requireAdmin("/admin/business-venues");
  const properties = await db.businessVenue.findMany({
    orderBy: { name: "asc" },
    include: { spaces: { orderBy: { name: "asc" } } },
  });
  return (
    <>
      <DashboardHead title="Business venues and meeting rooms" lede="Add a property, enter its rooms and layouts, then publish the property and at least one room to show it in Thrill Events & Business." />
      <div className="mb-6 flex flex-wrap gap-4">
        <Link href="/events-business#venues" className="underline">View public directory</Link>
        <Link href="/admin/launch" className="underline">Review Events visibility</Link>
      </div>
      <BusinessVenueForm mode="venue" />
      {properties.length ? (
        <div className="mt-6 space-y-6">
          {properties.map(({ spaces, ...property }) => (
            <section key={property.id} className="space-y-3 rounded-2xl border border-[var(--line)] p-5">
              <h2 className="text-xl">{property.name}</h2>
              <BusinessVenueForm mode="venue" entry={{ ...property, updatedAt: property.updatedAt.toISOString() }} />
              <h3 className="font-semibold">Rooms and halls</h3>
              <BusinessVenueForm mode="room" venueId={property.id} />
              {spaces.map((room) => (
                <BusinessVenueForm key={room.id} mode="room" venueId={property.id} entry={{
                  ...room,
                  updatedAt: room.updatedAt.toISOString(),
                  capacities: room.capacities as Record<string, number>,
                }} />
              ))}
            </section>
          ))}
        </div>
      ) : <p className="mt-5">No venues added here yet. The directory also includes the sourced Kigali venues.</p>}
    </>
  );
}
