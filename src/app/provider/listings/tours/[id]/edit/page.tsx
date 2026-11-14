import { notFound } from "next/navigation";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { TourForm } from "@/components/dashboard/tour-form";
import { db } from "@/lib/db";
import { requireProviderFor } from "@/lib/session";

export const metadata = {
  title: "Edit tour",
  robots: { index: false, follow: false },
};

export default async function EditTourPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { providerId } = await requireProviderFor("TOUR", "/provider/listings");

  // Scoped read: another provider's id is simply not found, not forbidden.
  const tour = await db.tour.findFirst({
    where: { id, providerId },
    select: {
      id: true, name: true, destination: true, durationDays: true,
      maxParticipants: true, priceMinor: true, priceResidentMinor: true, priceNonResidentMinor: true, description: true,
      pickupInfo: true, activities: true, images: true,
    },
  });
  if (!tour) notFound();

  return (
    <>
      <DashboardHead
        back={{ href: "/provider/listings", label: "Back to listings" }}
        title={`Edit ${tour.name}`}
        lede="Price changes apply to new bookings only — existing ones keep the price they were made at. Group size can't drop below a departure you've already filled."
      />

      <TourForm existing={tour} />
    </>
  );
}
