import Link from "next/link";
import { ArrowUpRight, CalendarDays, Users } from "lucide-react";
import {
  DashboardHead,
  EmptyPanel,
} from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/booking";
import { resolveBookingSubjects } from "@/lib/booking-display";
import { Pagination } from "@/components/ui/pagination";
import { paginate } from "@/lib/pagination";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatDateRange, formatMoney } from "@/lib/utils";

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/account/bookings");

  const params = await searchParams;
  const page = paginate(params, await db.booking.count({ where: { customerId: user.id } }));

  // Scoped to the session user. Never a customerId from the request.
  const bookings = await db.booking.findMany({
    where: { customerId: user.id },
    orderBy: { createdAt: "desc" },
    skip: page.skip,
    take: page.take,
    include: { provider: { select: { businessName: true } } },
  });

  const subjects = await resolveBookingSubjects(bookings);

  return (
    <>
      <DashboardHead
        title="My bookings"
        lede="Every safari, stay, hire and transfer you've booked with us."
        action={
          <Button href="/tours" variant="accent">
            Book something new
          </Button>
        }
      />

      {bookings.length === 0 ? (
        <EmptyPanel
          title="Nothing booked yet"
          body="Your bookings will show here with their reference, dates, status and payment — and you can cancel eligible ones from this page."
          action={
            <Button href="/tours" variant="accent">
              Find something to book
            </Button>
          }
        />
      ) : (
        <ul className="space-y-4">
          {bookings.map((b) => (
            <li key={b.id}>
              <Link
                href={`/account/bookings/${b.reference}`}
                className="group flex flex-col gap-5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6 transition-all duration-400 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-lift)] sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tone={STATUS_TONE[b.status]}>
                      {STATUS_LABEL[b.status]}
                    </Badge>
                    <span className="tnum text-2xs uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                      {b.reference}
                    </span>
                  </div>

                  <h2 className="mt-3 truncate text-xl">
                    {subjects.get(b.resourceId) ?? "Booking"}
                  </h2>

                  <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-2xs text-[var(--ink-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3.5 text-clay-600" />
                      {formatDateRange(b.startDate, b.endDate)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-3.5 text-clay-600" />
                      {b.guests} {b.guests === 1 ? "guest" : "guests"}
                    </span>
                    <span>{b.provider.businessName}</span>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <p className="tnum text-right font-display text-xl font-semibold">
                    {formatMoney(b.totalMinor, b.currency)}
                  </p>
                  <ArrowUpRight className="size-4 text-[var(--ink-faint)] transition-transform duration-400 [transition-timing-function:var(--ease-out-expo)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-lake-600" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination page={page} pathname="/account/bookings" params={params} label="bookings" />
    </>
  );
}
