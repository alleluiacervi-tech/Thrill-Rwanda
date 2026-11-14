import { notFound } from "next/navigation";
import { adminTransitionBooking } from "@/app/actions/admin";
import { BookingActions } from "@/components/dashboard/booking-actions";
import { BookingDetailView } from "@/components/dashboard/booking-detail-view";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { allowedTransitions } from "@/lib/booking";
import { loadBookingDetail } from "@/lib/booking-detail";
import { resolveBookingSubjectDetails } from "@/lib/booking-display";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Booking", robots: { index: false, follow: false } };

export default async function AdminBookingPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  await requireAdmin(`/admin/bookings/${reference}`);

  const booking = await loadBookingDetail({ reference });
  if (!booking) notFound();

  const subject = (await resolveBookingSubjectDetails([booking])).get(booking.resourceId);
  const next = allowedTransitions("ADMIN", booking.status);

  return (
    <>
      <DashboardHead
        back={{ href: "/admin/bookings", label: "All bookings" }}
        title={`Booking ${booking.reference}`}
        lede={`${booking.customer.fullName} · ${booking.provider.businessName}`}
      />
      <BookingDetailView
        booking={booking}
        title={subject?.title ?? "Booking"}
        kind={subject?.kind ?? booking.serviceType}
        listingHref={subject?.href}
        actions={
          next.length ? (
            <BookingActions action={adminTransitionBooking} reference={booking.reference} next={next} />
          ) : null
        }
      />
    </>
  );
}
