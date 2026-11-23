import "server-only";
import { db } from "@/lib/db";
import { DuffelError, duffel, logDuffelFailure, requireDuffel } from "@/lib/duffel/client";
import { duffelAvailability, type DuffelMode } from "@/lib/duffel/config";
import {
  DuffelInputError,
  labelFor,
  offerToOption,
  orderPassengers,
  searchFromEnquiry,
  summariseOffer,
  ticketsFromOrder,
  toMinor,
  type FareResult,
} from "@/lib/duffel/mapping";
import type { DuffelOffer, DuffelOfferRequest, DuffelOrder } from "@/lib/duffel/types";
import { advanceTicketing, bump, issueTickets, lockFile, note, readTicketingFile, saveFareOptions, selectedOption, type TicketingFile } from "@/lib/ticketing";
import { TicketingError, type OptionInput, type SegmentInput } from "@/lib/ticketing-rules";
import { formatQuoteMoney } from "@/lib/quote-rules";

/**
 * Duffel inside the ticketing desk.
 *
 * Duffel only ever supplies fares and makes the booking. Everything that
 * protects the business stays exactly as it was: a fare is chosen by the
 * client, funds are verified by Finance, travellers are listed and checked,
 * and only then does the desk spend Duffel balance. A booking that succeeds
 * is recorded through the same steps a manual booking goes through.
 */

const MAX_OPTIONS = 6;

/** Staff-facing wording for anything Duffel or the inputs got wrong. */
function asTicketingError(error: unknown, context: string): TicketingError {
  if (error instanceof TicketingError) return error;
  if (error instanceof DuffelInputError) return new TicketingError(error.message);
  if (error instanceof DuffelError) {
    logDuffelFailure(context, error);
    return new TicketingError(error.info.requestId ? `${error.message} (Duffel reference ${error.info.requestId})` : error.message);
  }
  throw error;
}

async function desk(actorId: string, reference: string, needEdit = true) {
  const data = await readTicketingFile(actorId, reference);
  if (!data) throw new TicketingError("This flight enquiry is unavailable.");
  if (needEdit && !data.canEdit) throw new TicketingError("Only the case owner or an administrator can use live fares.");
  return data;
}

/* ------------------------------------------------------------------- status */

export type DuffelStatus =
  | { configured: false; message: string }
  | { configured: true; mode: DuffelMode };

export function duffelStatus(): DuffelStatus {
  const a = duffelAvailability();
  return a.ok ? { configured: true, mode: a.config.mode } : { configured: false, message: a.message };
}

