import { getSite } from "@/lib/settings";
import { customAlphabet } from "nanoid";
import { db } from "@/lib/db";
import { rateFor, type Residency } from "@/lib/residency";
import type { Prisma } from "@/generated/prisma/client";
import type { BookingStatus, ServiceType } from "@/generated/prisma/enums";

/**
 * The booking engine (Step 10).
 *
 * One pipeline for tours, rooms, vehicles and transfers. The only way to
 * create a booking is `createBooking()`, and the only way a booking becomes
 * PAID is a verified payment callback (Step 14) — never a client request.
 *
 * See docs/ARCHITECTURE.md rules 1–3.
 */

/* ------------------------------------------------------------- reference */

// No I/O/0/1 — these get read aloud over the phone and written on boards.
const nano = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export function newReference() {
  // TR = Thrill Rwanda. Older bookings keep the SW- prefix they were issued with.
  return `TR-${nano()}`;
}

/* ---------------------------------------------------------------- errors */

export class BookingError extends Error {
  constructor(
    message: string,
    readonly code:
      | "UNAVAILABLE"
      | "INVALID_DATES"
      | "INVALID_UNITS"
      | "NOT_FOUND"
      | "NOT_CANCELLABLE",
  ) {
    super(message);
    this.name = "BookingError";
  }
}

/* ------------------------------------------------------------------ dates */

/** Normalises to a UTC midnight date, matching the `day` column. */
export function toUtcDay(input: Date | string) {
  const d = typeof input === "string" ? new Date(`${input}T00:00:00Z`) : input;
  if (Number.isNaN(d.getTime())) {
    throw new BookingError("Invalid date", "INVALID_DATES");
  }
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/** Whole days in [start, end). Always at least 1. */
export function dayCount(start: Date, end: Date) {
  return Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86_400_000),
  );
}

/* ----------------------------------------------------------- availability */

export type AvailabilityResult =
  | { available: true; days: number }
  | { available: false; days: number; reason: string; firstBlockedDay?: string };

/**
 * Read-only availability check, for showing the customer whether a date
 * range is bookable BEFORE they commit.
 *
 * This is advisory only. It is NOT what prevents double-booking — between
 * this read and a write, another customer can take the last unit. The
 * guarantee lives in `createBooking`'s transaction.
 */
export async function checkAvailability(params: {
  serviceType: ServiceType;
  resourceId: string;
  /** Accepts a Date or a YYYY-MM-DD string; both normalise to a UTC day. */
  startDate: Date | string;
  endDate: Date | string;
  units?: number;
}): Promise<AvailabilityResult> {
  const { serviceType, resourceId, units = 1 } = params;
  const start = toUtcDay(params.startDate);
  const end = toUtcDay(params.endDate);
  const days = dayCount(start, end);

  if (end <= start) {
    return { available: false, days, reason: "The end date must be after the start date." };
  }

  const rows = await db.availability.findMany({
    where: {
      serviceType,
      resourceId,
      day: { gte: start, lt: end },
    },
    select: { day: true, unitsTotal: true, unitsBooked: true, isBlocked: true },
    orderBy: { day: "asc" },
  });

  if (rows.length < days) {
    return {
      available: false,
      days,
      reason:
        "We don't have the calendar open that far ahead. Contact us and we'll arrange it.",
    };
  }

  const blocked = rows.find(
    (r) => r.isBlocked || r.unitsTotal - r.unitsBooked < units,
  );

  if (blocked) {
    return {
      available: false,
      days,
      reason: blocked.isBlocked
        ? "Those dates are closed for this listing."
        : "Not enough space left on those dates.",
      firstBlockedDay: blocked.day.toISOString().slice(0, 10),
    };
  }

  return { available: true, days };
}

/* --------------------------------------------------------- price snapshot */

type Priced = {
  providerId: string;
  unitPriceMinor: number;
  currency: string;
  /** Most guests one unit takes: a room's capacity, a vehicle's seats. Tours are capped by their calendar. */
  maxGuests?: number;
  /** Vehicles only: the provider's daily driver rate and the damage liability they set. */
  driverPerDayMinor?: number | null;
  insuranceChargeMinor?: number | null;
};

/** Reads the listing's current price. Called inside the booking transaction
 *  so the snapshot is taken at the same instant the inventory is held. */
