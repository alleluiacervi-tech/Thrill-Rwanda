import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { VehicleForm } from "@/components/dashboard/vehicle-form";
import { requireProviderFor } from "@/lib/session";

export const metadata = { title: "Add a vehicle", robots: { index: false, follow: false } };

export default async function NewVehiclePage() {
  // Guards the whole route: unverified providers never reach this form.
  await requireProviderFor("CAR", "/provider/listings/vehicles/new");

  return (
    <>
      <DashboardHead
        back={{ href: "/provider/listings", label: "Back to listings" }}
        title="Add a vehicle"
        lede="Everything a customer needs to decide, plus how many you have — that number becomes your daily availability."
      />

      <VehicleForm />
    </>
  );
}
