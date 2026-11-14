import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink, Lock } from "lucide-react";
import { PesapalFrame } from "@/components/booking/pesapal-frame";
import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Secure payment",
  robots: { index: false, follow: false },
};

// Only Pesapal's own payment pages are ever embedded here.
const PESAPAL_HOSTS = new Set(["pay.pesapal.com", "cybqa.pesapal.com"]);

// An order older than this is treated as abandoned; the booking page starts a fresh one.
const ORDER_FRESH_MS = 2 * 60 * 60 * 1000;
const freshSince = () => new Date(Date.now() - ORDER_FRESH_MS);

function embeddable(raw: unknown) {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && PESAPAL_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function PayPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const user = await requireUser(`/checkout/${reference}/pay`);

  // The customer's own booking and its most recent open Pesapal order.
  const booking = await db.booking.findFirst({
    where: { reference, customerId: user.id },
    select: {
      reference: true,
      totalMinor: true,
      currency: true,
      payments: {
        where: { status: "INITIATED", createdAt: { gte: freshSince() } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { amountMinor: true, createdAt: true, gatewayResponse: true },
      },
    },
  });
  if (!booking) notFound();

  const order = booking.payments[0];
  const src = order ? embeddable((order.gatewayResponse as { redirect_url?: unknown } | null)?.redirect_url) : null;
  if (!order || !src) {
    redirect(`/account/bookings/${reference}`);
  }

  const facts = [
    { label: "Booking", value: booking.reference },
    {
      label: "Date",
      value: new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Africa/Kigali" }).format(order.createdAt),
    },
    { label: "Amount due now", value: formatMoney(order.amountMinor, booking.currency) },
    { label: "Payment method", value: "Pesapal (mobile money & cards)" },
  ];

  return (
    <PageShell>
      <Container wide className="py-12 lg:py-16">
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:flex lg:divide-x lg:divide-[var(--line)]">
          {facts.map((f) => (
            <div key={f.label} className="lg:px-8 lg:first:pl-0">
              <dt className="text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">{f.label}</dt>
              <dd className="tnum mt-1 text-lg font-semibold">{f.value}</dd>
            </div>
          ))}
        </dl>

        {order.amountMinor < booking.totalMinor ? (
          <p className="mt-4 text-2xs text-[var(--ink-muted)]">
            Booking total {formatMoney(booking.totalMinor, booking.currency)}. The rest is paid later from your booking page.
          </p>
        ) : null}

        <div className="mt-8 overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-white">
          <PesapalFrame src={src} />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-2xs text-[var(--ink-muted)]">
          <p className="flex items-center gap-2">
            <Lock className="size-3.5 text-forest-700" />
            Payments are handled by Pesapal, a licensed payment provider. We never see your card or PIN.
          </p>
          <span className="flex flex-wrap gap-5">
            {/* For a browser that blocks embedded payment pages. */}
            <a href={src} target="_blank" rel="noopener noreferrer" className="link-draw flex items-center gap-1.5">
              Open the payment page in a new tab <ExternalLink className="size-3" />
            </a>
            <Link href={`/account/bookings/${booking.reference}`} className="link-draw">
              Back to my booking
            </Link>
          </span>
        </div>
      </Container>
    </PageShell>
  );
}