async function priceResource(
  tx: Prisma.TransactionClient,
  serviceType: ServiceType,
  resourceId: string,
  /** Safaris only: decides which of the three rates applies. */
  residency?: Residency,
): Promise<Priced> {
  switch (serviceType) {
    case "TOUR": {
      const t = await tx.tour.findUnique({
        where: { id: resourceId },
        select: {
          providerId: true,
          priceMinor: true,
          priceResidentMinor: true,
          priceNonResidentMinor: true,
          currency: true,
          isPublished: true,
        },
      });
      if (!t?.isPublished) throw new BookingError("Tour not found", "NOT_FOUND");
      // The rate is chosen below, where the booking's residency is known.
      return {
        providerId: t.providerId,
        unitPriceMinor: rateFor(t, residency ?? "CITIZEN"),
        currency: t.currency,
      };
    }
    case "ROOM": {
      const r = await tx.room.findUnique({
        where: { id: resourceId },
        select: {
          pricePerNightMinor: true,
          currency: true,
          capacity: true,
          isPublished: true,
          hotel: { select: { providerId: true } },
        },
      });
      if (!r?.isPublished) throw new BookingError("Room not found", "NOT_FOUND");
      return {
        providerId: r.hotel.providerId,
        unitPriceMinor: r.pricePerNightMinor,
        currency: r.currency,
        maxGuests: r.capacity,
      };
    }
    case "VEHICLE": {
      const v = await tx.vehicle.findUnique({
        where: { id: resourceId },
        select: {
          providerId: true,
          pricePerDayMinor: true,
          driverPerDayMinor: true,
          insuranceChargeMinor: true,
          currency: true,
          isPublished: true,
          seats: true,
        },
      });
      if (!v?.isPublished) throw new BookingError("Vehicle not found", "NOT_FOUND");
      return {
        providerId: v.providerId,
        unitPriceMinor: v.pricePerDayMinor,
        currency: v.currency,
        maxGuests: v.seats,
        driverPerDayMinor: v.driverPerDayMinor,
        insuranceChargeMinor: v.insuranceChargeMinor,
      };
    }
    case "TRANSFER":
      // Transfers are quoted per route by the desk rather than held as
      // listing inventory, so they never reach this path yet.
      throw new BookingError("Transfers are quoted manually", "NOT_FOUND");
  }
}

/**
 * How a quote is computed per product:
 *   TOUR    — price per person × guests (duration is fixed by the itinerary)
 *   ROOM    — price per night  × nights
 *   VEHICLE — price per day    × days
 */
export function quoteFor(
  serviceType: ServiceType,
  unitPriceMinor: number,
  opts: { days: number; guests: number },
) {
  const multiplier = serviceType === "TOUR" ? opts.guests : opts.days;
  return unitPriceMinor * multiplier;
}

/* --------------------------------------------------------- createBooking */

export type CreateBookingInput = {
  customerId: string;
  serviceType: ServiceType;
  resourceId: string;
  startDate: Date | string;
  endDate: Date | string;
  guests: number;
  /** Inventory units to hold (rooms, vehicles). Tours hold seats = guests. */
  units?: number;
  /** Car hire: the customer asked for a driver as well as the vehicle. */
  withDriver?: boolean;
  /** Safaris: East African citizen, resident, or non-resident. */
  residency?: Residency;
  customerNotes?: string;
  details?: Record<string, unknown>;
};

/**
 * Creates a booking, holding inventory atomically.
 *
 * The sequence inside ONE transaction:
 *   1. increment units_booked for every day in [start, end)
 *   2. assert the update touched exactly `days` rows
 *   3. snapshot the price and insert the booking
 *
 * If step 1 pushes any day past its capacity, the
 * `availability_not_overbooked` CHECK constraint raises and Postgres rolls
 * the whole transaction back. That constraint — not this code — is what
 * makes concurrent overbooking impossible. Do not "optimise" it into a
 * read-then-write.
 */
