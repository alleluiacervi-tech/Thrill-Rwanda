import Link from "next/link";
import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { BookingActions } from "@/components/dashboard/booking-actions";
import { BookingExtrasLine } from "@/components/dashboard/booking-extras-line";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/primitives";
import { providerTransitionBooking } from "@/app/actions/provider";
import { STATUS_LABEL, STATUS_TONE, allowedTransitions } from "@/lib/booking";
import { resolveBookingSubjects, resourceIdsMatching } from "@/lib/booking-display";
import { TableSearch } from "@/components/dashboard/table-search";
import { searchTerm } from "@/lib/table-query";
import { Pagination } from "@/components/ui/pagination";
import { paginate } from "@/lib/pagination";
import { db } from "@/lib/db";
import { requireProvider } from "@/lib/session";
import { formatDateRange, formatMoney } from "@/lib/utils";

export default async function ProviderBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { providerId } = await requireProvider("/provider/bookings");

  const params = await searchParams;
  const q = searchTerm(params);
  // Their own bookings list the vehicle or safari first, so search that too.
  const matchingResources = q ? await resourceIdsMatching(q) : [];

  const where = {
    providerId,
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" as const } },
            { customer: { fullName: { contains: q, mode: "insensitive" as const } } },
            { customer: { email: { contains: q, mode: "insensitive" as const } } },
            ...(matchingResources.length ? [{ resourceId: { in: matchingResources } }] : []),
          ],
        }
      : {}),
  };

  const page = paginate(params, await db.booking.count({ where }));

  // Scoped to the session's provider. Pending work first, then newest.
  const bookings = await db.booking.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    skip: page.skip,
    take: page.take,
    include: {
      customer: { select: { fullName: true, email: true, phone: true } },
      documents: { select: { id: true, kind: true } },
    },
  });

  const subjects = await resolveBookingSubjects(bookings);

  return (
    <>
      <DashboardHead
        title="Bookings"
        lede="Confirm the ones you can take, decline the ones you can't, and mark them complete once delivered."
      />

      <TableSearch pathname="/provider/bookings" placeholder="Search reference or customer" className="mb-6" />

      {bookings.length === 0 ? (
        <EmptyPanel
          title="No bookings yet"
          body="When a customer books one of your listings it appears here for you to confirm."
        />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Booking</Th>
              <Th>Customer</Th>
              <Th>Dates</Th>
              <Th className="text-right">Total</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const next = allowedTransitions("PROVIDER", b.status);
              return (
                <Tr key={b.id}>
                  <Td>
                    {/* Opens everything about the booking: documents, agreement, payments. */}
                    <Link
                      href={`/provider/bookings/${b.reference}`}
                      className="link-draw block max-w-[16rem] truncate font-medium"
                    >
                      {subjects.get(b.resourceId) ?? "Listing"}
                    </Link>
                    <span className="tnum text-2xs text-[var(--ink-faint)]">
                      {b.reference} · {b.guests}{" "}
                      {b.guests === 1 ? "guest" : "guests"}
                    </span>
                    <BookingExtrasLine details={b.details} notes={b.customerNotes} documents={b.documents} />
                  </Td>
                  <Td>
                    <span className="block truncate">{b.customer.fullName}</span>
                    <span className="block truncate text-2xs text-[var(--ink-faint)]">
                      {b.customer.phone ?? b.customer.email}
                    </span>
                  </Td>
                  <Td className="tnum whitespace-nowrap">
                    {formatDateRange(b.startDate, b.endDate)}
                  </Td>
                  <Td className="tnum whitespace-nowrap text-right font-medium">
                    {formatMoney(b.totalMinor, b.currency)}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[b.status]}>
                      {STATUS_LABEL[b.status]}
                    </Badge>
                  </Td>
                  <Td>
                    {next.length === 0 ? (
                      <span className="text-2xs text-[var(--ink-faint)]">—</span>
                    ) : (
                      <BookingActions action={providerTransitionBooking} reference={b.reference} next={next} />
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </TableShell>
      )}

      <Pagination page={page} pathname="/provider/bookings" params={params} label="bookings" />
    </>
  );
}
