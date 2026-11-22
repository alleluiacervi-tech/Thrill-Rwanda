import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  Clock3,
  Car,
  CreditCard,
  FileSignature,
  MapPin,
  Phone,
  Plane,
  Route,
  UserRound,
  Users,
} from "lucide-react";
import { AddDriver } from "@/components/booking/add-driver";
import { DocumentUpload } from "@/components/booking/document-upload";
import { CancelBookingForm } from "@/components/booking/cancel-booking-form";
import { PayBookingForm } from "@/components/booking/pay-booking-form";
import { ReviewForm } from "@/components/booking/review-form";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { STATUS_LABEL, STATUS_TONE, dayCount, isCancellable } from "@/lib/booking";
import { resolveBookingSubjectDetails } from "@/lib/booking-display";
import { bookingExtras } from "@/lib/booking-extras";
import { DOCUMENT_ACCEPT, DOCUMENT_LABELS, requiredDocuments } from "@/lib/booking-documents";
import { db } from "@/lib/db";
import { nextCharge, quotedDepositPercent } from "@/lib/deposit";
import { CHECKOUT_STATUSES } from "@/lib/payments";
import { bookingPaymentAvailability } from "@/lib/collections/checkout";
import { requireUser } from "@/lib/session";
import { getSiteSettings } from "@/lib/settings";
import { getSite } from "@/lib/settings";
import { formatDateRange, formatMoney } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Booking",
  robots: { index: false, follow: false },
};

// Historical gateway redirects only provide a hint. Verified totals come from the ledger.
const RETURN_NOTE: Record<
  string,
  { tone: "ok" | "warn" | "bad"; title: string; body: string }
> = {
  pending: {
    tone: "warn",
    title: "Payment still processing",
    body: "Check the verified totals below or contact the desk to trace a previous payment.",
  },
  failed: {
    tone: "bad",
    title: "That payment didn't go through",
    body: "Contact the desk if funds left your account.",
  },
  unknown: {
    tone: "warn",
    title: "We couldn't match that payment",
    body: "If money left your account, call us with your reference and we'll trace it straight away.",
  },
};

const NOTE_CLS = {
  ok: "border-forest-300 bg-forest-100 text-forest-900",
  warn: "border-clay-300 bg-clay-100 text-clay-900",
  bad: "border-red-200 bg-red-50 text-red-900",
} as const;