export async function createBooking(input: CreateBookingInput) {
  // Forgotten holds on this listing go back on sale before this one is checked.
  await releaseStaleHolds({ serviceType: input.serviceType, resourceId: input.resourceId });

  const start = toUtcDay(input.startDate);
  const end = toUtcDay(input.endDate);

  if (end <= start) {
    throw new BookingError("The end date must be after the start date.", "INVALID_DATES");
  }
  if (start < toUtcDay(new Date())) {
    throw new BookingError("That start date is in the past.", "INVALID_DATES");
  }
  await assertNotice(start);
  if (!Number.isInteger(input.guests) || input.guests < 1) {
    throw new BookingError("At least one guest is required.", "INVALID_UNITS");
  }

  const days = dayCount(start, end);
  // A tour holds one seat per guest; rooms and vehicles hold whole units.
  const units =
    input.serviceType === "TOUR" ? input.guests : (input.units ?? 1);

  if (!Number.isInteger(units) || units < 1) {
    throw new BookingError("Invalid number of units.", "INVALID_UNITS");
  }

  try {
    return await db.$transaction(async (tx) => {
      // 1. Hold the inventory.
      const held = await tx.availability.updateMany({
        where: {
          serviceType: input.serviceType,
          resourceId: input.resourceId,
          day: { gte: start, lt: end },
          isBlocked: false,
        },
        data: { unitsBooked: { increment: units } },
      });

      // 2. Every day in the range must have been held. A short count means
      //    a day is missing from the calendar or is blocked.
      if (held.count !== days) {
        throw new BookingError(
          "Those dates are no longer available.",
          "UNAVAILABLE",
        );
      }

      // 3. Price and write.
      const {
        providerId,
        unitPriceMinor,
        currency,
        maxGuests,
        driverPerDayMinor,
        insuranceChargeMinor,
      } = await priceResource(
        tx,
        input.serviceType,
        input.resourceId,
        input.residency,
      );

      // Enforced here, not only in the browser: the panel's limit is a convenience, this is the rule.
      if (maxGuests !== undefined && input.guests > maxGuests) {
        throw new BookingError(
          input.serviceType === "ROOM"
            ? `This room sleeps ${maxGuests}. Choose a larger room, or book a second one.`
            : `This vehicle seats ${maxGuests}. Choose a larger vehicle for ${input.guests} people.`,
          "INVALID_UNITS",
        );
      }

      const base = quoteFor(input.serviceType, unitPriceMinor, {
        days,
        guests: input.guests,
      });

      // A driver is charged per day, like the vehicle. Asking for one on a
      // vehicle that has no rate is a bad request, not a free driver.
      let driverTotal = 0;
      if (input.withDriver) {
        if (input.serviceType !== "VEHICLE" || !driverPerDayMinor) {
          throw new BookingError("A driver isn't available for this vehicle.", "INVALID_UNITS");
        }
        driverTotal = driverPerDayMinor * days;
      }

      const subtotal = base + driverTotal;

      return tx.booking.create({
        data: {
          reference: newReference(),
          customerId: input.customerId,
          providerId,
          serviceType: input.serviceType,
          resourceId: input.resourceId,
          startDate: start,
          endDate: end,
          guests: input.guests,
          units,
          subtotalMinor: subtotal,
          totalMinor: subtotal,
          currency,
          status: "AWAITING_PAYMENT",
          customerNotes: input.customerNotes,
          details: {
            ...(input.details ?? {}),
            ...(input.serviceType === "TOUR" && input.residency
              ? { residency: input.residency, ratePerPersonMinor: unitPriceMinor }
              : {}),
            ...(input.serviceType === "VEHICLE"
              ? {
                  withDriver: Boolean(input.withDriver),
                  ...(input.withDriver
                    ? { driverPerDayMinor, driverTotalMinor: driverTotal }
                    : {}),
                  ...(insuranceChargeMinor ? { insuranceChargeMinor } : {}),
                }
              : {}),
          } as Prisma.InputJsonValue,
        },
      });
    });
  } catch (err) {
    if (err instanceof BookingError) throw err;
    // The CHECK constraint firing surfaces as a Postgres error. Translate it
    // into the same message a short-count produces — from the customer's
    // point of view both mean "someone got there first".
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("availability_not_overbooked")) {
      throw new BookingError(
        "Those dates were taken while you were booking. Please try different dates.",
        "UNAVAILABLE",
      );
    }
    throw err;
  }
}

/* ------------------------------------------------------------ cancellation */

/** Statuses a customer may cancel from. COMPLETED and terminal states are out. */
const CUSTOMER_CANCELLABLE: BookingStatus[] = [
  "PENDING",
  "AWAITING_PAYMENT",
  "PAID",
  "CONFIRMED",
];

export function isCancellable(status: BookingStatus) {
  return CUSTOMER_CANCELLABLE.includes(status);
}

/**
 * Cancels a booking and releases its held inventory in one transaction.
 *
 * Scoped by `customerId` so a customer can only ever cancel their own —
 * the caller passes the id from the session, never from the request.
 */
