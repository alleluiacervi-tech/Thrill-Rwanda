import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { BusinessVenueForm } from "@/components/dashboard/business-venue-form";
import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { Panel, StatGrid, StatTile, StatusPill } from "@/components/dashboard/dash-ui";
import { readBusinessVenues } from "@/lib/business-venue-catalogue";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Business venues", robots: { index: false, follow: false } };

export default async function BusinessVenuesPage() {
  await requireAdmin("/admin/business-venues");
  const properties = await readBusinessVenues(false);
  const rooms = properties?.flatMap((p) => p.spaces) ?? [];
  return (
    <>
      <DashboardHead
        title="Business venues"
        lede="Meeting properties and their rooms, as shown in Thrill Events & Business."
        action={
          <div className="flex gap-4 text-sm">
            <Link href="/events-business#venues" className="inline-flex items-center gap-1.5 font-medium text-lake-700 hover:underline">
              Public directory <ExternalLink className="size-3.5" />
            </Link>
            <Link href="/admin/launch" className="font-medium text-lake-700 hover:underline">Visibility</Link>
          </div>
        }
      />
      {properties === null ? (
        <EmptyPanel
          title="Venue editing is waiting on a database update"
          body="Ask the deployment owner to apply the business venue migration."
        />
      ) : (
        <>
          <StatGrid>
            <StatTile label="Properties" value={properties.length} />
            <StatTile label="Published" value={properties.filter((p) => p.isPublished).length} tone="good" />
            <StatTile label="Rooms & halls" value={rooms.length} />
            <StatTile label="Rooms published" value={rooms.filter((r) => r.isPublished).length} note="visible publicly" />
          </StatGrid>
          <div className="mb-6">
            <BusinessVenueForm mode="venue" />
          </div>
          {properties.length ? (
            <div className="grid gap-5">
              {properties.map(({ spaces, ...property }) => (
                <Panel
                  key={property.id}
                  title={property.name}
                  description={`${property.kind} · ${spaces.length} ${spaces.length === 1 ? "room" : "rooms"}`}
                  aside={<StatusPill tone={property.isPublished ? "good" : "neutral"}>{property.isPublished ? "Published" : "Draft"}</StatusPill>}
                >
                  <div className="grid gap-2.5">
                    <BusinessVenueForm mode="venue" entry={{ ...property, updatedAt: property.updatedAt.toISOString() }} />
                    <p className="mt-3 text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Rooms and halls</p>
                    {spaces.map((room) => (
                      <BusinessVenueForm
                        key={room.id}
                        mode="room"
                        venueId={property.id}
                        entry={{ ...room, updatedAt: room.updatedAt.toISOString(), capacities: room.capacities as Record<string, number> }}
                      />
                    ))}
                    <BusinessVenueForm mode="room" venueId={property.id} />
                  </div>
                </Panel>
              ))}
            </div>
          ) : (
            <EmptyPanel title="No venues added yet" body="The public directory also includes the sourced Kigali venues." />
          )}
        </>
      )}
    </>
  );
}
