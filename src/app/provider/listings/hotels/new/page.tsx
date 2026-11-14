import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { HotelForm } from "@/components/dashboard/hotel-form";
import { requireProviderFor } from "@/lib/session";

export const metadata = {
  title: "Add a property",
  robots: { index: false, follow: false },
};

export default async function NewHotelFormPage() {
  // Guards the route: unverified providers never reach this form.
  await requireProviderFor("HOTEL", "/provider/listings/hotels/new");

  return (
    <>
      <DashboardHead
        back={{ href: "/provider/listings", label: "Back to listings" }} title="Add a property" lede="Your property and its room types. Rooms carry the price and the count — they are what customers book." />

      <HotelForm />
    </>
  );
}
