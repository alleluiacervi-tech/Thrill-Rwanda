import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { TransferZoneForm } from "@/components/dashboard/transfer-zone-form";
import { requireAdmin } from "@/lib/session";

export const metadata = {
  title: "Add a transfer zone",
  robots: { index: false, follow: false },
};

export default async function AdminNewTransferZonePage() {
  await requireAdmin("/admin/transfers");

  return (
    <>
      <DashboardHead
        back={{ href: "/admin/transfers", label: "Back to zones" }}
        title="Add a transfer zone"
        lede="Prices are per vehicle, the same in either direction. The night fee is added on top automatically."
      />
      <TransferZoneForm />
    </>
  );
}
