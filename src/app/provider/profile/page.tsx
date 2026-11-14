import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { ProviderProfileForm } from "@/components/dashboard/provider-profile-form";
import { Badge } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { requireProvider } from "@/lib/session";

export default async function ProviderProfilePage() {
  const { providerId } = await requireProvider("/provider/profile");

  const provider = await db.provider.findUniqueOrThrow({
    where: { id: providerId },
    select: {
      businessName: true, phone: true, about: true,
      kraPin: true, licenceNumber: true, status: true, verifiedAt: true,
    },
  });

  return (
    <>
      <DashboardHead
        title="Business profile"
        lede="What travellers see on your listings, plus the details we verify you against."
        action={
          <Badge tone={provider.status === "VERIFIED" ? "forest" : "clay"}>
            {provider.status}
          </Badge>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,34rem)_1fr]">
        <ProviderProfileForm provider={provider} />

        <aside className="space-y-4">
          <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-sunken)] p-6">
            <h2 className="text-lg">Verification</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
              Your KRA PIN and licence number are checked by our team. You
              can update them here, but only an admin can change your
              verification status — that&rsquo;s deliberate.
            </p>
            {provider.verifiedAt ? (
              <p className="tnum mt-4 text-2xs text-[var(--ink-faint)]">
                Verified on{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }).format(provider.verifiedAt)}
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </>
  );
}
