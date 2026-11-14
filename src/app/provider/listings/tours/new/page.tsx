import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { TourForm } from "@/components/dashboard/tour-form";
import { requireProviderFor } from "@/lib/session";

export const metadata = {
  title: "Add a tour",
  robots: { index: false, follow: false },
};

export default async function NewTourFormPage() {
  // Guards the route: unverified providers never reach this form.
  await requireProviderFor("TOUR", "/provider/listings/tours/new");

  return (
    <>
      <DashboardHead
        back={{ href: "/provider/listings", label: "Back to listings" }} title="Add a tour" lede="Everything a traveller needs to decide, plus your group size — that becomes seats per departure." />

      <TourForm />
    </>
  );
}
