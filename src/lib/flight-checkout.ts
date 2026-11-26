import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { DuffelError, duffel, logDuffelFailure } from "@/lib/duffel/client";
import { DuffelInputError, offerToOption, orderPassengers, type Traveller } from "@/lib/duffel/mapping";
import type { DuffelOffer, DuffelOrder } from "@/lib/duffel/types";
import { paymentOrigin } from "@/lib/collections/urubuto";
import { routedPaymentMethods } from "@/lib/collections/routing";
import { lockFinance } from "@/lib/finance-registry";
import { airportCity } from "@/lib/flight-geography";
import { CABIN_LABEL, kindOf, rwfPrice, travellersText, type CheckoutInput } from "@/lib/flight-shop-rules";
import { fetchLiveOffer, shopAvailability } from "@/lib/flight-shop";
import { passengerProblems, type PassengerInput } from "@/lib/ticketing-rules";
import { formatQuoteMoney, type QuoteSnapshot } from "@/lib/quote-rules";
import { quoteContentHash } from "@/lib/quote-render";
import { getSite } from "@/lib/settings";

/**
 * Online flight checkout.
 *
 * A traveller's purchase becomes the same records a desk sale does: an
 * enquiry owned by the desk member chosen in Admin, a written quote (fare and
 * service fee), the traveller's own acceptance, a ticketing file holding the
 * chosen Duffel fare and the travellers, and an invoice with a payment link.
 * Nothing is bought from Duffel here. Where the airline allows it, a Duffel
 * hold keeps the seats and price while the traveller pays; the ticket is paid
 * for only after the traveller's payment is verified (src/lib/flight-autoticket.ts).
 */

export const ONLINE_BOOKING_TERMS_VERSION = "online-flight-2026-11";
export const ONLINE_BOOKING_TERMS =
  "I confirm the traveller names, dates of birth and passport details match each passport. I accept the airline's fare rules shown for this fare and the booking terms. The ticket is bought only once my payment for the full amount is verified; if the airline's price changes before then, the desk contacts me before anything is charged again or refunded.";

