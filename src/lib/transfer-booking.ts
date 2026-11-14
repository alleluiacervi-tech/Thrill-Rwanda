import { DEFAULT_CURRENCY } from "@/lib/utils";
import { BookingError, assertNotice, newReference, toUtcDay } from "@/lib/booking";
import { db } from "@/lib/db";
import { priceZoneTrip, type ZoneTripInput } from "@/lib/transfer-quote";

/** Transfers are run by the in-house team, so bookings belong to its provider record. */
export const TRANSFER_PROVIDER_SLUG = "thrill-rwanda-in-house";

export type TransferBookingInput = ZoneTripInput & {
  customerId: string;
  date: string;
  flight?: string;
  notes?: string;
  depositPercent: number;
};

/**
 * Books a transfer at today's zone price.
 *
 * Priced again here, never from the form: the browser only says where, which vehicle and how many.
 * No calendar is held — a transfer is a single trip, not stock.
 */
export async function createTransferBooking(input: TransferBookingInput) {
  const start = toUtcDay(input.date);
  if (start < toUtcDay(new Date())) {
    throw new BookingError("That date is in the past.", "INVALID_DATES");
  }
  await assertNotice(start);

  const trip = await priceZoneTrip(input);
  if ("error" in trip) throw new BookingError(trip.error, "UNAVAILABLE");

  const provider = await db.provider.findUnique({
    where: { slug: TRANSFER_PROVIDER_SLUG },
    select: { id: true },
  });
  if (!provider) throw new BookingError("Transfers can't be booked online just now.", "NOT_FOUND");

  const end = new Date(start.getTime() + 86_400_000);

  return db.booking.create({
    data: {
      reference: newReference(),
      customerId: input.customerId,
      providerId: provider.id,
      serviceType: "TRANSFER",
      // No listing row behind a transfer; the provider stands in so the id is stable.
      resourceId: provider.id,
      startDate: start,
      endDate: end,
      guests: input.passengers,
      units: 1,
      subtotalMinor: trip.totalMinor,
      totalMinor: trip.totalMinor,
      currency: DEFAULT_CURRENCY,
      status: "AWAITING_PAYMENT",
      customerNotes: input.notes || undefined,
      details: {
        depositPercent: input.depositPercent,
        transfer: {
          pickup: trip.pickup,
          dropoff: trip.dropoff,
          time: input.time,
          flight: input.flight || null,
          vehicle: trip.vehicleLabel,
          zone: trip.zoneName,
          fareMinor: trip.fareMinor,
          extras: trip.extras,
        },
      },
    },
  });
}