export async function cancelBooking(params: {
  reference: string;
  customerId: string;
  reason?: string;
}) {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({
      where: { reference: params.reference, customerId: params.customerId },
      select: {
        id: true,
        status: true,
        serviceType: true,
        resourceId: true,
        startDate: true,
        endDate: true,
        units: true,
      },
    });

    if (!booking) throw new BookingError("Booking not found.", "NOT_FOUND");
    if (!isCancellable(booking.status)) {
      throw new BookingError(
        "This booking can no longer be cancelled. Contact us and we'll help.",
        "NOT_CANCELLABLE",
      );
    }

    // Give the inventory back.
    await tx.availability.updateMany({
      where: {
        serviceType: booking.serviceType,
        resourceId: booking.resourceId,
        day: { gte: booking.startDate, lt: booking.endDate },
      },
      data: { unitsBooked: { decrement: booking.units } },
    });

    return tx.booking.update({
      where: { id: booking.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: params.reason,
      },
    });
  });
}

/* ------------------------------------------------------- status vocabulary */

export const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: "Pending",
  AWAITING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

export const STATUS_TONE: Record<
  BookingStatus,
  "neutral" | "forest" | "sun" | "clay" | "outline"
> = {
  PENDING: "neutral",
  AWAITING_PAYMENT: "sun",
  PAID: "forest",
  CONFIRMED: "forest",
  REJECTED: "clay",
  CANCELLED: "outline",
  COMPLETED: "forest",
};

/* ------------------------------------------------- status state machine -- */

/**
 * Statuses that still hold inventory. Moving OUT of one of these into a
 * terminal rejection/cancellation must give the units back; moving between
 * two of them must not touch the calendar.
 */
const HOLDING: BookingStatus[] = [
  "PENDING",
  "AWAITING_PAYMENT",
  "PAID",
  "CONFIRMED",
];

/** Statuses that release inventory when entered. COMPLETED does not — the
 *  service was delivered, so those units were genuinely consumed. */
const RELEASES: BookingStatus[] = ["REJECTED", "CANCELLED"];

export type TransitionActor = "PROVIDER" | "ADMIN";

/**
 * Who may move a booking where.
 *
 * A provider accepts or declines work and marks it done. Only an admin can
 * CANCEL — cancelling on a customer's behalf is a support action, and it is
 * kept distinct from REJECTED so reporting can tell "the provider couldn't
 * take it" apart from "the trip was called off".
 */
const ALLOWED: Record<TransitionActor, Partial<Record<BookingStatus, BookingStatus[]>>> = {
  PROVIDER: {
    PENDING: ["CONFIRMED", "REJECTED"],
    AWAITING_PAYMENT: ["CONFIRMED", "REJECTED"],
    PAID: ["CONFIRMED", "REJECTED"],
    CONFIRMED: ["COMPLETED"],
  },
  ADMIN: {
    PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
    AWAITING_PAYMENT: ["CONFIRMED", "REJECTED", "CANCELLED"],
    PAID: ["CONFIRMED", "REJECTED", "CANCELLED"],
    CONFIRMED: ["COMPLETED", "CANCELLED"],
  },
};

export function allowedTransitions(
  actor: TransitionActor,
  from: BookingStatus,
): BookingStatus[] {
  return ALLOWED[actor][from] ?? [];
}

/**
 * Moves a booking to a new status, releasing inventory when required.
 *
 * `scope` is the authorisation boundary and is NOT optional for providers:
 * pass the providerId derived from the session, and the update will only
 * match a booking belonging to that provider. An admin passes no scope.
 *
 * Transitions are validated against the table above inside the transaction,
 * so two concurrent operators can't both act on the same booking — the
 * second one finds a status the transition is no longer legal from.
 */
export async function transitionBooking(params: {
  reference: string;
  to: BookingStatus;
  actor: TransitionActor;
  /** Required when actor is PROVIDER. Derived from the session. */
  providerId?: string;
  reason?: string;
}) {
  const { reference, to, actor, providerId, reason } = params;

  if (actor === "PROVIDER" && !providerId) {
    throw new BookingError("Missing provider scope.", "NOT_FOUND");
  }

  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({
      where: {
        reference,
        ...(actor === "PROVIDER" ? { providerId } : {}),
      },
      select: {
        id: true,
        status: true,
        serviceType: true,
        resourceId: true,
        startDate: true,
        endDate: true,
        units: true,
      },
    });

    if (!booking) throw new BookingError("Booking not found.", "NOT_FOUND");

    if (!allowedTransitions(actor, booking.status).includes(to)) {
      throw new BookingError(
        `A ${STATUS_LABEL[booking.status].toLowerCase()} booking can't be moved to ${STATUS_LABEL[to].toLowerCase()}.`,
        "NOT_CANCELLABLE",
      );
    }

    if (RELEASES.includes(to) && HOLDING.includes(booking.status)) {
      await tx.availability.updateMany({
        where: {
          serviceType: booking.serviceType,
          resourceId: booking.resourceId,
          day: { gte: booking.startDate, lt: booking.endDate },
        },
        data: { unitsBooked: { decrement: booking.units } },
      });
    }

    return tx.booking.update({
      where: { id: booking.id },
      data: {
        status: to,
        ...(RELEASES.includes(to)
          ? { cancelledAt: new Date(), cancellationReason: reason }
          : {}),
      },
    });
  });
}

