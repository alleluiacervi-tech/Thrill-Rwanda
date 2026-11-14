import { notFound } from "next/navigation";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { TransferZoneForm } from "@/components/dashboard/transfer-zone-form";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ORIGIN_LABEL } from "@/lib/transfer-zones-shared";

export const metadata = {
  title: "Edit transfer zone",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminEditTransferZonePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin("/admin/transfers");

  // A malformed id would make Postgres throw on the uuid cast; treat it as not found.
  if (!UUID.test(id)) notFound();
  const zone = await db.transferZone.findUnique({ where: { id } });
  if (!zone) notFound();

  return (
    <>
      <DashboardHead
        back={{ href: "/admin/transfers", label: "Back to zones" }}
        title="Edit transfer zone"
        lede={`${ORIGIN_LABEL[zone.origin]} · ${zone.name}`}
      />
      <TransferZoneForm existing={zone} />
    </>
  );
}