/** A real call, so the desk can see the token works before a client is waiting. */
export async function testDuffelConnection(): Promise<{ ok: true; mode: DuffelMode; liveMode: boolean | null } | { ok: false; message: string }> {
  try {
    const config = requireDuffel();
    // The cheapest authenticated read there is.
    await duffel<unknown[]>("/air/airlines", { query: { limit: 1 }, config });
    return { ok: true, mode: config.mode, liveMode: config.mode === "live" };
  } catch (error) {
    if (error instanceof DuffelError) {
      logDuffelFailure("connection test", error);
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

/* ------------------------------------------------------------------- search */

export type FareSearch = {
  results: FareResult[];
  mode: DuffelMode;
  route: string;
  /** How many fares Duffel returned before the list was trimmed. */
  total: number;
};

export async function searchFares(actorId: string, reference: string): Promise<FareSearch> {
  try {
    const { enquiry, file } = await desk(actorId, reference);
    if (!file) throw new TicketingError("Open the ticketing file first.");
    if (file.status !== "OPTIONS") throw new TicketingError("Fares can only be searched while options are open.");
    const config = requireDuffel();
    const search = searchFromEnquiry(enquiry.details);
    const request = await duffel<DuffelOfferRequest>("/air/offer_requests", {
      method: "POST",
      body: search,
      query: { return_offers: true, supplier_timeout: 30_000 },
      timeoutMs: 45_000,
      config,
    });
    const offers = [...(request.offers ?? [])].sort((a, b) => toMinor(a.total_amount, a.total_currency) - toMinor(b.total_amount, b.total_currency));
    return {
      results: offers.slice(0, 15).map(summariseOffer),
      mode: config.mode,
      route: search.slices.map((s) => `${s.origin}–${s.destination}`).join(", "),
      total: offers.length,
    };
  } catch (error) {
    throw asTicketingError(error, "search");
  }
}

/* ------------------------------------------------------------ add as options */

const optionFromRow = (o: TicketingFile["options"][number]): OptionInput => ({
  label: o.label, currency: o.currency, totalMinor: o.totalMinor, fareBasis: o.fareBasis, baggage: o.baggage,
  changeRule: o.changeRule, refundRule: o.refundRule, validUntil: o.validUntil,
  source: o.source === "DUFFEL" ? "DUFFEL" : "MANUAL", externalId: o.externalId,
  segments: o.segments.map((s) => ({
    airline: s.airline, flightNumber: s.flightNumber, origin: s.origin, destination: s.destination,
    departLocal: s.departLocal, arriveLocal: s.arriveLocal, cabin: s.cabin as SegmentInput["cabin"],
    bookingClass: s.bookingClass, terminal: s.terminal,
  })),
});

/**
 * Re-reads each chosen fare from Duffel (the search price is not guaranteed)
 * and saves it beside the fares already in the file.
 */
export async function addFares(actorId: string, input: { reference: string; version: number; offerIds: string[] }) {
  try {
    const { file } = await desk(actorId, input.reference);
    if (!file) throw new TicketingError("Open the ticketing file first.");
    if (file.status !== "OPTIONS") throw new TicketingError("Fare options can only be edited before a fare is chosen.");
    const have = new Set(file.options.map((o) => o.externalId).filter(Boolean));
    const wanted = [...new Set(input.offerIds)].filter((id) => !have.has(id));
    if (!wanted.length) throw new TicketingError("Those fares are already in the file.");
    if (file.options.length + wanted.length > MAX_OPTIONS) {
      throw new TicketingError(`A file holds at most ${MAX_OPTIONS} fare options. Remove one first, or add fewer.`);
    }
    const config = requireDuffel();
    const merged: OptionInput[] = file.options.map(optionFromRow);
    for (const id of wanted) {
      const offer = await duffel<DuffelOffer>(`/air/offers/${encodeURIComponent(id)}`, { config });
      merged.push(offerToOption(offer, labelFor(offer, merged.map((m) => m.label))));
    }
    await saveFareOptions(actorId, { reference: input.reference, version: input.version, options: merged });
    return { added: wanted.length };
  } catch (error) {
    throw asTicketingError(error, "add fares");
  }
}

/* ------------------------------------------------------------------ booking */

export type BookingOutcome = {
  orderId: string;
  pnr: string;
  mode: DuffelMode;
  /** True once every traveller's ticket number is on the file and it has moved to Issued. */
  issued: boolean;
  /** Travellers whose ticket number Duffel has not supplied yet. */
  waitingFor: string[];
};

const partnerName = (mode: DuffelMode) => (mode === "sandbox" ? "Duffel (sandbox)" : "Duffel");

async function currentVersion(fileId: string) {
  return (await db.flightTicketing.findUniqueOrThrow({ where: { id: fileId }, select: { version: true } })).version;
}

/** Marks the file so a second click, a second tab or a retry cannot buy the same ticket twice. */
async function claimAttempt(actorId: string, reference: string, version: number) {
  return db.$transaction(async (tx) => {
    const { actor, enquiry, file } = await lockFile(tx, actorId, reference, version);
    if (file.status !== "READY_TO_TICKET") throw new TicketingError("Only a file that is ready to ticket can be booked.");
    if (file.externalStatus === "BOOKED" || file.externalOrderId) throw new TicketingError("This file is already booked with Duffel.");
    if (file.externalStatus === "ATTEMPTING") {
      throw new TicketingError("A Duffel booking for this file is in progress, or its result is unknown. Check the Duffel dashboard before trying again. An administrator can clear the attempt once it is confirmed that nothing was booked.");
    }
    await tx.flightTicketing.update({ where: { id: file.id }, data: { externalProvider: "DUFFEL", externalStatus: "ATTEMPTING", externalAttemptAt: new Date() } });
    await note(tx, enquiry.id, actor.id, "TICKETING_DUFFEL_ATTEMPT", "Booking request sent to Duffel.");
    return file.id;
  });
}

async function settleAttempt(actorId: string, reference: string, fileId: string, data: { status: "FAILED" | "BOOKED"; orderId?: string; body: string; kind: string }) {
  await db.$transaction(async (tx) => {
    const file = await tx.flightTicketing.findUniqueOrThrow({ where: { id: fileId }, select: { enquiryId: true } });
    await tx.flightTicketing.update({
      where: { id: fileId },
      data: { externalStatus: data.status, ...(data.orderId ? { externalOrderId: data.orderId } : {}) },
    });
    await note(tx, file.enquiryId, actorId, data.kind, data.body);
  });
}

export async function bookWithDuffel(actorId: string, input: { reference: string; version: number }): Promise<BookingOutcome> {
  let fileId: string | null = null;
  try {
    const { enquiry, file, funding } = await desk(actorId, input.reference);
    if (!file) throw new TicketingError("Open the ticketing file first.");
    if (file.status !== "READY_TO_TICKET") throw new TicketingError("Only a file that is ready to ticket can be booked.");
    const chosen = selectedOption(file);
    if (!chosen) throw new TicketingError("Choose a fare first.");
    if (chosen.source !== "DUFFEL" || !chosen.externalId) throw new TicketingError("The chosen fare was typed in by hand. Book it with the ticketing partner instead.");
    if (!funding.funded) throw new TicketingError("Verified funds covering the accepted quote are required before booking.");
    const config = requireDuffel();

    // Price check at the moment of purchase: what the client accepted must be what Duffel will charge.
    const offer = await duffel<DuffelOffer>(`/air/offers/${encodeURIComponent(chosen.externalId)}`, { config });
    const price = toMinor(offer.total_amount, offer.total_currency);
    if (offer.total_currency !== chosen.currency || price !== chosen.totalMinor) {
      throw new TicketingError(
        `The airline's price is now ${formatQuoteMoney(price, offer.total_currency)}, not the ${formatQuoteMoney(chosen.totalMinor, chosen.currency)} the client chose. Search again and agree the new price before booking.`,
      );
    }
    // Names, titles and contact details are validated before a single request is made.
    const passengers = orderPassengers(offer, file.passengers, { email: enquiry.email ?? "", phone: enquiry.phone });

    fileId = await claimAttempt(actorId, input.reference, input.version);

    let order: DuffelOrder;
    try {
      order = await duffel<DuffelOrder>("/air/orders", {
        method: "POST",
        body: {
          type: "instant",
          selected_offers: [offer.id],
          payments: [{ type: "balance", currency: offer.total_currency, amount: offer.total_amount }],
          passengers,
        },
        // The airline can take up to two minutes; Duffel asks for at least 130 seconds.
        timeoutMs: 135_000,
        config,
      });
    } catch (error) {
      if (error instanceof DuffelError && !error.info.outcomeUnknown) {
        await settleAttempt(actorId, input.reference, fileId, { status: "FAILED", kind: "TICKETING_DUFFEL_FAILED", body: `Duffel refused the booking: ${error.message}` });
      }
      // Otherwise the attempt stays marked: the booking may exist, so nothing may be sent again blindly.
      throw error;
    }

    await settleAttempt(actorId, input.reference, fileId, {
      status: "BOOKED", orderId: order.id, kind: "TICKETING_DUFFEL_BOOKED",
      body: `Duffel order ${order.id}, booking reference ${order.booking_reference} (${config.mode}).`,
    });

    // From here the booking exists, so a failure must say so loudly rather than invite a second booking.
    try {
      return await recordBooking(actorId, input.reference, fileId, order, config.mode);
    } catch (error) {
      const why = error instanceof Error ? error.message : "an unexpected problem";
      throw new TicketingError(`Booked with Duffel (order ${order.id}, reference ${order.booking_reference}) but the file could not be updated: ${why} Do not book again. Record the booking on the file by hand.`);
    }
  } catch (error) {
    if (error instanceof DuffelError && error.info.outcomeUnknown && fileId) {
      logDuffelFailure("booking outcome unknown", error);
      throw new TicketingError("Duffel did not confirm whether the booking was made. Do not try again yet: check the Duffel dashboard for an order on this client, then ask an administrator to clear the attempt if there is none.");
    }
    throw asTicketingError(error, "book");
  }
}

/** Moves the file on and records the tickets, through the same steps as a manual booking. */
async function recordBooking(actorId: string, reference: string, fileId: string, order: DuffelOrder, mode: DuffelMode): Promise<BookingOutcome> {
  const partner = partnerName(mode);
  const limit = order.payment_status?.payment_required_by ? new Date(order.payment_status.payment_required_by) : null;
  await advanceTicketing(actorId, {
    reference,
    version: await currentVersion(fileId),
    move: { to: "TICKETING", pnr: order.booking_reference, partner, ticketTimeLimit: limit && limit > new Date() ? limit : new Date(Date.now() + 24 * 3_600_000) },
  });
  return recordTickets(actorId, reference, fileId, order, mode);
}

async function recordTickets(actorId: string, reference: string, fileId: string, order: DuffelOrder, mode: DuffelMode): Promise<BookingOutcome> {
  const file = await db.flightTicketing.findUniqueOrThrow({ where: { id: fileId }, include: { passengers: true } });
  const { tickets, missing } = ticketsFromOrder(order, file.passengers.map((p) => ({ id: p.id, givenNames: p.givenNames, surname: p.surname })));
  const everyone = file.passengers.length > 0 && tickets.length === file.passengers.length;
  if (everyone && file.status === "TICKETING") {
    await issueTickets(actorId, {
      reference,
      version: file.version,
      issue: {
        pnr: order.booking_reference,
        partner: partnerName(mode),
        partnerReference: order.id,
        evidence: `Booked and paid through Duffel (${mode}). Order ${order.id}, booking reference ${order.booking_reference}. E-ticket numbers were read from the order.`,
        tickets,
      },
    });
  }
  return { orderId: order.id, pnr: order.booking_reference, mode, issued: everyone, waitingFor: everyone ? [] : missing };
}

/** Asks Duffel again for ticket numbers that had not been issued when the booking was made. */
export async function refreshDuffelTickets(actorId: string, input: { reference: string }): Promise<BookingOutcome> {
  try {
    const { file } = await desk(actorId, input.reference);
    if (!file?.externalOrderId) throw new TicketingError("This file has no Duffel booking.");
    if (file.status !== "TICKETING") throw new TicketingError("Ticket numbers can be collected while the file is with the partner.");
    const config = requireDuffel();
    const order = await duffel<DuffelOrder>(`/air/orders/${encodeURIComponent(file.externalOrderId)}`, { config });
    return await recordTickets(actorId, input.reference, file.id, order, config.mode);
  } catch (error) {
    throw asTicketingError(error, "refresh tickets");
  }
}

/** Administrator only: after confirming in Duffel that nothing was booked, lets the file be booked again. */
export async function clearDuffelAttempt(actorId: string, input: { reference: string; version: number }) {
  return db.$transaction(async (tx) => {
    const { actor, enquiry, file } = await lockFile(tx, actorId, input.reference, input.version);
    if (actor.role !== "ADMIN") throw new TicketingError("Only an administrator can clear a Duffel booking attempt.");
    if (file.externalOrderId) throw new TicketingError("A Duffel order is already recorded on this file, so it cannot be cleared.");
    if (file.externalStatus !== "ATTEMPTING" && file.externalStatus !== "FAILED") throw new TicketingError("There is no booking attempt to clear.");
    await bump(tx, file.id, { externalStatus: null, externalProvider: null, externalAttemptAt: null });
    await note(tx, enquiry.id, actor.id, "TICKETING_DUFFEL_CLEARED", "Booking attempt cleared after checking Duffel.");
  });
}
