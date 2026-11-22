import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { TourForm } from "@/components/dashboard/tour-form";
import { backToListings, verifiedProviders } from "@/app/admin/listings/new/shared";
import { requireAdmin } from "@/lib/session";

export const metadata = {
  title: "Add a tour",
  robots: { index: false, follow: false },
};

export default async function AdminNewTourPage() {
  await requireAdmin("/admin/listings");
  const providers = await verifiedProviders("TOUR");

  return (
    <>
      <DashboardHead
        back={backToListings}
        title="Add a tour"
        lede="Posted on a provider's behalf. It saves as a draft under their account, with a 365-day calendar sized to the group limit."
      />
      <TourForm providers={providers} basePath="/admin/listings" />
    </>
  );
}
