import Link from "next/link";
import { BadgeCheck, CalendarDays, TrendingUp, Users, Wallet } from "lucide-react";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/primitives";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/booking";
import { resolveBookingSubjects } from "@/lib/booking-display";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatMoney } from "@/lib/utils";
import type { BookingStatus } from "@/generated/prisma/enums";

export default async function AdminOverviewPage() {
  await requireAdmin();

  const [
    customers, providersPending, providersVerified,
    totalBookings, completed, cancelled, revenue, byStatus, recent,
  ] = await Promise.all([
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.provider.count({ where: { status: "PENDING" } }),
    db.provider.count({ where: { status: "VERIFIED" } }),
    db.booking.count(),
    db.booking.count({ where: { status: "COMPLETED" } }),
    db.booking.count({ where: { status: { in: ["CANCELLED", "REJECTED"] } } }),
    db.payment.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amountMinor: true } }),
    db.booking.groupBy({ by: ["status"], _count: { _all: true } }),
    db.booking.findMany({
      orderBy: { createdAt: "desc" }, take: 8,
      include: { customer: { select: { fullName: true } }, provider: { select: { businessName: true } } },
    }),
  ]);

  // "Popular services" from Step 13 — which service type sells most.
  const popular = await db.booking.groupBy({
    by: ["serviceType"],
    _count: { _all: true },
    _sum: { totalMinor: true },
    orderBy: { _count: { serviceType: "desc" } },
  });

  const subjects = await resolveBookingSubjects(recent);

  const stats = [
    { icon: Users, label: "Customers", value: String(customers) },
    { icon: BadgeCheck, label: "Providers awaiting approval", value: String(providersPending), href: "/admin/providers" },
    { icon: CalendarDays, label: "Total bookings", value: String(totalBookings), href: "/admin/bookings" },
    { icon: Wallet, label: "Revenue collected", value: formatMoney(revenue._sum.amountMinor ?? 0) },
  ];

  const serviceLabel: Record<string, string> = {
    TOUR: "Tours & safaris", ROOM: "Hotel rooms", VEHICLE: "Car hire", TRANSFER: "Transfers",
  };

  return (
    <>
      <DashboardHead
        title="Platform overview"
        lede="Live figures from the database."
      />

      <dl className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const card = (
            <div className="h-full rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-4 transition-colors hover:border-[var(--line-strong)]">
              <dt className="flex items-center gap-2 text-2xs uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                <s.icon className="size-3.5 text-clay-600" />
                {s.label}
              </dt>
              <dd className="tnum mt-1.5 font-display text-2xl font-semibold">{s.value}</dd>
            </div>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="block">{card}</Link>
          ) : (
            <div key={s.label}>{card}</div>
          );
        })}
      </dl>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg">Bookings by status</h2>
          <TableShell dense>
            <thead><tr><Th>Status</Th><Th className="text-right">Count</Th></tr></thead>
            <tbody>
              {byStatus.length === 0 ? (
                <Tr><Td className="text-[var(--ink-faint)]">No bookings yet</Td><Td /></Tr>
              ) : (
                byStatus.map((s) => (
                  <Tr key={s.status}>
                    <Td><Badge tone={STATUS_TONE[s.status as BookingStatus]}>{STATUS_LABEL[s.status as BookingStatus]}</Badge></Td>
                    <Td className="tnum text-right">{s._count._all}</Td>
                  </Tr>
                ))
              )}
            </tbody>
          </TableShell>
          <p className="mt-3 flex items-center gap-2 text-2xs text-[var(--ink-faint)]">
            <TrendingUp className="size-3.5" />
            {completed} completed · {cancelled} cancelled or rejected · {providersVerified} verified providers
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg">Popular services</h2>
          <TableShell dense>
            <thead><tr><Th>Service</Th><Th className="text-right">Bookings</Th><Th className="text-right">Value</Th></tr></thead>
            <tbody>
              {popular.length === 0 ? (
                <Tr><Td className="text-[var(--ink-faint)]">No bookings yet</Td><Td /><Td /></Tr>
              ) : (
                popular.map((p) => (
                  <Tr key={p.serviceType}>
                    <Td>{serviceLabel[p.serviceType] ?? p.serviceType}</Td>
                    <Td className="tnum text-right">{p._count._all}</Td>
                    <Td className="tnum text-right">{formatMoney(p._sum.totalMinor ?? 0)}</Td>
                  </Tr>
                ))
              )}
            </tbody>
          </TableShell>
        </section>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg">Recent bookings</h2>
          <Link href="/admin/bookings" className="link-draw text-sm text-clay-700">View all</Link>
        </div>
        <TableShell>
          <thead>
            <tr><Th>Booking</Th><Th>Customer</Th><Th>Provider</Th><Th className="text-right">Total</Th><Th>Status</Th></tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <Tr><Td className="text-[var(--ink-faint)]">Nothing booked yet</Td><Td /><Td /><Td /><Td /></Tr>
            ) : (
              recent.map((b) => (
                // The whole row opens the booking: the link's overlay covers it.
                <Tr key={b.id} className="relative cursor-pointer">
                  <Td>
                    <Link
                      href={`/admin/bookings/${b.reference}`}
                      className="block max-w-[14rem] truncate font-medium after:absolute after:inset-0"
                    >
                      {subjects.get(b.resourceId) ?? "Listing"}
                    </Link>
                    <span className="tnum text-2xs text-[var(--ink-faint)]">{b.reference}</span>
                  </Td>
                  <Td className="max-w-[11rem] truncate">{b.customer.fullName}</Td>
                  <Td className="max-w-[11rem] truncate">{b.provider.businessName}</Td>
                  <Td className="tnum whitespace-nowrap text-right">{formatMoney(b.totalMinor, b.currency)}</Td>
                  <Td><Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge></Td>
                </Tr>
              ))
            )}
          </tbody>
        </TableShell>
      </section>
    </>
  );
}
