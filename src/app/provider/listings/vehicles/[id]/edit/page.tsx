import { notFound } from "next/navigation";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { VehicleForm } from "@/components/dashboard/vehicle-form";
import { db } from "@/lib/db";
import { requireProviderFor } from "@/lib/session";

export const metadata = {
  title: "Edit vehicle",
  robots: { index: false, follow: false },
};

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { providerId } = await requireProviderFor("CAR", "/provider/listings");

  // Scoped read: another provider's id is simply not found, not forbidden.
  const vehicle = await db.vehicle.findFirst({
    where: { id, providerId },
    select: {
      id: true, make: true, model: true, year: true, category: true,
      seats: true, transmission: true, fuelType: true, quantity: true,
      pricePerDayMinor: true, driverPerDayMinor: true, insuranceChargeMinor: true,
        features: true, images: true, isPublished: true,
    },
  });
  if (!vehicle) notFound();

  return (
    <>
      <DashboardHead
        back={{ href: "/provider/listings", label: "Back to listings" }}
        title={`Edit ${vehicle.make} ${vehicle.model}`}
        lede="Price changes apply to new bookings only — existing ones keep the price they were made at."
      />

      <VehicleForm existing={vehicle} />
    </>
  );
}
