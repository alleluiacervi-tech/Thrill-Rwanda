import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getSiteSettings } from "@/lib/settings";

export const metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  await requireAdmin("/admin/settings");
  // The raw row, so a blank field shows as blank (with the built-in value as its placeholder).
  const [settings, row] = await Promise.all([getSiteSettings(), db.siteSettings.findUnique({ where: { id: 1 } })]);

  return (
    <>
      <DashboardHead
        title="Settings"
        lede="Your business details, booking rules and payments — no developer needed. Changes show across the site as soon as you save."
      />
      <SettingsForm
        values={{
          depositPercent: settings.depositPercent,
          damageLiabilityText: settings.damageLiabilityText,
          brandName: row?.brandName ?? null,
          legalName: row?.legalName ?? null,
          tagline: row?.tagline ?? null,
          heroTitle: row?.heroTitle ?? null,
          heroSubtitle: row?.heroSubtitle ?? null,
          heroText: row?.heroText ?? null,
          phone: row?.phone ?? null,
          phoneAlt: row?.phoneAlt ?? null,
          whatsapp: row?.whatsapp ?? null,
          email: row?.email ?? null,
          address: row?.address ?? null,
          openingHours: row?.openingHours ?? null,
          facebookUrl: row?.facebookUrl ?? null,
          instagramUrl: row?.instagramUrl ?? null,
          tiktokUrl: row?.tiktokUrl ?? null,
          xUrl: row?.xUrl ?? null,
          youtubeUrl: row?.youtubeUrl ?? null,
          holdMinutes: row?.holdMinutes ?? 60,
          transferMaxPassengers: row?.transferMaxPassengers ?? 6,
          minNoticeDays: row?.minNoticeDays ?? 0,
          payOnlineTours: row?.payOnlineTours ?? true,
          payOnlineCars: row?.payOnlineCars ?? true,
          payOnlineTransfers: row?.payOnlineTransfers ?? true,
          announcement: row?.announcement ?? null,
          announcementOn: row?.announcementOn ?? false,
        }}
      />
    </>
  );
}