export class CheckoutError extends Error {
  constructor(message: string, readonly newTotalRwf?: number) {
    super(message);
  }
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const label = (code: string) => `${airportCity(code) ?? code} (${code})`;
/** Long enough for mobile money or a card, short enough that the airline's price still holds. */
const PAY_WINDOW_MS = 45 * 60_000;
const HOLD_PAY_WINDOW_MS = 24 * 3_600_000;

type Context = { viewer: { id?: string; role?: string | null; staffRole?: string | null } | null; ip: string; userAgent: string };

export async function startOnlineBooking(input: CheckoutInput, context: Context, now = new Date()): Promise<{ payUrl: string; reference: string }> {
  const shop = await shopAvailability(context.viewer, now);
  if (!shop.open) throw new CheckoutError("Online booking is not available right now. Send the desk a request instead.");
  if (!shop.pricing) throw new CheckoutError("Online booking is paused while the desk updates today's exchange rate. Try again later, or send the desk a request.");
  if (!shop.ownerId) throw new CheckoutError("Online booking is not available right now. Send the desk a request instead.");
  const origin = paymentOrigin();
  if (!origin) throw new CheckoutError("Online payment is not available right now. Send the desk a request instead.");

  const offer = await fetchLiveOffer(shop.config, input.offerId);
  if (!offer) throw new CheckoutError("This fare is no longer available. Go back to the results and choose another.");

  /* ---- the travellers against the fare */
  const seats = new Map(offer.passengers.map((p) => [p.id, p]));
  const given = new Set(input.travellers.map((t) => t.offerPassengerId));
  if (given.size !== input.travellers.length || given.size !== seats.size || [...given].some((id) => !seats.has(id))) {
    throw new CheckoutError("The travellers do not match this fare. Go back to the results and search again.");
  }
  const lastFlight = offer.slices.at(-1)?.segments.at(-1)?.departing_at.slice(0, 10) ?? null;
  const people: (PassengerInput & { offerPassengerId: string })[] = input.travellers.map((t) => ({
    offerPassengerId: t.offerPassengerId,
    kind: kindOf(seats.get(t.offerPassengerId)!.type ?? null),
    title: t.title,
    givenNames: t.givenNames.toUpperCase(),
    surname: t.surname.toUpperCase(),
    dateOfBirth: t.dateOfBirth,
    nationality: t.nationality,
    documentNumber: t.documentNumber,
    documentExpiry: t.documentExpiry,
  }));
  // The desk's ticketing rules need passport details for every traveller, whatever the airline asks.
  if (people.some((p) => !p.nationality || !p.documentNumber || !p.documentExpiry)) {
    throw new CheckoutError("Enter each traveller's passport country, number and expiry date.");
  }
  const problems = passengerProblems(people, lastFlight);
  if (problems.length) throw new CheckoutError(problems.join(" "));

  /* ---- the price, exactly as the traveller saw it */
  const option = offerToOption(offer, `${offer.owner.name}${offer.slices[0]?.fare_brand_name ? ` ${offer.slices[0].fare_brand_name}` : ""}`);
  const price = rwfPrice(option, people.length, shop.pricing);
  if (!price) throw new CheckoutError("This fare is priced in a currency we cannot take online. Send the desk a request instead.");
  if (price.totalRwf !== input.expectedTotalRwf) {
    throw new CheckoutError(`The airline changed the price to ${formatQuoteMoney(price.totalRwf, "RWF")}. Check the new total, then confirm again.`, price.totalRwf);
  }
  if (!(await routedPaymentMethods("RWF", price.totalRwf)).length) {
    throw new CheckoutError("Online payment is not available for this amount. Send the desk a request and it will arrange payment.");
  }

  /* ---- hold the seats where the airline allows it */
  const contact = { email: input.email, phone: input.phone };
  const travellers: Traveller[] = people.map((p, i) => ({
    id: `t${i}`, kind: p.kind, title: p.title, givenNames: p.givenNames, surname: p.surname,
    dateOfBirth: p.dateOfBirth || null, nationality: p.nationality || null, documentNumber: p.documentNumber || null, documentExpiry: p.documentExpiry || null,
  }));
  let duffelPassengers;
  try {
    // Seats of the same type are interchangeable; the mapping pairs each infant with an adult.
    duffelPassengers = orderPassengers(offer, travellers, contact);
  } catch (error) {
    if (error instanceof DuffelInputError) throw new CheckoutError(error.message);
    throw error;
  }
  // A second click must not place a second hold: the transaction below answers it instead.
  const started = await db.enquiry.findUnique({ where: { submissionKey: input.submissionKey }, select: { id: true } });
  const hold = !started && offer.payment_requirements?.requires_instant_payment === false ? await placeHold(shop.config, offer, duffelPassengers) : null;
  const payBy = new Date(
    Math.min(
      hold?.payBy?.getTime() ?? Infinity,
      hold ? now.getTime() + HOLD_PAY_WINDOW_MS : new Date(offer.expires_at).getTime(),
      now.getTime() + (hold ? HOLD_PAY_WINDOW_MS : PAY_WINDOW_MS),
    ),
  );
  if (payBy.getTime() - now.getTime() < 10 * 60_000) {
    throw new CheckoutError("This fare is about to expire with the airline. Go back to the results and search again for a current price.");
  }

  /* ---- the records, in one transaction */
  const brand = await getSite();
  const token = randomBytes(32).toString("base64url");
  const reference = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${input.submissionKey}, 0))`;
    const repeat = await tx.enquiry.findUnique({ where: { submissionKey: input.submissionKey }, include: { financialCase: { include: { paymentInvoice: true } } } });
    if (repeat) {
      // A second click: a fresh link to the same invoice, never a second booking.
      const invoice = repeat.financialCase?.paymentInvoice;
      if (!invoice) throw new CheckoutError("This booking was already started. Check your email or contact the desk.");
      await tx.paymentLink.update({ where: { invoiceId: invoice.id }, data: { tokenHash: hash(token), createdAt: now, revokedAt: null } });
      return repeat.reference;
    }

    const owner = await tx.user.findUnique({ where: { id: shop.ownerId! }, select: { id: true, isActive: true, role: true, staffRole: true, fullName: true } });
    if (!owner?.isActive || !(owner.role === "ADMIN" || ["SALES", "OPERATIONS"].includes(owner.staffRole ?? ""))) {
      throw new CheckoutError("Online booking is not available right now. Send the desk a request instead.");
    }
    const privacy = await tx.legalDocument.findUnique({ where: { slug: "privacy" }, select: { version: true } });
    const first = offer.slices[0];
    const back = offer.slices[1];
    const counts = { adults: people.filter((p) => p.kind === "ADULT").length, children: people.filter((p) => p.kind === "CHILD").length, infants: people.filter((p) => p.kind === "INFANT").length };
    const cabin = (option.segments[0]?.cabin ?? "ECONOMY") as keyof typeof CABIN_LABEL;
    const details = {
      origin: label(first.origin.iata_code ?? ""),
      destination: label(first.destination.iata_code ?? ""),
      departureDate: first.segments[0].departing_at.slice(0, 10),
      returnDate: back ? back.segments[0].departing_at.slice(0, 10) : "",
      tripType: back ? "RETURN" : "ONE_WAY",
      ...counts,
      cabin,
      online: { offerId: offer.id, mode: shop.mode, holdOrderId: hold?.order.id ?? null, terms: ONLINE_BOOKING_TERMS_VERSION },
    };
    const enquiry = await tx.enquiry.create({
      data: {
        submissionKey: input.submissionKey,
        fingerprint: hash(JSON.stringify({ offer: offer.id, travellers: people.map((p) => [p.givenNames, p.surname, p.dateOfBirth]) })),
        contactKey: hash(input.phone.replace(/\D/g, "")),
        reference: `TRQ-${randomUUID()}`,
        status: "AWAITING_PAYMENT",
        ownerId: owner.id,
        service: "FLIGHT",
        source: "ONLINE",
        name: input.contactName,
        phone: input.phone,
        email: input.email,
        replyChannel: "EMAIL",
        consentVersion: ONLINE_BOOKING_TERMS_VERSION,
        consentText: ONLINE_BOOKING_TERMS,
        privacyVersion: privacy?.version ?? 0,
        details,
      },
    });

    const route = `${details.origin} to ${details.destination}`;
    const dates = back ? `${details.departureDate} and back ${details.returnDate}` : details.departureDate;
    const items = [
      {
        kind: "SUPPLIER",
        description: `Air fare, ${offer.owner.name}: ${route}, ${dates}. ${travellersText(counts)}, ${CABIN_LABEL[cabin].toLowerCase()}.`.slice(0, 200),
        quantity: 1,
        unitMinor: price.fareRwf,
        totalMinor: price.fareRwf,
      },
      ...(price.feeRwf
        ? [{ kind: "SERVICE_FEE", description: "Thrill Rwanda booking and ticketing service, per traveller", quantity: people.length, unitMinor: price.feeRwf / people.length, totalMinor: price.feeRwf }]
        : []),
    ] as QuoteSnapshot["items"];
    const snapshot: QuoteSnapshot = {
      reference: enquiry.reference,
      version: 1,
      customerName: input.contactName,
      preparedBy: "Thrill Rwanda online booking",
      company: { name: brand.legalName, email: brand.contact.email, phone: brand.contact.phone, address: brand.contact.address },
      issuedAt: now.toISOString(),
      expiresAt: payBy.toISOString(),
      paymentDeadline: payBy.toISOString(),
      currency: "RWF",
      serviceDescription: `Flight booked online: ${offer.owner.name}, ${route}.`,
      travelSummary: option.segments.map((s) => `${s.airline}${s.flightNumber} ${s.origin}-${s.destination} ${s.departLocal.replace("T", " ")}`).join("; ").slice(0, 2000),
      supplierConditions: `${option.baggage}. Changes ${option.changeRule.toLowerCase()} Refunds ${option.refundRule.toLowerCase()}`.slice(0, 2000),
      taxTreatment: "Airline taxes and charges are included in the air fare.",
      terms: ONLINE_BOOKING_TERMS,
      items,
      totalMinor: price.totalRwf,
    };
    const quote = await tx.quoteVersion.create({
      data: {
        enquiryId: enquiry.id, number: 1, intentKey: randomUUID(), inputHash: hash(JSON.stringify({ offer: offer.id, total: price.totalRwf })),
        contentHash: quoteContentHash(snapshot), snapshot, currency: "RWF", totalMinor: price.totalRwf,
        internalNotes: `Online booking. Duffel offer ${offer.id} at ${offer.total_amount} ${offer.total_currency}; rate ${shop.pricing!.usdRwf} RWF/USD plus ${shop.pricing!.bufferPercent}%.${hold ? ` Held as Duffel order ${hold.order.id}.` : " Not held: the airline needs instant payment."}`,
        issuedAt: now, expiresAt: payBy, paymentDeadline: payBy, createdById: owner.id,
      },
    });
    const acceptance = await tx.quoteAcceptance.create({
      data: {
        enquiryId: enquiry.id, quoteId: quote.id, customerName: input.contactName, channel: "WEBSITE", actorId: owner.id, acceptedAt: now,
        evidence: `Accepted online by ${input.contactName} <${input.email}> at ${now.toISOString()} from ${context.ip}, terms ${ONLINE_BOOKING_TERMS_VERSION}. Browser: ${context.userAgent.slice(0, 200)}`,
      },
    });
    await tx.enquiryActivity.createMany({
      data: [
        { enquiryId: enquiry.id, actorId: owner.id, kind: "ONLINE_BOOKING", changes: { offerId: offer.id, mode: shop.mode, holdOrderId: hold?.order.id ?? null, totalRwf: price.totalRwf, duffelTotal: `${offer.total_amount} ${offer.total_currency}` }, body: `Booked online by ${input.contactName}. Awaiting payment.` },
        { enquiryId: enquiry.id, actorId: owner.id, kind: "QUOTE_ISSUED", changes: { quoteId: quote.id, version: 1, contentHash: quote.contentHash, afterStatus: "AWAITING_PAYMENT", online: true } },
        { enquiryId: enquiry.id, actorId: owner.id, kind: "QUOTE_ACCEPTED", changes: { quoteId: quote.id, version: 1, contentHash: quote.contentHash, channel: "WEBSITE", acceptanceId: acceptance.id } },
      ],
    });

    await tx.flightTicketing.create({
      data: {
        enquiryId: enquiry.id,
        status: "AWAITING_PAYMENT",
        partner: shop.mode === "sandbox" ? "Duffel (sandbox)" : "Duffel",
        optionsSharedAt: now,
        createdById: owner.id,
        ...(hold
          ? { externalProvider: "DUFFEL", externalOrderId: hold.order.id, externalStatus: "HELD", pnr: hold.order.booking_reference, ticketTimeLimit: payBy }
          : {}),
        options: {
          create: [{
            position: 0, label: option.label, currency: option.currency, totalMinor: option.totalMinor, fareBasis: option.fareBasis,
            baggage: option.baggage, changeRule: option.changeRule, refundRule: option.refundRule, validUntil: payBy, selected: true,
            source: "DUFFEL", externalId: offer.id,
            segments: { create: option.segments.map((s, position) => ({ position, ...s })) },
          }],
        },
        passengers: {
          create: people.map((p, position) => ({
            position, kind: p.kind, title: p.title, givenNames: p.givenNames, surname: p.surname,
            dateOfBirth: p.dateOfBirth || null, nationality: p.nationality || null, documentNumber: p.documentNumber || null, documentExpiry: p.documentExpiry || null,
          })),
        },
      },
    });

    await lockFinance(tx);
    const fees = items.filter((i) => i.kind === "SERVICE_FEE").reduce((sum, i) => sum + i.totalMinor, 0);
    const financialCase = await tx.financialCase.create({
      data: { enquiryId: enquiry.id, quoteId: quote.id, currency: "RWF", customerChargeMinor: price.totalRwf, requiredFundingMinor: price.totalRwf, serviceFeeMinor: fees, taxReserveMinor: 0 },
    });
    const invoice = await tx.paymentInvoice.create({
      data: { number: `TR-INV-${randomUUID().toUpperCase()}`, caseId: financialCase.id, currency: "RWF", totalMinor: price.totalRwf, depositMinor: price.totalRwf, dueAt: payBy },
    });
    await tx.paymentLink.create({ data: { invoiceId: invoice.id, tokenHash: hash(token), createdBy: owner.id, createdAt: now, expiresAt: payBy } });

    // The desk hears about it at once; the traveller's confirmation follows payment.
    const staff = await tx.user.findMany({ where: { isActive: true, OR: [{ role: "ADMIN" }, { id: owner.id }] }, select: { id: true } });
    await tx.notificationJob.createMany({
      data: staff.map((user) => ({ enquiryId: enquiry.id, dedupeKey: `${enquiry.id}:staff:${user.id}`, kind: "STAFF_ALERT", channel: "IN_APP", recipientId: user.id })),
      skipDuplicates: true,
    });
    return enquiry.reference;
  });

  return { payUrl: `${origin}/pay/${token}`, reference };
}

type Hold = { order: DuffelOrder; payBy: Date | null };

/** A Duffel hold: seats and, usually, the price kept without paying. Failure just means no hold. */
async function placeHold(config: Parameters<typeof fetchLiveOffer>[0], offer: DuffelOffer, passengers: unknown[]): Promise<Hold | null> {
  try {
    const order = await duffel<DuffelOrder>("/air/orders", {
      method: "POST",
      body: { type: "hold", selected_offers: [offer.id], passengers },
      timeoutMs: 135_000,
      config,
    });
    const by = order.payment_status?.payment_required_by;
    const guarantee = offer.payment_requirements?.price_guarantee_expires_at;
    const times = [by, guarantee].filter((t): t is string => !!t).map((t) => new Date(t).getTime());
    return { order, payBy: times.length ? new Date(Math.min(...times)) : null };
  } catch (error) {
    if (error instanceof DuffelError) {
      logDuffelFailure("online hold", error);
      if (error.info.outcomeUnknown) {
        throw new CheckoutError("The airline did not confirm in time. Wait a minute, then try again; nothing has been charged.");
      }
      return null;
    }
    throw error;
  }
}
