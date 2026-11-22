import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { HotelForm } from "@/components/dashboard/hotel-form";
import { backToListings, verifiedProviders } from "@/app/admin/listings/new/shared";
import { requireAdmin } from "@/lib/session";

export const metadata = {
  title: "Add a property",
  robots: { index: false, follow: false },
};

export default async function AdminNewHotelPage() {
  await requireAdmin("/admin/listings");
  const providers = await verifiedProviders("HOTEL");

  return (
    <>
      <DashboardHead
        back={backToListings}
        title="Add a property"
        lede="Posted on a provider's behalf. Rooms are what customers book, so at least one room type is required — each gets its own calendar."
      />
      <HotelForm providers={providers} basePath="/admin/listings" />
    </>
  );
}
