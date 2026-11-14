import Image from "next/image";
import { notFound } from "next/navigation";
import { AgreementSigner } from "@/components/booking/agreement-signer";
import { AgreementText } from "@/components/booking/agreement-text";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { agreementForBooking } from "@/lib/agreement-booking";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = {
  title: "Hire agreement",
  robots: { index: false, follow: false },
};

export default async function AgreementPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const user = await requireUser(`/account/bookings/${reference}/agreement`);

  // Scoped by customerId: another customer's reference is a 404, not their agreement.
  const booking = await db.booking.findFirst({
    where: { reference, customerId: user.id, serviceType: "VEHICLE" },
    select: {
      id: true,
      resourceId: true,
      reference: true,
      startDate: true,
      endDate: true,
      totalMinor: true,
      currency: true,
      details: true,
      customer: { select: { fullName: true, email: true, phone: true } },
      provider: { select: { businessName: true } },
      agreement: true,
    },
  });
  if (!booking) notFound();

  // A signed agreement is shown exactly as it was signed, not rebuilt.
  const body = booking.agreement
    ? booking.agreement.body
    : ((await agreementForBooking(booking.id))?.body ?? "");

  const text = <AgreementText body={body} />;

  if (booking.agreement) {
    return (
      <>
        <DashboardHead
          back={{ href: `/account/bookings/${reference}`, label: "Back to the booking" }}
          title="Hire agreement"
          lede={`Signed by ${booking.agreement.signedName} on ${new Intl.DateTimeFormat("en-GB", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "UTC",
          }).format(booking.agreement.signedAt)}.`}
        />

        <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-7">
          {text}

          <div className="mt-8 border-t border-[var(--line)] pt-6">
            <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              Signature
            </p>
            {/* The stored PNG, not an upload: unoptimized keeps it exactly as drawn. */}
            <Image
              src={booking.agreement.signature}
              alt={`Signature of ${booking.agreement.signedName}`}
              width={320}
              height={120}
              unoptimized
              className="mt-2 h-28 w-auto"
            />
            <p className="mt-2 text-sm font-medium">{booking.agreement.signedName}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardHead
        back={{ href: `/account/bookings/${reference}`, label: "Back to the booking" }}
        title="Hire agreement"
        lede="Read this through and sign it before you collect the vehicle."
      />

      <AgreementSigner reference={booking.reference}>{text}</AgreementSigner>
    </>
  );
}
