import { notFound } from "next/navigation";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { VenueForm } from "@/components/dashboard/venue-form";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = {
  title: "Edit venue",
  robots: { index: false, follow: false },
};

export default async function AdminEditVenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin("/admin/venues");

  // A malformed id is simply not found, rather than a database error.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const venue = await db.venue.findUnique({
    where: { id },
    select: {
      id: true, name: true, kind: true, location: true, capacity: true,
      description: true, features: true, images: true, isPublished: true,
    },
  });
  if (!venue) notFound();

  return (
    <>
      <DashboardHead
        back={{ href: "/admin/venues", label: "Back to venues" }}
        title={`Edit ${venue.name}`}
        lede={
          venue.isPublished
            ? "This venue is on the public page. Changes show there as soon as you save."
            : "This venue is a draft. Publish it from the venue list when it is ready."
        }
      />
      <VenueForm existing={venue} />
    </>
  );
}
