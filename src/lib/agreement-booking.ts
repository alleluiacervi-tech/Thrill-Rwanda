import { buildAgreement } from "@/lib/agreement";
import { dayCount } from "@/lib/booking";
import { db } from "@/lib/db";
import { getSite } from "@/lib/settings";
import { formatDateRange, formatMoney } from "@/lib/utils";

// The provider record for the company's own vehicles and transfers.
const IN_HOUSE_SLUG = "thrill-rwanda-in-house";

/** The car hire agreement for one booking, filled in from the booking, customer and vehicle. */
export async function agreementForBooking(bookingId: string) {
  const site = await getSite();
  const companyContact = `${site.contact.address} · ${site.contact.phone} · ${site.contact.email}`;
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      reference: true,
      serviceType: true,
      resourceId: true,
      startDate: true,
      endDate: true,
      totalMinor: true,
      currency: true,
      details: true,
      customer: { select: { fullName: true, email: true, phone: true } },
      provider: { select: { businessName: true, slug: true } },
    },
  });
  if (!booking || booking.serviceType !== "VEHICLE") return null;

  const vehicle = await db.vehicle.findUnique({
    where: { id: booking.resourceId },
    select: { make: true, model: true, year: true, insuranceChargeMinor: true },
  });

  const details = booking.details as
    | { withDriver?: boolean; damageLiability?: { text?: string; amountMinor?: number } }
    | null;
  const liabilityAmount = details?.damageLiability?.amountMinor ?? vehicle?.insuranceChargeMinor ?? null;

  return buildAgreement({
    customerName: booking.customer.fullName,
    customerEmail: booking.customer.email,
    customerPhone: booking.customer.phone ?? "—",
    reference: booking.reference,
    vehicle: vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.year})` : "the hired vehicle",
    dates: formatDateRange(booking.startDate, booking.endDate),
    days: String(dayCount(booking.startDate, booking.endDate)),
    total: formatMoney(booking.totalMinor, booking.currency),
    driver: details?.withDriver ? "With a driver" : "Self-drive",
    liability: liabilityAmount
      ? details?.damageLiability?.text
        ? details.damageLiability.text.replaceAll("{amount}", formatMoney(liabilityAmount))
        : `The Hirer is liable for up to ${formatMoney(liabilityAmount)} in the event of damage to the vehicle.`
      : "No damage liability amount has been set for this vehicle.",
    provider: booking.provider.businessName,
    // The company's own fleet is owned by the company; a partner's car is let through it.
    owner:
      booking.provider.slug === IN_HOUSE_SLUG
        ? `${site.legalName} (${companyContact})`
        : `${booking.provider.businessName}, through ${site.legalName} (${companyContact})`,
    company: site.legalName,
    companyContact,
    today: new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date()),
  });
}
