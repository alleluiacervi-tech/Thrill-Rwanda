import { notFound, redirect } from "next/navigation";
import { CollectionCheckout } from "@/components/booking/collection-checkout";
import { PageShell } from "@/components/layout/page-shell";
import { collectionCheckout } from "@/lib/collections/checkout";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Booking payment", robots: { index: false, follow: false } };

export default async function BookingPayPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const user = await requireUser(`/checkout/${reference}/pay`);
  const data = await collectionCheckout({ bookingReference: reference, customerId: user.id });
  if (!data) {
    const owned = await db.booking.findFirst({ where: { reference, customerId: user.id }, select: { id: true } });
    if (!owned) notFound();
    redirect(`/account/bookings/${reference}`);
  }
  return <PageShell><CollectionCheckout data={data} bookingReference={reference} /></PageShell>;
}
