import { documentDeadline } from "@/lib/document-access";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { Check, ImageIcon } from "lucide-react";
import { AgreementText } from "@/components/booking/agreement-text";
import { CheckoutForm, type CheckoutMode } from "@/components/booking/checkout-form";
import { agreementForBooking } from "@/lib/agreement-booking";
import { DOCUMENT_ACCEPT, DOCUMENT_LABELS, requiredDocuments } from "@/lib/booking-documents";
import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/primitives";
import { dayCount } from "@/lib/booking";
import { resolveBookingSubjectDetails } from "@/lib/booking-display";
import { bookingExtras, transferPriceLines } from "@/lib/booking-extras";
import { tourIncludes } from "@/lib/content";
import { db } from "@/lib/db";
import { nextCharge, quotedDepositPercent } from "@/lib/deposit";
import { CHECKOUT_STATUSES } from "@/lib/payments";
import { bookingPaymentAvailability } from "@/lib/collections/checkout";
import { requireUser } from "@/lib/session";
import { getSiteSettings } from "@/lib/settings";
import { cn, formatDateRange, formatMoney } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Payment & complete",
  robots: { index: false, follow: false },
};

/** The listing's photo and what the price includes, for the order summary. */
async function summaryExtras(serviceType: string, resourceId: string) {
  if (serviceType === "TOUR") {
    const t = await db.tour.findUnique({ where: { id: resourceId }, select: { images: true } });
    return { image: t?.images[0], includes: tourIncludes };
  }
  if (serviceType === "ROOM") {
    const r = await db.room.findUnique({
      where: { id: resourceId },
      select: { images: true, hotel: { select: { images: true, amenities: true } } },
    });
    return { image: r?.images[0] ?? r?.hotel.images[0], includes: r?.hotel.amenities ?? [] };
  }
  if (serviceType === "VEHICLE") {
    const v = await db.vehicle.findUnique({ where: { id: resourceId }, select: { images: true, features: true } });
    return { image: v?.images[0], includes: v?.features ?? [] };
  }
  return { image: undefined, includes: [] as string[] };
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const user = await requireUser(`/checkout/${reference}`);

  const booking = await db.booking.findFirst({
    where: { reference, customerId: user.id },
    include: {
      payments: { where: { status: "SUCCEEDED" }, select: { amountMinor: true } },
      agreement: { select: { id: true } },
      // Never the file bytes here, only what the form needs to show.
      documents: { select: { id: true, kind: true, fileName: true, uploadedAt: true, expiresAt: true } },
    },
  });
  if (!booking) notFound();

  // Once money has moved, or the booking has ended, the booking page takes over.
  const paid = booking.payments.reduce((s, p) => s + p.amountMinor, 0);
  const open = (CHECKOUT_STATUSES as readonly string[]).includes(booking.status);
  if (paid > 0 || !open) redirect(`/account/bookings/${reference}`);

  const [subjects, extras, settings] = await Promise.all([
    resolveBookingSubjectDetails([booking]),
    summaryExtras(booking.serviceType, booking.resourceId),
    getSiteSettings(),
  ]);
  const subject = subjects.get(booking.resourceId);

  const details = (booking.details ?? {}) as {
    ratePerPersonMinor?: number;
    driverTotalMinor?: number;
  };
  const charge = nextCharge(
    booking.totalMinor,
    0,
    quotedDepositPercent(booking.details, settings.depositPercent),
    booking.currency,
  );
  const amount = formatMoney(charge.amountMinor, booking.currency);
  // Online needs the gateway set up and the admin's switch on for this service.
  const online = await bookingPaymentAvailability(booking, paid);
  // Hotels are never paid online; everything else is, once the gateway is on.
  const mode: CheckoutMode =
    booking.serviceType === "ROOM" ? "property" : online ? "online" : "phone";

  // Car hire signs the agreement here, unless it was signed already.
  const documentPolicy = await db.operationsPolicy.findUnique({ where: { id: 1 } });
  const agreement =
    booking.serviceType === "VEHICLE" && !booking.agreement
      ? await agreementForBooking(booking.id)
      : null;

  const transfer = (booking.details as { transfer?: { time?: string } } | null)?.transfer;
  const when = transfer
    ? `${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(booking.startDate)}${transfer.time ? ` at ${transfer.time}` : ""}`
    : formatDateRange(booking.startDate, booking.endDate);

  // The priced lines, mirroring how the server worked out the total.
  const days = dayCount(booking.startDate, booking.endDate);
  const driver = details.driverTotalMinor ?? 0;
  const base = booking.totalMinor - driver;
  const perHead = booking.serviceType === "TOUR" || booking.serviceType === "TRANSFER";
  const unitCount = perHead ? booking.guests : days;
  const unitWord =
    booking.serviceType === "TRANSFER"
      ? booking.guests === 1 ? "passenger" : "passengers"
      : booking.serviceType === "TOUR"
      ? booking.guests === 1 ? "guest" : "guests"
      : booking.serviceType === "ROOM"
        ? days === 1 ? "night" : "nights"
        : days === 1 ? "day" : "days";
  // Zone-priced transfers are per vehicle, not per head.
  const transferLines = transferPriceLines(booking.details);
  const lines = transferLines
    ? transferLines.map((l) => ({ label: l.label, value: formatMoney(l.minor, booking.currency) }))
    : [
        {
          label: `${formatMoney(Math.round(base / Math.max(1, unitCount)), booking.currency)} × ${unitCount} ${unitWord}`,
          value: formatMoney(base, booking.currency),
        },
        ...(driver ? [{ label: "Driver", value: formatMoney(driver, booking.currency) }] : []),
      ];

  return (
    <PageShell>
      <Container wide className="py-12 lg:py-16">
        {/* Where they are in the booking. */}
        <ol className="flex items-center gap-4 text-sm">
          <Step n={1} label="Details" />
          <li aria-hidden className="h-px w-10 bg-[var(--line-strong)]" />
          <Step n={2} label="Payment & complete" current />
        </ol>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <CheckoutForm
            reference={booking.reference}
            mode={mode}
            agreement={agreement ? <AgreementText body={agreement.body} /> : undefined}
            documents={
              booking.serviceType === "VEHICLE"
                ? requiredDocuments(booking.details).map((kind) => {
                    const have = documentPolicy?.documentsEnabled ? booking.documents.find((d) => d.kind === kind && documentDeadline(d.uploadedAt, d.expiresAt, documentPolicy.documentDays) > new Date()) : undefined;
                    return {
                      kind,
                      ...DOCUMENT_LABELS[kind],
                      uploaded: have ? { id: have.id, fileName: have.fileName } : undefined,
                    };
                  })
                : []
            }
            documentNotice={documentPolicy?.documentsEnabled ? `${documentPolicy.documentPurpose} Maximum retention: ${documentPolicy.documentDays} days from upload. Copies are restricted to you, the approved booking provider and administrators. Expired files cannot be downloaded; contact support about deletion.` : undefined}
            documentAccept={DOCUMENT_ACCEPT}
            buttonLabel={
              mode === "property"
                ? "Confirm booking"
                : mode === "phone"
                  ? "Confirm booking request"
                  : charge.kind === "deposit"
                  ? `Confirm booking · pay ${amount} deposit`
                  : `Confirm booking · ${amount}`
            }
            note={
              mode !== "property" && charge.kind === "deposit"
                ? `The remaining ${formatMoney(booking.totalMinor - charge.amountMinor, booking.currency)} is paid later from your booking page.`
                : undefined
            }
          />

          <aside className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6 sm:p-7">
            <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              Order summary
            </p>
            <div className="mt-5 flex gap-4">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-[var(--radius-inset)] bg-[var(--paper-sunken)]">
                {extras.image ? (
                  <Image src={extras.image} alt="" fill sizes="80px" className="object-cover" />
                ) : (
                  <ImageIcon className="absolute inset-0 m-auto size-6 text-[var(--ink-faint)]" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-display text-lg leading-snug">{subject?.title ?? "Booking"}</p>
                <p className="mt-1 text-2xs text-[var(--ink-muted)]">
                  {subject?.kind} · {when}
                </p>
                <p className="tnum mt-1 text-2xs text-[var(--ink-faint)]">Ref {booking.reference}</p>
              </div>
            </div>

            <dl className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)] text-sm">
              {bookingExtras(booking.details).map((e) => (
                <div key={e.key} className="flex justify-between gap-4 py-3">
                  <dt className="text-[var(--ink-muted)]">{e.label}</dt>
                  <dd className="text-right font-medium">{e.value}</dd>
                </div>
              ))}
              {lines.map((l) => (
                <div key={l.label} className="tnum flex justify-between gap-4 py-3">
                  <dt className="text-[var(--ink-muted)]">{l.label}</dt>
                  <dd>{l.value}</dd>
                </div>
              ))}
              <div className="tnum flex justify-between gap-4 py-3 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatMoney(booking.totalMinor, booking.currency)}</dd>
              </div>
              {mode !== "property" && charge.kind === "deposit" ? (
                <div className="tnum flex justify-between gap-4 py-3">
                  <dt className="text-[var(--ink-muted)]">Due now (deposit)</dt>
                  <dd className="font-medium">{amount}</dd>
                </div>
              ) : null}
            </dl>

            {extras.includes.length ? (
              <>
                <p className="mt-6 text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                  What&rsquo;s included
                </p>
                <ul className="mt-3 space-y-2">
                  {extras.includes.slice(0, 8).map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm text-[var(--ink-muted)]">
                      <Check className="mt-0.5 size-4 shrink-0 text-forest-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </aside>
        </div>
      </Container>
    </PageShell>
  );
}

function Step({ n, label, current = false }: { n: number; label: string; current?: boolean }) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className={cn(
          "grid size-8 place-items-center rounded-full text-sm font-semibold",
          current ? "bg-forest-800 text-bone-50" : "bg-[var(--paper-sunken)] text-[var(--ink-muted)]",
        )}
      >
        {n}
      </span>
      <span className={current ? "font-semibold" : "text-[var(--ink-muted)]"}>{label}</span>
    </li>
  );
}
