import "server-only";
import { db } from "@/lib/db";
import { DuffelError } from "@/lib/duffel/client";
import { advanceTicketing, deliverItinerary, ticketingFunding } from "@/lib/ticketing";
import { bookWithDuffel, payHeldBooking, refreshDuffelTickets } from "@/lib/ticketing-duffel";
import { TicketingError } from "@/lib/ticketing-rules";

/**
 * Carries online bookings from verified payment to e-ticket, unattended.
 *
 * Each step is the desk's own (same checks, same records, acting as the
 * booking's desk owner): funds verified → ready to ticket → book or pay the
 * hold with Duffel → ticket numbers → itinerary emailed. Any refusal stops the
 * file for the desk with the reason; nothing is retried blindly, because a
 * second attempt could buy a second ticket.
 */

/** Marks a file the worker has handed to the desk; it never touches it again. */
export const NEEDS_DESK = "NEEDS_DESK";

export type AutoTicketResult = { checked: number; ticketed: number; delivered: number; stopped: number };

const file = (enquiryId: string) =>
  db.flightTicketing.findUniqueOrThrow({
    where: { enquiryId },
    select: { id: true, status: true, version: true, externalStatus: true, externalOrderId: true, deliveredAt: true },
  });

export async function runOnlineTicketing(): Promise<AutoTicketResult> {
  const result: AutoTicketResult = { checked: 0, ticketed: 0, delivered: 0, stopped: 0 };
  const open = await db.flightTicketing.findMany({
    where: {
      enquiry: { source: "ONLINE" },
      OR: [
        { status: { in: ["AWAITING_PAYMENT", "READY_TO_TICKET"] }, OR: [{ externalStatus: null }, { externalStatus: "HELD" }] },
        { status: "TICKETING", externalStatus: "BOOKED" },
        { status: "ISSUED", deliveredAt: null, NOT: { externalStatus: NEEDS_DESK } },
      ],
    },
    select: { enquiryId: true, enquiry: { select: { reference: true, ownerId: true } } },
    take: 25,
  });

  for (const row of open) {
    const { reference, ownerId } = row.enquiry;
    if (!ownerId) continue;
    result.checked++;
    try {
      let current = await file(row.enquiryId);
      if (current.status === "AWAITING_PAYMENT") {
        if (!(await ticketingFunding(db, row.enquiryId)).funded) continue;
        await advanceTicketing(ownerId, { reference, version: current.version, move: { to: "READY_TO_TICKET" } });
        current = await file(row.enquiryId);
      }
      if (current.status === "READY_TO_TICKET") {
        const outcome = current.externalStatus === "HELD"
          ? await payHeldBooking(ownerId, { reference, version: current.version })
          : await bookWithDuffel(ownerId, { reference, version: current.version });
        if (outcome.issued) result.ticketed++;
        current = await file(row.enquiryId);
      } else if (current.status === "TICKETING" && current.externalOrderId) {
        // Some airlines issue the ticket numbers a little after the booking.
        if ((await refreshDuffelTickets(ownerId, { reference })).issued) result.ticketed++;
        current = await file(row.enquiryId);
      }
      if (current.status === "ISSUED" && !current.deliveredAt) {
        await deliverItinerary(ownerId, { reference, version: current.version, channel: "EMAIL" });
        result.delivered++;
      }
    } catch (error) {
      if (!(error instanceof TicketingError || error instanceof DuffelError)) throw error;
      await stopForDesk(row.enquiryId, ownerId, error.message);
      result.stopped++;
    }
  }
  return result;
}

/** Hands the file to the desk with the reason, once, and tells them. */
async function stopForDesk(enquiryId: string, ownerId: string, reason: string) {
  await db.$transaction(async (tx) => {
    const current = await tx.flightTicketing.findUniqueOrThrow({ where: { enquiryId }, select: { id: true, externalStatus: true } });
    // An unconfirmed booking keeps its ATTEMPTING mark: the desk must check Duffel first.
    if (current.externalStatus !== "ATTEMPTING") {
      await tx.flightTicketing.update({ where: { id: current.id }, data: { externalStatus: NEEDS_DESK } });
    }
    await tx.enquiryActivity.create({
      data: { enquiryId, actorId: ownerId, kind: "ONLINE_TICKETING_STOPPED", body: `Online ticketing stopped for the desk: ${reason}`, changes: {} },
    });
    const staff = await tx.user.findMany({ where: { isActive: true, OR: [{ role: "ADMIN" }, { id: ownerId }] }, select: { id: true } });
    await tx.notificationJob.createMany({
      data: staff.map((user) => ({ enquiryId, dedupeKey: `${enquiryId}:online-stop:${user.id}`, kind: "STAFF_ALERT", channel: "IN_APP", recipientId: user.id })),
      skipDuplicates: true,
    });
  });
}
