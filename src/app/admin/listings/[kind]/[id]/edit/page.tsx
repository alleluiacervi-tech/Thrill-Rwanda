import { notFound } from "next/navigation";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { HotelForm } from "@/components/dashboard/hotel-form";
import { TourForm } from "@/components/dashboard/tour-form";
import { VehicleForm } from "@/components/dashboard/vehicle-form";
import { backToListings } from "@/app/admin/listings/new/shared";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// One route for all three types — they differ only in which form renders.
// No owner picker: editing must not reassign a listing that has bookings.

export const metadata = {
  title: "Edit listing",
  robots: { index: false, follow: false },
};

const KINDS = ["tours", "hotels", "vehicles"] as const;
type Kind = (typeof KINDS)[number];

export default async function AdminEditListingPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  await requireAdmin("/admin/listings");

  if (!KINDS.includes(kind as Kind)) notFound();

  if (kind === "vehicles") {
    const vehicle = await db.vehicle.findUnique({
      where: { id },
      select: {
        id: true, make: true, model: true, year: true, category: true,
        seats: true, transmission: true, fuelType: true, quantity: true,
        pricePerDayMinor: true, driverPerDayMinor: true, insuranceChargeMinor: true,
        features: true, images: true, isPublished: true,
        provider: { select: { businessName: true } },
      },
    });
    if (!vehicle) notFound();

    return (
      <Frame
        title={`Edit ${vehicle.make} ${vehicle.model}`}
        owner={vehicle.provider.businessName}
      >
        <VehicleForm existing={vehicle} basePath="/admin/listings" />
      </Frame>
    );
  }

  if (kind === "tours") {
    const tour = await db.tour.findUnique({
      where: { id },
      select: {
        id: true, name: true, destination: true, durationDays: true,
        maxParticipants: true, priceMinor: true, priceResidentMinor: true, priceNonResidentMinor: true, description: true,
        pickupInfo: true, activities: true, images: true,
        provider: { select: { businessName: true } },
      },
    });
    if (!tour) notFound();

    return (
      <Frame title={`Edit ${tour.name}`} owner={tour.provider.businessName}>
        <TourForm existing={tour} basePath="/admin/listings" />
      </Frame>
    );
  }

  const hotel = await db.hotel.findUnique({
    where: { id },
    select: {
      id: true, name: true, location: true, stars: true, description: true,
      amenities: true, images: true,
      provider: { select: { businessName: true } },
      rooms: {
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
    <Frame title={`Edit ${hotel.name}`} owner={hotel.provider.businessName}>
      <HotelForm existing={hotel} basePath="/admin/listings" />
    </Frame>
  );
}

function Frame({
  title,
  owner,
  children,
}: {
  title: string;
  owner: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <DashboardHead
        back={backToListings}
        title={title}
        lede={`Owned by ${owner}. Price changes apply to new bookings only, capacity can't drop below what is already booked, and the owner cannot be changed here.`}
      />
      {children}
    </>
  );
}
