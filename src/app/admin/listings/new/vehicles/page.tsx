import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { VehicleForm } from "@/components/dashboard/vehicle-form";
import { backToListings, verifiedProviders } from "@/app/admin/listings/new/shared";
import { requireAdmin } from "@/lib/session";

export const metadata = {
  title: "Add a vehicle",
  robots: { index: false, follow: false },
};

export default async function AdminNewVehiclePage() {
  await requireAdmin("/admin/listings");
  const providers = await verifiedProviders();

  return (
    <>
      <DashboardHead
        back={backToListings}
        title="Add a vehicle"
        lede="Posted on a provider's behalf. It saves as a draft under their account and appears in their own dashboard, where they can edit it like any other listing."
      />
      <VehicleForm providers={providers} basePath="/admin/listings" />
    </>
  );
}