const EXTRA_ICON = {
  route: Route,
  pickupTime: Clock3,
  flight: Plane,
  vehicle: Car,
  residency: BadgeCheck,
  driver: Car,
  traveller: UserRound,
  phone: Phone,
};

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const site = await getSite();
  const { reference } = await params;
  const { payment: paymentOutcome } = await searchParams;
  const user = await requireUser(`/account/bookings/${reference}`);

  // Scoped by customerId as well as reference: guessing another customer's
  // reference returns a 404, not their booking.
  const booking = await db.booking.findFirst({
    where: { reference, customerId: user.id },
    include: {
      provider: { select: { businessName: true, phone: true } },
      payments: { orderBy: { createdAt: "desc" } },
      paymentInvoice: { select: { id: true } },
      review: { select: { rating: true, status: true } },
      agreement: { select: { signedName: true, signedAt: true } },
      documents: { select: { id: true, kind: true, fileName: true } },
    },
  });

  if (!booking) notFound();

  const subject = (await resolveBookingSubjectDetails([booking])).get(
    booking.resourceId,
  );

  const paid = booking.payments
    .filter((p) => p.status === "SUCCEEDED" && p.currency === booking.currency)
    .reduce((sum, p) => sum + p.amountMinor, 0);
  const outstanding = Math.max(0, booking.totalMinor - paid);

  // A confirmed booking can still owe its balance after the deposit, so it stays payable.
  const payable = (CHECKOUT_STATUSES as readonly string[]).includes(booking.status);
  const charge = nextCharge(
    booking.totalMinor,
    paid,
    quotedDepositPercent(booking.details, (await getSiteSettings()).depositPercent),
    booking.currency,
  );
  const onlinePayments = Boolean(booking.paymentInvoice) || await bookingPaymentAvailability(booking, paid);

  // Car hire only: a driver can still be added while the booking is live.
  const details = booking.details as { withDriver?: boolean; terms?: unknown } | null;
  const termsAgreed = Boolean(details?.terms);
  const isTransfer = booking.serviceType === "TRANSFER";
  // Hotel stays are settled at the property, never online.
  const payAtProperty = booking.serviceType === "ROOM";
  const vehicle =
    booking.serviceType === "VEHICLE" && payable && !details?.withDriver && !booking.paymentInvoice
      ? await db.vehicle.findUnique({
          where: { id: booking.resourceId },
          select: { driverPerDayMinor: true },
        })
      : null;
  const hireDays = dayCount(booking.startDate, booking.endDate);
  const note = paymentOutcome ? RETURN_NOTE[paymentOutcome] : undefined;

  const rows = [
    {
      icon: CalendarDays,
      // A transfer is one trip on one day; its time is listed with the route.
      label: isTransfer ? "Date" : "Dates",
      value: isTransfer
        ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(booking.startDate)
        : formatDateRange(booking.startDate, booking.endDate),
    },
    {
      icon: Users,
      label: isTransfer ? "Passengers" : "Guests",
      value: isTransfer
        ? `${booking.guests} ${booking.guests === 1 ? "passenger" : "passengers"}`
        : `${booking.guests} ${booking.guests === 1 ? "guest" : "guests"}`,
    },
    { icon: MapPin, label: "Provider", value: booking.provider.businessName },
    // What they chose when booking: residency, driver, who is travelling.
    ...bookingExtras(booking.details).map((e) => ({
      icon: EXTRA_ICON[e.key],
      label: e.label,
      value: e.value,
    })),
    {
      icon: CreditCard,
      label: "Total",
      value: formatMoney(booking.totalMinor, booking.currency),
    },
  ];

  return (
    <>
      <DashboardHead
        title={subject?.title ?? "Booking"}
        lede={`Reference ${booking.reference} · ${subject?.kind ?? ""}`}
        action={<Badge tone={STATUS_TONE[booking.status]}>{STATUS_LABEL[booking.status]}</Badge>}
      />

      {note ? (
        <div
          className={`mb-6 rounded-[var(--radius-card)] border p-5 ${NOTE_CLS[note.tone]}`}
        >
          <h2 className="text-sm font-semibold">{note.title}</h2>
          <p className="mt-1.5 text-2xs leading-relaxed opacity-80">{note.body}</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0 space-y-6">
          <dl className="divide-y divide-[var(--line)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)]">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center gap-6 px-6 py-4">
                <dt className="flex w-40 shrink-0 items-center gap-2 text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  <r.icon className="size-3.5 text-clay-600" />
                  {r.label}
                </dt>
                <dd className="tnum min-w-0 truncate text-sm">{r.value}</dd>
              </div>
            ))}
          </dl>

          {/* Car hire: licence and ID copies, replaceable while the booking is live. */}
          {booking.serviceType === "VEHICLE" ? (
            <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6">
              <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                Your documents
              </h2>
              {requiredDocuments(booking.details).map((kind) => {
                const have = booking.documents.find((d) => d.kind === kind);
                return payable ? (
                  <DocumentUpload
                    key={kind}
                    reference={booking.reference}
                    kind={kind}
                    {...DOCUMENT_LABELS[kind]}
                    accept={DOCUMENT_ACCEPT}
                    initial={have ? { id: have.id, fileName: have.fileName } : undefined}
                  />
                ) : (
                  <p key={kind} className="text-sm">
                    {DOCUMENT_LABELS[kind].label}:{" "}
                    {have ? (
                      <a href={`/api/documents/${have.id}`} target="_blank" rel="noopener" className="link-draw text-clay-700">
                        {have.fileName}
                      </a>
                    ) : (
                      <span className="text-[var(--ink-muted)]">not uploaded</span>
                    )}
                  </p>
                );
              })}
            </div>
          ) : null}

          {booking.customerNotes ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6">
              <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                Your notes
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink-muted)]">
                {booking.customerNotes}
              </p>
            </div>
          ) : null}

          {subject?.href ? (
            <Button href={subject.href} variant="quiet">
              View the listing
            </Button>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6">
            <h2 className="text-lg">Payment</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--ink-muted)]">Total</dt>
                <dd className="tnum">{formatMoney(booking.totalMinor, booking.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--ink-muted)]">Paid</dt>
                <dd className="tnum">{formatMoney(paid, booking.currency)}</dd>
              </div>
              <div className="flex justify-between border-t border-[var(--line)] pt-2 font-semibold">
                <dt>Outstanding</dt>
                <dd className="tnum">{formatMoney(outstanding, booking.currency)}</dd>
              </div>
            </dl>

            {booking.paymentInvoice && (!payable || !outstanding) ? (
              <Button href={`/checkout/${booking.reference}/pay`} variant="outline" className="mt-5 w-full">View payment receipts</Button>
            ) : null}
            {outstanding > 0 && payable ? (
              // Held but never taken through checkout: finish there, where the terms are agreed.
              !termsAgreed ? (
                <Button href={`/checkout/${booking.reference}`} variant="accent" className="mt-5 w-full">
                  Complete booking
                </Button>
              ) : payAtProperty ? (
                <p className="mt-5 rounded-[var(--radius-inset)] border border-forest-300 bg-forest-100 p-4 text-2xs leading-relaxed text-forest-900">
                  Pay {formatMoney(outstanding, booking.currency)} at the property when you arrive.
                  Nothing is paid online for a hotel stay.
                </p>
              ) : onlinePayments ? (
                <PayBookingForm
                  reference={booking.reference}
                  amount={formatMoney(charge.amountMinor, booking.currency)}
                  kind={charge.kind}
                  balanceAfter={
                    charge.kind === "deposit"
                      ? formatMoney(outstanding - charge.amountMinor, booking.currency)
                      : undefined
                  }
                />
              ) : (
                <p className="mt-5 rounded-[var(--radius-inset)] border border-clay-300 bg-clay-100 p-4 text-2xs leading-relaxed text-clay-900">
                  Contact {site.contact.phone} for payment instructions. Quote{" "}
                  <span className="tnum font-semibold">{booking.reference}</span>.
                </p>
              )
            ) : null}

            {booking.serviceType === "VEHICLE" ? (
              <div className="mt-5 rounded-[var(--radius-inset)] border border-[var(--line)] bg-[var(--paper-sunken)] p-4">
                <p className="flex items-start gap-2.5 text-sm">
                  <FileSignature className="mt-px size-4 shrink-0 text-clay-700" />
                  <span>
                    <span className="block font-medium">Hire agreement</span>
                    <span className="mt-0.5 block text-2xs leading-relaxed text-[var(--ink-muted)]">
                      {booking.agreement
                        ? `Signed by ${booking.agreement.signedName} on ${new Intl.DateTimeFormat(
                            "en-GB",
                            { dateStyle: "medium", timeZone: "UTC" },
                          ).format(booking.agreement.signedAt)}.`
                        : "Please read and sign this before you collect the vehicle."}
                    </span>
                  </span>
                </p>
                <Button
                  href={`/account/bookings/${booking.reference}/agreement`}
                  variant={booking.agreement ? "quiet" : "outline"}
                  size="sm"
                  className="mt-3"
                >
                  {booking.agreement ? "View the agreement" : "Read and sign"}
                </Button>
              </div>
            ) : null}

            {vehicle?.driverPerDayMinor ? (
              <div className="mt-5">
                <AddDriver
                  reference={booking.reference}
                  perDay={formatMoney(vehicle.driverPerDayMinor, booking.currency)}
                  days={hireDays}
                  total={formatMoney(vehicle.driverPerDayMinor * hireDays, booking.currency)}
                />
              </div>
            ) : null}

            {outstanding === 0 ? (
              <p className="mt-5 rounded-[var(--radius-inset)] border border-forest-300 bg-forest-100 p-4 text-2xs leading-relaxed text-forest-900">
                Settled in full. Nothing further to pay.
              </p>
            ) : null}

            {outstanding > 0 && !payable ? (
              <p className="mt-5 rounded-[var(--radius-inset)] border border-[var(--line)] bg-[var(--paper-sunken)] p-4 text-2xs leading-relaxed text-[var(--ink-muted)]">
                This booking can no longer be paid online. Call{" "}
                {site.contact.phone} quoting{" "}
                <span className="tnum font-semibold">{booking.reference}</span>.
              </p>
            ) : null}
          </div>

          {/* A completed trip earns the review form; one review per booking. */}
          {booking.status === "COMPLETED" && !booking.review ? (
            <ReviewForm reference={booking.reference} />
          ) : null}

          {booking.review ? (
            <p className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-sunken)] p-6 text-2xs leading-relaxed text-[var(--ink-muted)]">
              You rated this {booking.review.rating}/5.{" "}
              {booking.review.status === "PUBLISHED"
                ? "Your review is live on the listing."
                : "It is with our team for approval."}
            </p>
          ) : null}

          {isCancellable(booking.status) ? (
            <CancelBookingForm reference={booking.reference} />
          ) : (
            <p className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-sunken)] p-6 text-2xs leading-relaxed text-[var(--ink-muted)]">
              This booking can no longer be cancelled online.{" "}
              <Link href="/contact" className="link-draw text-clay-700">
                Contact us
              </Link>{" "}
              if you need to change it.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
