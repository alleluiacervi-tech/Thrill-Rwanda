import { notFound } from "next/navigation";
import { providerTransitionBooking } from "@/app/actions/provider";
import { BookingActions } from "@/components/dashboard/booking-actions";
import { BookingDetailView } from "@/components/dashboard/booking-detail-view";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { allowedTransitions } from "@/lib/booking";
import { loadBookingDetail } from "@/lib/booking-detail";
import { resolveBookingSubjectDetails } from "@/lib/booking-display";
import { requireProvider } from "@/lib/session";

export const metadata = { title: "Booking", robots: { index: false, follow: false } };

export default async function ProviderBookingPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const { providerId } = await requireProvider(`/provider/bookings/${reference}`);

  // Scoped to the session's provider: another provider's reference is a 404.
  const booking = await loadBookingDetail({ reference, providerId });
  if (!booking) notFound();

  const subject = (await resolveBookingSubjectDetails([booking])).get(booking.resourceId);
  const next = allowedTransitions("PROVIDER", booking.status);

  return (
    <>
      <DashboardHead
        back={{ href: "/provider/bookings", label: "Bookings" }}
        title={`Booking ${booking.reference}`}
        lede={booking.customer.fullName}
      />
      <BookingDetailView
        booking={booking}
        title={subject?.title ?? "Booking"}
        kind={subject?.kind ?? booking.serviceType}
        listingHref={subject?.href}
        actions={
          next.length ? (
            <BookingActions action={providerTransitionBooking} reference={booking.reference} next={next} />
          ) : null
        }
      />
    </>
  );
}
