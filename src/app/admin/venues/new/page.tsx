import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { VenueForm } from "@/components/dashboard/venue-form";
import { requireAdmin } from "@/lib/session";

export const metadata = {
  title: "Add a venue",
  robots: { index: false, follow: false },
};

export default async function AdminNewVenuePage() {
  await requireAdmin("/admin/venues");

  return (
    <>
      <DashboardHead
        back={{ href: "/admin/venues", label: "Back to venues" }}
        title="Add a venue"
        lede="Saved as a draft. It appears on the Weddings & Events page once you publish it."
      />
      <VenueForm />
    </>
  );
}
