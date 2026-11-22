import Image from "next/image";
import Link from "next/link";
import { FileText, ShieldCheck } from "lucide-react";
import { AgreementText } from "@/components/booking/agreement-text";
import { Badge } from "@/components/ui/primitives";
import { STATUS_LABEL, STATUS_TONE, dayCount } from "@/lib/booking";
import type { BookingDetail } from "@/lib/booking-detail";
import { DOCUMENT_LABELS } from "@/lib/booking-documents";
import { bookingExtras, transferPriceLines } from "@/lib/booking-extras";
import { RESIDENCY_LABELS, isResidency } from "@/lib/residency";
import { formatDateRange, formatMoney } from "@/lib/utils";

// Rwandan time, to the minute — when something happened matters in a dispute.
const when = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Kigali" }).format(d) : "—";

type Details = {
  depositPercent?: number;
  terms?: { acceptedAt?: string; version?: number };
  residency?: unknown;
  ratePerPersonMinor?: number;
  withDriver?: boolean;
  driverPerDayMinor?: number;
  driverTotalMinor?: number;
  insuranceChargeMinor?: number;
  damageLiability?: { acceptedAt?: string; amountMinor?: number; text?: string };
  // distanceKm: transfers booked before zone pricing.
  transfer?: { distanceKm?: number };
};

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6 ${className ?? ""}`}>
      <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-[var(--line)] text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-2.5 first:pt-0 last:pb-0">
          <dt className="text-[var(--ink-muted)]">{label}</dt>
          <dd className="tnum min-w-0 text-right font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One booking, everything known about it. Shared by the admin and provider pages. */
export function BookingDetailView({
  booking,
  title,
  kind,
  listingHref,
  actions,
}: {
  booking: BookingDetail;
  title: string;
  kind: string;
  listingHref?: string | null;
  /** Confirm / decline / cancel, as the viewer is allowed. */
  actions?: React.ReactNode;
}) {
  const d = (booking.details ?? {}) as Details;
  const money = (minor: number | undefined | null) => (minor == null ? "—" : formatMoney(minor, booking.currency));
  const isTransfer = booking.serviceType === "TRANSFER";
  const days = dayCount(booking.startDate, booking.endDate);
  const paid = booking.payments.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + p.amountMinor, 0);
  const extras = bookingExtras(booking.details);

  // How the total was reached, from what was saved at booking.
  const driver = d.driverTotalMinor ?? 0;
  const base = booking.totalMinor - driver;
  const transferLines = transferPriceLines(booking.details);
  const units = booking.serviceType === "TOUR" || isTransfer ? booking.guests : days;
  const unitWord = isTransfer ? "passengers" : booking.serviceType === "TOUR" ? "guests" : booking.serviceType === "ROOM" ? "nights" : "days";

  return (
    <div className="space-y-6">
      {/* Summary */}
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6">
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">{kind}</p>
          <p className="mt-1 font-display text-2xl">
            {listingHref ? (
              <Link href={listingHref} className="link-draw" target="_blank">
                {title}
              </Link>
            ) : (
              title
            )}
          </p>
          <p className="tnum mt-1 text-sm text-[var(--ink-muted)]">
            {booking.reference} · {isTransfer ? when(booking.startDate).split(",")[0] : formatDateRange(booking.startDate, booking.endDate)} ·{" "}
            {booking.guests} {isTransfer ? "passengers" : booking.guests === 1 ? "guest" : "guests"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <Badge tone={STATUS_TONE[booking.status]}>{STATUS_LABEL[booking.status]}</Badge>
          <p className="tnum font-display text-2xl">{money(booking.totalMinor)}</p>
          {actions}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Customer">
          <Rows
            rows={[
              ["Name", booking.customer.fullName],
              ["Email", <a key="e" href={`mailto:${booking.customer.email}`} className="link-draw">{booking.customer.email}</a>],
              ["Phone", booking.customer.phone ? <a key="p" href={`tel:${booking.customer.phone}`} className="link-draw">{booking.customer.phone}</a> : "—"],
              ...extras
                .filter((e) => e.key === "traveller" || e.key === "phone")
                .map((e) => [e.label, e.value] as [string, React.ReactNode]),
            ]}
          />
          {booking.customerNotes ? (
            <p className="mt-4 whitespace-pre-wrap rounded-[var(--radius-inset)] bg-[var(--paper-sunken)] p-3 text-sm italic text-[var(--ink-muted)]">
              “{booking.customerNotes}”
            </p>
          ) : null}
        </Card>

        <Card title="Booking">
          <Rows
            rows={[
              ["Provider", booking.provider.businessName],
              ...(booking.provider.phone ? [["Provider phone", booking.provider.phone] as [string, React.ReactNode]] : []),
              [isTransfer ? "Date" : "Dates", isTransfer ? when(booking.startDate).split(",")[0] : `${formatDateRange(booking.startDate, booking.endDate)} (${days} ${booking.serviceType === "ROOM" ? "nights" : "days"})`],
              ...extras
                .filter((e) => e.key !== "traveller" && e.key !== "phone")
                .map((e) => [e.label, e.value] as [string, React.ReactNode]),
              ["Booked", when(booking.createdAt)],
              ["Terms accepted", d.terms?.acceptedAt ? `${when(new Date(d.terms.acceptedAt))} (version ${d.terms.version ?? 0})` : "Not yet — held at step one"],
            ]}
          />
        </Card>

        <Card title="Price">
          <Rows
            rows={[
              // Zone-priced transfers are per vehicle: the fare, then any surcharges.
              ...(transferLines
                ? transferLines.map((l) => [l.label, money(l.minor)] as [string, React.ReactNode])
                : [
                    [
                      isResidency(d.residency)
                        ? `${RESIDENCY_LABELS[d.residency]} rate × ${units} ${unitWord}`
                        : `${money(Math.round(base / Math.max(1, units)))} × ${units} ${unitWord}`,
                      money(base),
                    ] as [string, React.ReactNode],
                  ]),
              ...(driver ? [[`Driver ${money(d.driverPerDayMinor)} × ${days} days`, money(driver)] as [string, React.ReactNode]] : []),
              ...(d.transfer?.distanceKm ? [["Distance measured", `${d.transfer.distanceKm} km`] as [string, React.ReactNode]] : []),
              ["Total", money(booking.totalMinor)],
              ["Paid", money(paid)],
              ["Outstanding", money(Math.max(0, booking.totalMinor - paid))],
              ...(d.depositPercent && d.depositPercent < 100 ? [["Deposit quoted", `${d.depositPercent}%`] as [string, React.ReactNode]] : []),
            ]}
          />
          {d.damageLiability?.amountMinor ? (
            <p className="mt-4 flex gap-2 rounded-[var(--radius-inset)] bg-[var(--paper-sunken)] p-3 text-2xs leading-relaxed text-[var(--ink-muted)]">
              <ShieldCheck className="mt-px size-3.5 shrink-0 text-forest-700" />
              <span>
                Damage liability of <strong>{money(d.damageLiability.amountMinor)}</strong> accepted{" "}
                {d.damageLiability.acceptedAt ? when(new Date(d.damageLiability.acceptedAt)) : ""}.
              </span>
            </p>
          ) : null}
        </Card>

        <Card title="Payments">
          {booking.payments.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No payment attempts yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--line)] text-sm">
              {booking.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <span>
                    <span className="tnum font-medium">{formatMoney(p.amountMinor, p.currency)}</span>
                    <span className="block text-2xs text-[var(--ink-faint)]">
                      {when(p.paidAt ?? p.createdAt)} · {p.gateway === "URUBUTOPAY" ? "UrubutoPay" : "Pesapal"} {p.transactionId ? `· ${p.transactionId.slice(0, 13)}…` : ""}
                    </span>
                  </span>
                  <Badge tone={p.status === "SUCCEEDED" ? "forest" : p.status === "FAILED" ? "clay" : "neutral"}>{p.status.toLowerCase()}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {booking.serviceType === "VEHICLE" ? (
        <Card title="Driving licence and ID">
          {booking.documents.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">Not uploaded yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {booking.documents.map((doc) => (
                <a
                  key={doc.id}
                  href={`/api/documents/${doc.id}`}
                  target="_blank"
                  rel="noopener"
                  className="group block overflow-hidden rounded-[var(--radius-inset)] border border-[var(--line)] transition-colors hover:border-forest-800"
                >
                  {doc.contentType.startsWith("image/") ? (
                    // Served by the access-checked route, so a plain img — the optimiser can't fetch it.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/documents/${doc.id}`} alt={DOCUMENT_LABELS[doc.kind].label} className="h-48 w-full bg-[var(--paper-sunken)] object-contain" />
                  ) : (
                    <span className="grid h-48 place-items-center bg-[var(--paper-sunken)]">
                      <FileText className="size-10 text-[var(--ink-faint)]" />
                    </span>
                  )}
                  <span className="block border-t border-[var(--line)] px-3 py-2 text-sm">
                    <span className="font-medium">{DOCUMENT_LABELS[doc.kind].label}</span>
                    <span className="block text-2xs text-[var(--ink-faint)]">
                      {doc.fileName} · {Math.max(1, Math.round(doc.size / 1024))} KB · {when(doc.uploadedAt)}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {booking.agreement ? (
        <Card title="Signed hire agreement">
          <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
            <Rows
              rows={[
                ["Signed by", booking.agreement.signedName],
                ["Signed at", when(booking.agreement.signedAt)],
                ["Agreement version", booking.agreement.version === 0 ? "Built-in" : `v${booking.agreement.version}`],
                ["IP address", booking.agreement.ipAddress ?? "—"],
                ["Device", <span key="ua" className="block max-w-[22rem] truncate" title={booking.agreement.userAgent ?? ""}>{booking.agreement.userAgent ?? "—"}</span>],
              ]}
            />
            <div className="rounded-[var(--radius-inset)] border border-[var(--line)] bg-white p-3">
              <Image
                src={booking.agreement.signature}
                alt={`Signature of ${booking.agreement.signedName}`}
                width={280}
                height={110}
                unoptimized
                className="h-28 w-auto"
              />
              <p className="mt-1 text-center text-2xs text-[var(--ink-faint)]">{booking.agreement.signedName}</p>
            </div>
          </div>
          <details className="mt-5 rounded-[var(--radius-inset)] border border-[var(--line)]">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Read the agreement as signed</summary>
            <div className="max-h-[32rem] overflow-y-auto border-t border-[var(--line)] p-5">
              <AgreementText body={booking.agreement.body} />
            </div>
          </details>
        </Card>
      ) : booking.serviceType === "VEHICLE" ? (
        <Card title="Signed hire agreement">
          <p className="text-sm text-[var(--ink-muted)]">Not signed yet.</p>
        </Card>
      ) : null}

      <Card title="Timeline">
        <ol className="space-y-2 text-sm">
          <li>
            <span className="tnum text-[var(--ink-faint)]">{when(booking.createdAt)}</span> — Held by {booking.customer.fullName}
          </li>
          {d.terms?.acceptedAt ? (
            <li>
              <span className="tnum text-[var(--ink-faint)]">{when(new Date(d.terms.acceptedAt))}</span> — Terms accepted, booking confirmed by the customer
            </li>
          ) : null}
          {booking.agreement ? (
            <li>
              <span className="tnum text-[var(--ink-faint)]">{when(booking.agreement.signedAt)}</span> — Hire agreement signed
            </li>
          ) : null}
          {booking.payments
            .filter((p) => p.status === "SUCCEEDED")
            .map((p) => (
              <li key={p.id}>
                <span className="tnum text-[var(--ink-faint)]">{when(p.paidAt ?? p.createdAt)}</span> — Paid {formatMoney(p.amountMinor, p.currency)}
              </li>
            ))}
          {booking.cancelledAt ? (
            <li>
              <span className="tnum text-[var(--ink-faint)]">{when(booking.cancelledAt)}</span> — {STATUS_LABEL[booking.status]}
              {booking.cancellationReason ? `: ${booking.cancellationReason}` : ""}
            </li>
          ) : null}
          <li>
            <span className="tnum text-[var(--ink-faint)]">{when(booking.updatedAt)}</span> — Last updated ({STATUS_LABEL[booking.status]})
          </li>
        </ol>
      </Card>
    </div>
  );
}
