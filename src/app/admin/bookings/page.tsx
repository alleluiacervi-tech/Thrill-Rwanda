import Link from "next/link";
import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { BookingActions } from "@/components/dashboard/booking-actions";
import { BookingExtrasLine } from "@/components/dashboard/booking-extras-line";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/primitives";
import { adminTransitionBooking } from "@/app/actions/admin";
import { STATUS_LABEL, STATUS_TONE, allowedTransitions } from "@/lib/booking";
import { resolveBookingSubjects, resourceIdsMatching } from "@/lib/booking-display";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { SelectFilter } from "@/components/dashboard/select-filter";
import { SortTh } from "@/components/dashboard/sort-header";
import { TableSearch } from "@/components/dashboard/table-search";
import { DATE_RANGES, dateRange, searchTerm, sortOrder } from "@/lib/table-query";
import { Pagination } from "@/components/ui/pagination";
import { paginate } from "@/lib/pagination";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatDateRange, formatMoney } from "@/lib/utils";
import type { BookingStatus } from "@/generated/prisma/enums";

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "AWAITING_PAYMENT", label: "Awaiting payment" },
  { value: "PAID", label: "Paid" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REJECTED", label: "Rejected" },
];

const VALID = new Set(FILTERS.map((f) => f.value).filter(Boolean));

// The client's wording, not the schema's: a ROOM booking is a hotel stay.
const SERVICES = [
  { value: "", label: "All services" },
  { value: "TOUR", label: "Safaris & tours" },
  { value: "VEHICLE", label: "Car hire" },
  { value: "TRANSFER", label: "Airport transfers" },
  { value: "ROOM", label: "Hotels" },
] as const;

const SERVICE_VALUES = new Set(SERVICES.map((s) => s.value).filter(Boolean));

// Columns this page will sort by; anything else falls back to newest first.
const SORTS = [
  { value: "created", orderBy: { createdAt: true } },
  { value: "start", orderBy: { startDate: true } },
  { value: "total", orderBy: { totalMinor: true } },
  { value: "customer", orderBy: { customer: { fullName: true } } },
  { value: "status", orderBy: { status: true } },
];

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/bookings");

  const raw = await searchParams;
  const statusParam = Array.isArray(raw.status) ? raw.status[0] : raw.status;
  const status = statusParam && VALID.has(statusParam) ? (statusParam as BookingStatus) : undefined;

  const serviceParam = Array.isArray(raw.service) ? raw.service[0] : raw.service;
  const service =
    serviceParam && SERVICE_VALUES.has(serviceParam as "TOUR") ? (serviceParam as "TOUR") : undefined;

  const q = searchTerm(raw);
  const createdAt = dateRange(raw);

  // The first column shows the listing, so the search has to look there too.
  const matchingResources = q ? await resourceIdsMatching(q) : [];

  // One where clause for the count and the rows, or the pager lies.
  const where = {
    ...(status ? { status } : {}),
    ...(service ? { serviceType: service } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" as const } },
            { customer: { fullName: { contains: q, mode: "insensitive" as const } } },
            { customer: { email: { contains: q, mode: "insensitive" as const } } },
            { provider: { businessName: { contains: q, mode: "insensitive" as const } } },
            ...(matchingResources.length ? [{ resourceId: { in: matchingResources } }] : []),
          ],
        }
      : {}),
  };

  const { orderBy, sort, dir } = sortOrder(raw, SORTS, { createdAt: "desc" });
  const page = paginate(raw, await db.booking.count({ where }));

  const bookings = await db.booking.findMany({
    where,
    orderBy,
    skip: page.skip,
    take: page.take,
    include: {
      customer: { select: { fullName: true, email: true } },
      provider: { select: { businessName: true } },
      documents: { select: { id: true, kind: true } },
    },
  });

  const subjects = await resolveBookingSubjects(bookings);

  return (
    <>
      <DashboardHead
        title="All bookings"
        lede="Every booking on the platform. Cancelling or rejecting here releases the held inventory immediately."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <TableSearch
          pathname="/admin/bookings"
          placeholder="Search reference, customer or provider"
        />
        <SelectFilter
          pathname="/admin/bookings"
          param="service"
          options={SERVICES}
          label="Filter by service type"
          className="w-48"
        />
        <SelectFilter
          pathname="/admin/bookings"
          param="range"
          options={DATE_RANGES}
          label="Filter by date"
          className="w-44"
        />
      </div>

      <FilterChips
        basePath="/admin/bookings"
        param="status"
        current={status ?? ""}
        chips={FILTERS}
        label="Filter by status"
        params={raw}
      />

      {bookings.length === 0 ? (
        <EmptyPanel
          title="No bookings match"
          body={status ? "Try a different status filter." : "Bookings appear here as customers make them."}
        />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Booking</Th>
              <SortTh value="customer" pathname="/admin/bookings" params={raw} active={sort} dir={dir}>
                Customer
              </SortTh>
              <Th>Provider</Th>
              <SortTh value="start" pathname="/admin/bookings" params={raw} active={sort} dir={dir}>
                Dates
              </SortTh>
              <SortTh value="total" pathname="/admin/bookings" params={raw} active={sort} dir={dir} className="text-right">
                Total
              </SortTh>
              <SortTh value="status" pathname="/admin/bookings" params={raw} active={sort} dir={dir}>
                Status
              </SortTh>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const next = allowedTransitions("ADMIN", b.status);
              return (
                <Tr key={b.id}>
                  <Td>
                    {/* Opens everything about the booking: documents, agreement, payments. */}
                    <Link
                      href={`/admin/bookings/${b.reference}`}
                      className="link-draw block max-w-[14rem] truncate font-medium"
                    >
                      {subjects.get(b.resourceId) ?? "Listing"}
                    </Link>
                    <span className="tnum text-2xs text-[var(--ink-faint)]">
                      {b.reference} · {b.guests} {b.guests === 1 ? "guest" : "guests"}
                    </span>
                    <BookingExtrasLine details={b.details} notes={b.customerNotes} documents={b.documents} />
                  </Td>
                  <Td>
                    <span className="block max-w-[11rem] truncate">{b.customer.fullName}</span>
                    <span className="block max-w-[11rem] truncate text-2xs text-[var(--ink-faint)]">{b.customer.email}</span>
                  </Td>
                  <Td className="max-w-[11rem] truncate">{b.provider.businessName}</Td>
                  <Td className="tnum whitespace-nowrap">{formatDateRange(b.startDate, b.endDate)}</Td>
                  <Td className="tnum whitespace-nowrap text-right font-medium">{formatMoney(b.totalMinor, b.currency)}</Td>
                  <Td><Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge></Td>
                  <Td>
                    {next.length === 0 ? (
                      <span className="text-2xs text-[var(--ink-faint)]">—</span>
                    ) : (
                      <BookingActions action={adminTransitionBooking} reference={b.reference} next={next} />
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </TableShell>
      )}

      <Pagination page={page} pathname="/admin/bookings" params={raw} label="bookings" />
    </>
  );
}
