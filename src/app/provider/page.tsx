import { CalendarCheck, Package, Wallet } from "lucide-react";
import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { requireProvider } from "@/lib/session";
import { formatMoney } from "@/lib/utils";

export default async function ProviderOverviewPage() {
  // Returns the provider id derived from the SESSION. Every query below
  // scopes on it — this is the Step 18 boundary.
  const { provider, providerId } = await requireProvider();

  const [listings, pending, earnings] = await Promise.all([
    Promise.all([
      db.tour.count({ where: { providerId } }),
      db.hotel.count({ where: { providerId } }),
      db.vehicle.count({ where: { providerId } }),
    ]).then(([t, h, v]) => t + h + v),
    db.booking.count({ where: { providerId, status: "PENDING" } }),
    db.payment.aggregate({
      where: { status: "SUCCEEDED", booking: { providerId } },
      _sum: { amountMinor: true },
    }),
  ]);

  const stats = [
    { icon: Package, label: "Live listings", value: String(listings) },
    { icon: CalendarCheck, label: "Awaiting your confirmation", value: String(pending) },
    {
      icon: Wallet,
      label: "Paid to you",
      value: formatMoney(earnings._sum.amountMinor ?? 0),
    },
  ];

  return (
    <>
      <DashboardHead
        title={provider.businessName}
        lede="Your listings, your bookings, your earnings. Nothing here is shared with other providers."
        action={<Badge tone="forest">Verified</Badge>}
      />

      <dl className="mb-10 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6"
          >
            <dt className="flex items-center gap-2 text-2xs uppercase tracking-[0.14em] text-[var(--ink-faint)]">
              <s.icon className="size-3.5 text-clay-600" />
              {s.label}
            </dt>
            <dd className="tnum mt-2 font-display text-3xl font-semibold">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      <EmptyPanel
        title="No bookings yet"
        body="Confirmed and pending bookings for your listings appear here. You'll be able to confirm, reject and mark them complete once the booking engine is live (Step 10)."
      />
    </>
  );
}
