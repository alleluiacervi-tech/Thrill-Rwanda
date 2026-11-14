import { notFound } from "next/navigation";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { HotelForm } from "@/components/dashboard/hotel-form";
import { db } from "@/lib/db";
import { requireProviderFor } from "@/lib/session";

export const metadata = {
  title: "Edit property",
  robots: { index: false, follow: false },
};

export default async function EditHotelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { providerId } = await requireProviderFor("HOTEL", "/provider/listings");

  // Scoped read: another provider's id is simply not found, not forbidden.
  const hotel = await db.hotel.findFirst({
    where: { id, providerId },
    select: {
      id: true, name: true, location: true, stars: true, description: true,
      amenities: true, images: true,
      rooms: {
        // Stable order, so the form's rows don't reshuffle between visits.
        // Id breaks ties — two rooms may legitimately share a name.
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: {
          id: true, name: true, capacity: true, quantity: true,
          pricePerNightMinor: true,
        },
      },
    },
  });
  if (!hotel) notFound();

  return (
    <>
      <DashboardHead
        back={{ href: "/provider/listings", label: "Back to listings" }}
        title={`Edit ${hotel.name}`}
        lede="Price changes apply to new bookings only. A room count can't drop below what's already booked on any night, and rooms are hidden by unpublishing rather than deleted."
      />

      <HotelForm existing={hotel} />
    </>
  );
}