/* -------------------------------------------------- opening the calendar */

/** How far ahead a new listing's calendar is opened. */
export const CALENDAR_DAYS = 365;

export async function openCalendar(
  tx: Prisma.TransactionClient,
  params: {
    serviceType: ServiceType;
    resourceId: string;
    unitsTotal: number;
    days?: number;
  },
) {
  const days = params.days ?? CALENDAR_DAYS;
  const start = toUtcDay(new Date());

  const rows = Array.from({ length: days }, (_, i) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + i);
    return {
      serviceType: params.serviceType,
      resourceId: params.resourceId,
      day,
      unitsTotal: params.unitsTotal,
    };
  });

  // Chunked: a single 365-row insert is fine, but this keeps the shape the
  // same if CALENDAR_DAYS is ever raised.
  const CHUNK = 500;
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const res = await tx.availability.createMany({
      data: rows.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
    written += res.count;
  }
  return written;
}

/* ---------------------------------------------------------- stale holds */

/** How long dates stay held at step one; the admin can change it in Settings. */
export const HOLD_MINUTES = 60;

/** Held at step one, never confirmed (no terms agreed, no payment started), and past the hold time. */
export function isStaleHold(
  booking: { status: BookingStatus; createdAt: Date; details: unknown; paymentCount: number },
  now: Date,
  holdMinutes = HOLD_MINUTES,
) {
  const agreed = Boolean((booking.details as { terms?: unknown } | null)?.terms);
  return (
    booking.status === "AWAITING_PAYMENT" &&
    !agreed &&
    booking.paymentCount === 0 &&
    now.getTime() - booking.createdAt.getTime() > holdMinutes * 60_000
  );
}

/**
 * Cancels unconfirmed holds so their dates go back on sale.
 *
 * Scoped to one listing when called just before a new booking, so a forgotten
 * hold never blocks the next customer; unscoped from the daily sweep.
 */
export async function releaseStaleHolds(scope?: { serviceType: ServiceType; resourceId: string }) {
  const now = new Date();
  const { holdMinutes } = (await getSite()).rules;
  const candidates = await db.booking.findMany({
    where: {
      status: "AWAITING_PAYMENT",
      createdAt: { lt: new Date(now.getTime() - holdMinutes * 60_000) },
      ...(scope ?? {}),
    },
    select: {
      id: true,
      reference: true,
      customerId: true,
      status: true,
      createdAt: true,
      details: true,
      _count: { select: { payments: true } },
    },
    take: 200,
  });

  let released = 0;
  for (const b of candidates) {
    if (!isStaleHold({ ...b, paymentCount: b._count.payments }, now, holdMinutes)) continue;
    try {
      await cancelBooking({
        reference: b.reference,
        customerId: b.customerId,
        reason: `Not confirmed within ${holdMinutes} minutes — dates released`,
      });
      // Licence and ID copies aren't kept for a booking that never happened.
      await db.bookingDocument.deleteMany({ where: { bookingId: b.id } });
      released++;
    } catch (err) {
      // Confirmed or cancelled in the meantime: nothing to release.
      if (!(err instanceof BookingError)) console.error("[holds] release failed", b.reference, err);
    }
  }
  return released;
}

/** Refuses a start date inside the admin's minimum notice. */
export async function assertNotice(start: Date) {
  const { minNoticeDays } = (await getSite()).rules;
  if (minNoticeDays <= 0) return;
  const earliest = new Date(toUtcDay(new Date()).getTime() + minNoticeDays * 86_400_000);
  if (start < earliest) {
    throw new BookingError(
      `Please book at least ${minNoticeDays} ${minNoticeDays === 1 ? "day" : "days"} ahead.`,
      "INVALID_DATES",
    );
  }
}
