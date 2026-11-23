import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { canUseEnquiries, enquiryScope, isFinance, label } from "@/lib/enquiry-workflow";
import { financialSummary } from "@/lib/finance-rules";
import { todayInRwanda } from "@/lib/flight-enquiry-schema";
import { renderEmail } from "@/lib/email/template";
import { buildSite } from "@/lib/site-config";
import {
  canMoveTicketing, clientServiceSchema, deadlineUrgency, documentsExpireOn, enquiryParty, isServiceOpen, isTicketingEditable,
  nextServiceStatuses, passengerProblems, serviceCompletionProblems, ticketProblems, TicketingError, validateSegmentOrder,
  type IssueInput, type OptionInput, type PassengerInput, type SegmentInput, type ServiceKind, type ServiceStatus,
} from "@/lib/ticketing-rules";
import { clientScope } from "@/lib/client-portal";
import { airlines, isAirlineCode } from "@/lib/flight-airlines";
import { formatQuoteMoney } from "@/lib/quote-rules";
import type { z } from "zod";

export { TicketingError };
type Tx = Prisma.TransactionClient;

const fileInclude = {
  options: { orderBy: { position: "asc" as const }, include: { segments: { orderBy: { position: "asc" as const } } } },
  passengers: { orderBy: { position: "asc" as const } },
  requests: { orderBy: { number: "desc" as const } },
} satisfies Prisma.FlightTicketingInclude;
export type TicketingFile = Prisma.FlightTicketingGetPayload<{ include: typeof fileInclude }>;

/* ------------------------------------------------------------------ helpers */

async function staffActor(tx: Tx, actorId: string) {
  const actor = await tx.user.findUnique({
    where: { id: actorId },
    select: { id: true, role: true, staffRole: true, isActive: true, fullName: true },
  });
  if (!actor || !canUseEnquiries(actor) || isFinance(actor)) throw new TicketingError("Ticketing access is restricted to the case team.");
  return actor;
}

/** Loads a ticketing file for update: the caller's scope is re-read, the row is locked and the version must match. */
async function lockFile(tx: Tx, actorId: string, reference: string, version?: number) {
  const actor = await staffActor(tx, actorId);
  const enquiry = await tx.enquiry.findFirst({
    where: { reference, service: "FLIGHT", ...enquiryScope(actor) },
    select: { id: true, ownerId: true, status: true, details: true, name: true, email: true, replyChannel: true },
  });
  if (!enquiry) throw new TicketingError("This flight enquiry is unavailable.");
  if (actor.role !== "ADMIN" && enquiry.ownerId !== actor.id) throw new TicketingError("Only the case owner or an administrator can change ticketing.");
  const row = await tx.flightTicketing.findUnique({ where: { enquiryId: enquiry.id }, select: { id: true } });
  if (!row) throw new TicketingError("Open ticketing for this enquiry first.");
  await tx.$queryRaw`SELECT id FROM flight_ticketing WHERE id = ${row.id}::uuid FOR UPDATE`;
  const file = await tx.flightTicketing.findUniqueOrThrow({ where: { id: row.id }, include: fileInclude });
  if (version !== undefined && file.version !== version) throw new TicketingError("This file changed while you were editing. Refresh and try again.");
  return { actor, enquiry, file };
}

const bump = (tx: Tx, id: string, data: Prisma.FlightTicketingUpdateInput = {}) =>
  tx.flightTicketing.update({ where: { id }, data: { ...data, version: { increment: 1 } } });

const note = (tx: Tx, enquiryId: string, actorId: string, kind: string, body: string | null, changes: Prisma.InputJsonValue = {}) =>
  tx.enquiryActivity.create({ data: { enquiryId, actorId, kind, body, changes } });

export function selectedOption(file: Pick<TicketingFile, "options">) {
  return file.options.find((option) => option.selected) ?? null;
}
/** The calendar date of the last flight on the chosen fare, or on the latest option while still choosing. */
export function lastFlightDate(file: Pick<TicketingFile, "options">, which: "depart" | "arrive" = "depart") {
  const option = selectedOption(file) ?? file.options.at(-1);
  const last = option?.segments.at(-1);
  return last ? (which === "depart" ? last.departLocal : last.arriveLocal).slice(0, 10) : null;
}
/** What the team is racing against: the fare's validity until it is held, then the ticketing time limit. */
export function fileDeadline(file: Pick<TicketingFile, "status" | "options" | "ticketTimeLimit">) {
  if (["ISSUED", "CLOSED", "CANCELLED"].includes(file.status)) return null;
  if (file.status === "TICKETING" && file.ticketTimeLimit) return file.ticketTimeLimit;
  const chosen = selectedOption(file);
  if (chosen) return chosen.validUntil;
  const times = file.options.map((option) => option.validUntil.getTime());
  return times.length ? new Date(Math.min(...times)) : null;
}

export async function ticketingFunding(tx: Pick<Tx, "financialCase">, enquiryId: string) {
  const data = await tx.financialCase.findUnique({
    where: { enquiryId },
    include: {
      entries: { select: { kind: true, amountMinor: true, commitmentId: true, refundId: true } },
      commitments: { select: { id: true, costMinor: true } },
      refunds: { select: { id: true, amountMinor: true } },
      paymentInvoice: { include: { attempts: { select: { status: true, amountMinor: true, settledAt: true } } } },
    },
  });
  if (!data) return { funded: false, requiredMinor: null as number | null, paidMinor: 0, currency: null as string | null };
  const unposted = (data.paymentInvoice?.attempts ?? [])
    .filter((attempt) => attempt.status === "SUCCESSFUL" && !attempt.settledAt)
    .reduce((total, attempt) => total + attempt.amountMinor, 0);
  const paidMinor = financialSummary(data).netCustomerCash + unposted;
  return { funded: data.requiredFundingMinor > 0 && paidMinor >= data.requiredFundingMinor, requiredMinor: data.requiredFundingMinor, paidMinor, currency: data.currency };
}

/* ------------------------------------------------------------------ opening and fares */

export async function openTicketing(actorId: string, reference: string) {
  return db.$transaction(async (tx) => {
    const actor = await staffActor(tx, actorId);
    const enquiry = await tx.enquiry.findFirst({
      where: { reference, service: "FLIGHT", ...enquiryScope(actor) },
      select: { id: true, ownerId: true, status: true },
    });
    if (!enquiry) throw new TicketingError("This flight enquiry is unavailable.");
    if (actor.role !== "ADMIN" && enquiry.ownerId !== actor.id) throw new TicketingError("Only the case owner or an administrator can open ticketing.");
    if (["CANCELLED", "REFUNDED", "LOST", "COMPLETED"].includes(enquiry.status)) throw new TicketingError("This enquiry is closed.");
    const existing = await tx.flightTicketing.findUnique({ where: { enquiryId: enquiry.id }, select: { id: true } });
    if (existing) return existing.id;
    const created = await tx.flightTicketing.create({ data: { enquiryId: enquiry.id, createdById: actor.id }, select: { id: true } });
    await note(tx, enquiry.id, actor.id, "TICKETING_OPENED", null);
    return created.id;
  });
}

export async function saveFareOptions(actorId: string, input: { reference: string; version: number; options: OptionInput[] }) {
  return db.$transaction(async (tx) => {
    const { actor, enquiry, file } = await lockFile(tx, actorId, input.reference, input.version);
    if (file.status !== "OPTIONS") throw new TicketingError("Fare options can only be edited before a fare is chosen.");
    if (input.options.length < 1) throw new TicketingError("Add at least one fare option.");
    const labels = new Set<string>();
    for (const option of input.options) {
      if (option.validUntil <= new Date()) throw new TicketingError(`"${option.label}" is already past its validity time.`);
      if (labels.has(option.label.toLowerCase())) throw new TicketingError("Give each fare option its own name.");
      labels.add(option.label.toLowerCase());
      validateSegmentOrder(option.segments);
    }
    await tx.flightOption.deleteMany({ where: { ticketingId: file.id } });
    for (const [index, option] of input.options.entries()) {
      const { segments, ...fare } = option;
      await tx.flightOption.create({
        data: { ...fare, ticketingId: file.id, position: index, segments: { create: segments.map((segment, position) => ({ ...segment, position })) } },
      });
    }
    await bump(tx, file.id, { optionsSharedAt: null });
    await note(tx, enquiry.id, actor.id, "TICKETING_OPTIONS_SAVED", null, { options: input.options.length });
  });
}

export async function shareFareOptions(actorId: string, reference: string, version: number) {
  return db.$transaction(async (tx) => {
    const { actor, enquiry, file } = await lockFile(tx, actorId, reference, version);
    if (file.status !== "OPTIONS" || !file.options.length) throw new TicketingError("Save at least one fare option before sharing.");
    await bump(tx, file.id, { optionsSharedAt: new Date() });
    await note(tx, enquiry.id, actor.id, "TICKETING_OPTIONS_SHARED", null, { options: file.options.length });
  });
}

export async function chooseFareOption(actorId: string, input: { reference: string; version: number; optionId: string }) {
  return db.$transaction(async (tx) => {
    const { actor, enquiry, file } = await lockFile(tx, actorId, input.reference, input.version);
    if (file.status !== "OPTIONS") throw new TicketingError("A fare can only be chosen while options are open.");
    const option = file.options.find((item) => item.id === input.optionId);
    if (!option) throw new TicketingError("Choose one of this file's fare options.");
    if (option.validUntil <= new Date()) throw new TicketingError("That fare is no longer valid. Update the option first.");
    await tx.flightOption.updateMany({ where: { ticketingId: file.id, selected: true }, data: { selected: false } });
    await tx.flightOption.update({ where: { id: option.id }, data: { selected: true } });
    await bump(tx, file.id);
    await note(tx, enquiry.id, actor.id, "TICKETING_FARE_CHOSEN", option.label, { optionId: option.id, totalMinor: option.totalMinor, currency: option.currency });
  });
}

/** A signed-in client picks one of the options the desk has shared. */
export async function clientChooseFareOption(userId: string, input: { reference: string; optionId: string }) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { isActive: true } });
    if (!user?.isActive) throw new TicketingError("Sign in to choose a fare.");
    const enquiry = await tx.enquiry.findFirst({ where: { reference: input.reference, service: "FLIGHT", ...clientScope(userId) }, select: { id: true } });
    const row = enquiry && await tx.flightTicketing.findUnique({ where: { enquiryId: enquiry.id }, select: { id: true } });
    if (!enquiry || !row) throw new TicketingError("This trip is unavailable.");
    await tx.$queryRaw`SELECT id FROM flight_ticketing WHERE id = ${row.id}::uuid FOR UPDATE`;
    const file = await tx.flightTicketing.findUniqueOrThrow({ where: { id: row.id }, include: fileInclude });
    const access = await tx.clientCaseAccess.findFirst({ where: { enquiryId: enquiry.id, userId, active: true }, select: { canAccept: true } });
    const corporate = !access && await tx.corporateCaseAccess.count({
      where: { enquiryId: enquiry.id, active: true, account: { active: true, members: { some: { userId, active: true } } } },
    });
    if (access ? !access.canAccept : !corporate) throw new TicketingError("Your account can view this trip but not choose a fare. Ask the desk.");
    if (file.status !== "OPTIONS" || !file.optionsSharedAt) throw new TicketingError("Fare options are not open for choosing.");
    const option = file.options.find((item) => item.id === input.optionId);
    if (!option) throw new TicketingError("Choose one of the listed fares.");
    if (option.validUntil <= new Date()) throw new TicketingError("That fare has expired. Ask the desk for a refreshed price.");
    await tx.flightOption.updateMany({ where: { ticketingId: file.id, selected: true }, data: { selected: false } });
    await tx.flightOption.update({ where: { id: option.id }, data: { selected: true } });
    await bump(tx, file.id);
    await note(tx, enquiry.id, userId, "TICKETING_FARE_CHOSEN_BY_CLIENT", option.label, { optionId: option.id, totalMinor: option.totalMinor, currency: option.currency });
    await notifyCase(tx, enquiry.id, "Client chose a fare", `${option.label} was chosen online. Review the file and move it to payment.`);
  });
}

/* ------------------------------------------------------------------ travellers */

export async function saveTravellers(actorId: string, input: { reference: string; version: number; passengers: PassengerInput[] }) {
  return db.$transaction(async (tx) => {
    const { actor, enquiry, file } = await lockFile(tx, actorId, input.reference, input.version);
    if (!isTicketingEditable(file.status)) throw new TicketingError("Travellers cannot be changed once tickets are issued. Raise an after-sales request.");
    const problems = passengerProblems(input.passengers, lastFlightDate(file));
    if (problems.length) throw new TicketingError(problems.join(" "));
    await tx.flightPassenger.deleteMany({ where: { ticketingId: file.id } });
    await tx.flightPassenger.createMany({
      data: input.passengers.map((p, position) => ({
        ticketingId: file.id, position, kind: p.kind, title: p.title, givenNames: p.givenNames, surname: p.surname,
        dateOfBirth: p.dateOfBirth || null, nationality: p.nationality || null,
        documentNumber: p.documentNumber || null, documentExpiry: p.documentExpiry || null,
      })),
    });
    await bump(tx, file.id);
    await note(tx, enquiry.id, actor.id, "TICKETING_TRAVELLERS_SAVED", null, { travellers: input.passengers.length });
  });
}

/* ------------------------------------------------------------------ status */

type Move =
  | { to: "AWAITING_PAYMENT" | "OPTIONS" | "READY_TO_TICKET" }
  | { to: "TICKETING"; pnr: string; partner: string; ticketTimeLimit: Date }
  | { to: "CANCELLED"; reason: string }
  | { to: "CLOSED" };

export async function advanceTicketing(actorId: string, input: { reference: string; version: number; move: Move }) {
  return db.$transaction(async (tx) => {
    const { actor, enquiry, file } = await lockFile(tx, actorId, input.reference, input.version);
    const { move } = input;
    if (!canMoveTicketing(file.status, move.to)) throw new TicketingError(`A file at "${label(file.status)}" cannot move to "${label(move.to)}".`);
    const funding = await ticketingFunding(tx, enquiry.id);
    const chosen = selectedOption(file);
    const data: Prisma.FlightTicketingUpdateInput = { status: move.to };
    let body: string | null = null;
    switch (move.to) {
      case "AWAITING_PAYMENT":
        if (!chosen) throw new TicketingError("Choose a fare before asking for payment.");
        if (chosen.validUntil <= new Date()) throw new TicketingError("The chosen fare has expired. Refresh the price first.");
        break;
      case "OPTIONS":
        if (funding.funded) throw new TicketingError("Funds are already verified for this file, so the fare cannot be reopened. Contact Finance.");
        break;
      case "READY_TO_TICKET": {
        if (!chosen) throw new TicketingError("Choose a fare first.");
        if (!funding.funded) throw new TicketingError("Verified funds covering the accepted quote are required before ticketing.");
        if (!file.passengers.length) throw new TicketingError("List every traveller before ticketing.");
        const problems = passengerProblems(
          file.passengers.map((p) => ({ kind: p.kind as PassengerInput["kind"], title: p.title as PassengerInput["title"], givenNames: p.givenNames, surname: p.surname, dateOfBirth: p.dateOfBirth ?? "", nationality: p.nationality ?? "", documentNumber: p.documentNumber ?? "", documentExpiry: p.documentExpiry ?? "" })),
          lastFlightDate(file), enquiryParty(enquiry.details) ?? undefined);
        if (problems.length) throw new TicketingError(problems.join(" "));
        if (file.passengers.some((p) => !p.documentNumber || !p.dateOfBirth)) throw new TicketingError("Every traveller needs a date of birth and passport number before ticketing.");
        if (chosen.validUntil <= new Date()) throw new TicketingError("The chosen fare has expired. Reconfirm it with the partner and update the option.");
        break;
      }
      case "TICKETING":
        if (move.ticketTimeLimit <= new Date()) throw new TicketingError("The ticketing time limit has already passed.");
        if (!funding.funded) throw new TicketingError("Verified funds are required before sending to the partner.");
        data.pnr = move.pnr; data.partner = move.partner; data.ticketTimeLimit = move.ticketTimeLimit;
        body = `PNR ${move.pnr} held with ${move.partner}`;
        break;
      case "CANCELLED":
        body = move.reason;
        if (file.status === "ISSUED") throw new TicketingError("Issued tickets are cancelled through a void or refund request.");
        break;
      case "CLOSED": {
        const arrive = lastFlightDate(file, "arrive");
        if (!arrive || arrive >= todayInRwanda()) throw new TicketingError("A file closes after the last flight has landed.");
        break;
      }
    }
    await bump(tx, file.id, data);
    await note(tx, enquiry.id, actor.id, `TICKETING_${move.to}`, body, { from: file.status, to: move.to });
    if (move.to === "CANCELLED" && funding.paidMinor > 0)
      await note(tx, enquiry.id, actor.id, "TICKETING_REFUND_REVIEW", `Funds of ${formatQuoteMoney(funding.paidMinor, funding.currency ?? "RWF")} were received. Finance must settle the customer's refund.`);
  });
}

/* ------------------------------------------------------------------ issuing */

export async function issueTickets(actorId: string, input: { reference: string; version: number; issue: IssueInput }) {
  return db.$transaction(async (tx) => {
    const { actor, enquiry, file } = await lockFile(tx, actorId, input.reference, input.version);
    if (file.status !== "TICKETING") throw new TicketingError("Send the booking to the ticketing partner before recording tickets.");
    if (!(await ticketingFunding(tx, enquiry.id)).funded) throw new TicketingError("Verified funds are required before tickets are recorded.");
    const problems = ticketProblems(input.issue.tickets, file.passengers.map((p) => p.id));
    if (problems.length) throw new TicketingError(problems.join(" "));
    const now = new Date();
    try {
      for (const ticket of input.issue.tickets)
        await tx.flightPassenger.update({ where: { id: ticket.passengerId }, data: { ticketNumber: ticket.ticketNumber, ticketedAt: now } });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new TicketingError("One of these ticket numbers is already recorded on another file.");
      throw error;
    }
    const late = file.ticketTimeLimit && now > file.ticketTimeLimit;
    await bump(tx, file.id, {
      status: "ISSUED", pnr: input.issue.pnr, partner: input.issue.partner, partnerReference: input.issue.partnerReference || null,
      issuanceEvidence: input.issue.evidence, issuedAt: now, issuedById: actor.id,
    });
    await note(tx, enquiry.id, actor.id, "TICKETING_ISSUED", input.issue.evidence, {
      pnr: input.issue.pnr, tickets: input.issue.tickets.length, ...(late ? { afterTimeLimit: true } : {}),
    });
  });
}

/* ------------------------------------------------------------------ delivery */

export function itineraryEmail(file: TicketingFile, enquiry: { reference: string; name: string }, brand: ReturnType<typeof buildSite>) {
  const option = selectedOption(file)!;
  const segments = option.segments.map((s) => `${s.airline}${s.flightNumber} · ${s.origin} ${s.departLocal.replace("T", " ")} → ${s.destination} ${s.arriveLocal.replace("T", " ")}`);
  return renderEmail({
    subject: `Your e-ticket itinerary ${enquiry.reference}`,
    heading: "Your tickets are issued",
    name: enquiry.name,
    paragraphs: [
      "Your flights are ticketed. Your itinerary and ticket numbers are ready to download from your account.",
      ...segments,
      "Please check every name against the passport before you travel, and arrive at the airport in good time.",
    ],
    details: [["Booking reference (PNR)", file.pnr ?? ""], ["Travellers", String(file.passengers.length)], ["Enquiry reference", enquiry.reference]],
    cta: { label: "Open your trip", href: `/account/enquiries/${enquiry.reference}/trip` },
  }, brand);
}

export async function deliverItinerary(actorId: string, input: { reference: string; version: number; channel: "EMAIL" | "MANUAL" }) {
  return db.$transaction(async (tx) => {
    const { actor, enquiry, file } = await lockFile(tx, actorId, input.reference, input.version);
    if (file.status !== "ISSUED" || !selectedOption(file)) throw new TicketingError("Issue the tickets before delivering the itinerary.");
    let jobId: string | null = null;
    if (input.channel === "EMAIL") {
      if (!enquiry.email || enquiry.replyChannel !== "EMAIL") throw new TicketingError("This client did not choose email. Download the PDF and send it through their chosen channel, then mark it delivered.");
      const brand = buildSite(await tx.siteSettings.findUnique({ where: { id: 1 } }));
      const email = itineraryEmail(file, { reference: input.reference, name: enquiry.name }, brand);
      const job = await tx.notificationJob.create({
        select: { id: true },
        data: {
          enquiryId: enquiry.id, toEmail: enquiry.email, kind: "STAFF_EMAIL", channel: "EMAIL",
          dedupeKey: `itinerary:${file.id}:${file.version}`, message: { ...email, replyTo: brand.contact.email },
        },
      });
      jobId = job.id;
    }
    await bump(tx, file.id, { deliveredAt: new Date() });
    await note(tx, enquiry.id, actor.id, "TICKETING_ITINERARY_DELIVERED", null, { channel: input.channel, ...(jobId ? { notificationId: jobId } : {}) });
    return jobId;
  });
}

/* ------------------------------------------------------------------ after-sales */

async function notifyCase(tx: Tx, enquiryId: string, title: string, body: string) {
  const row = await tx.enquiry.findUnique({ where: { id: enquiryId }, select: { reference: true, ownerId: true } });
  if (!row) return;
  const recipients = row.ownerId ? [{ id: row.ownerId }] : await tx.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  if (!recipients.length) return;
  await tx.notification.createMany({
    data: recipients.map((user) => ({
      userId: user.id, type: "ticketing.update", title, body: `${row.reference}: ${body}`, href: `/staff/ticketing/${row.reference}`, channel: "in_app",
    })),
  });
}

export async function raiseServiceRequest(userId: string, raw: z.input<typeof clientServiceSchema>, origin: "CLIENT" | "STAFF" = "CLIENT") {
  const input = clientServiceSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true, role: true, staffRole: true } });
    if (!actor?.isActive) throw new TicketingError("Sign in to raise a request.");
    let file: TicketingFile;
    let enquiryId: string;
    if (origin === "STAFF") {
      const loaded = await lockFile(tx, userId, input.reference);
      file = loaded.file; enquiryId = loaded.enquiry.id;
    } else {
      const enquiry = await tx.enquiry.findFirst({ where: { reference: input.reference, service: "FLIGHT", ...clientScope(userId) }, select: { id: true } });
      const row = enquiry && await tx.flightTicketing.findUnique({ where: { enquiryId: enquiry.id }, select: { id: true } });
      if (!enquiry || !row) throw new TicketingError("This trip is unavailable.");
      await tx.$queryRaw`SELECT id FROM flight_ticketing WHERE id = ${row.id}::uuid FOR UPDATE`;
      file = await tx.flightTicketing.findUniqueOrThrow({ where: { id: row.id }, include: fileInclude });
      enquiryId = enquiry.id;
    }
    if (file.status !== "ISSUED") throw new TicketingError("After-sales requests are available once tickets are issued.");
    const open = file.requests.filter((r) => isServiceOpen(r.status));
    if (open.length >= 5) throw new TicketingError("There are already several open requests on this trip. Wait for the desk to respond.");
    const ids = input.passengerIds.length ? input.passengerIds : file.passengers.filter((p) => p.status === "ACTIVE").map((p) => p.id);
    const active = new Set(file.passengers.filter((p) => p.status === "ACTIVE").map((p) => p.id));
    if (!ids.length || ids.some((id) => !active.has(id))) throw new TicketingError("Choose travellers with an active ticket.");
    if (open.some((r) => r.kind === input.kind && r.passengerIds.some((id) => ids.includes(id)))) throw new TicketingError("A request of this kind is already open for one of these travellers.");
    const created = await tx.flightServiceRequest.create({
      data: {
        ticketingId: file.id, number: (file.requests[0]?.number ?? 0) + 1, kind: input.kind, origin, requestedById: userId,
        description: input.description, passengerIds: ids, currency: selectedOption(file)?.currency ?? null,
      },
    });
    await bump(tx, file.id);
    await note(tx, enquiryId, userId, "TICKETING_REQUEST_RAISED", input.description, { number: created.number, kind: input.kind, origin });
    if (origin === "CLIENT") await notifyCase(tx, enquiryId, "After-sales request", `${label(input.kind)} requested on a ticketed trip.`);
    return created.number;
  });
}

export async function updateServiceRequest(actorId: string, input: {
  reference: string; version: number; requestId: string; status: ServiceStatus; evidence: string; resolution: string;
  feeMinor: number; refundMinor: number; tickets: { passengerId: string; ticketNumber: string }[];
}) {
  return db.$transaction(async (tx) => {
    const { actor, enquiry, file } = await lockFile(tx, actorId, input.reference, input.version);
    const request = file.requests.find((r) => r.id === input.requestId);
    if (!request) throw new TicketingError("This request is not on this file.");
    if (!nextServiceStatuses(request.status as ServiceStatus).includes(input.status)) throw new TicketingError(`A request that is ${label(request.status)} cannot become ${label(input.status)}.`);
    const kind = request.kind as ServiceKind;
    const closing = ["COMPLETED", "REJECTED", "WITHDRAWN"].includes(input.status);
    if (input.status === "REJECTED" && input.resolution.length < 5) throw new TicketingError("Give the client a reason for declining.");
    if (input.status === "COMPLETED") {
      const problems = serviceCompletionProblems(kind, input);
      if (problems.length) throw new TicketingError(problems.join(" "));
      const targets = request.passengerIds;
      if (kind === "VOID" || kind === "REFUND")
        await tx.flightPassenger.updateMany({ where: { id: { in: targets }, ticketingId: file.id }, data: { status: kind === "VOID" ? "VOIDED" : "REFUNDED" } });
      if (kind === "REISSUE") {
        const need = new Set(targets);
        const given = new Set(input.tickets.map((t) => t.passengerId));
        if (targets.some((id) => !given.has(id)) || [...given].some((id) => !need.has(id))) throw new TicketingError("Enter the new ticket number for each reissued traveller.");
        for (const t of input.tickets) {
          const passenger = file.passengers.find((p) => p.id === t.passengerId)!;
          try {
            await tx.flightPassenger.update({
              where: { id: passenger.id },
              data: { ticketNumber: t.ticketNumber, ticketedAt: new Date(), previousTickets: passenger.ticketNumber ? [...passenger.previousTickets, passenger.ticketNumber] : passenger.previousTickets },
            });
          } catch (error) {
            if ((error as { code?: string }).code === "P2002") throw new TicketingError("A new ticket number is already recorded elsewhere.");
            throw error;
          }
        }
      }
    }
    await tx.flightServiceRequest.update({
      where: { id: request.id },
      data: {
        status: input.status, partnerEvidence: input.evidence || request.partnerEvidence, resolution: input.resolution || request.resolution,
        feeMinor: input.feeMinor, refundMinor: input.refundMinor,
        ...(closing ? { closedAt: new Date(), closedById: actor.id } : {}),
      },
    });
    await bump(tx, file.id);
    await note(tx, enquiry.id, actor.id, `TICKETING_REQUEST_${input.status}`, input.resolution || input.evidence || null, {
      number: request.number, kind, feeMinor: input.feeMinor, refundMinor: input.refundMinor,
    });
    if (input.status === "COMPLETED" && kind === "REFUND" && input.refundMinor > 0)
      await note(tx, enquiry.id, actor.id, "TICKETING_REFUND_REVIEW", `Partner confirmed a refund of ${formatQuoteMoney(input.refundMinor, request.currency ?? "RWF")}. Finance must settle it with the client.`);
  });
}

/** Replaces the flights on the chosen fare after the partner confirmed a change or reissue. */
export async function reviseItinerary(actorId: string, input: { reference: string; version: number; requestId: string; segments: SegmentInput[] }) {
  return db.$transaction(async (tx) => {
    const { actor, enquiry, file } = await lockFile(tx, actorId, input.reference, input.version);
    const request = file.requests.find((r) => r.id === input.requestId);
    const option = selectedOption(file);
    if (file.status !== "ISSUED" || !option) throw new TicketingError("Only an issued file can be revised.");
    if (!request || request.status !== "APPROVED" || !["CHANGE", "REISSUE"].includes(request.kind)) throw new TicketingError("Approve a change or reissue request first.");
    validateSegmentOrder(input.segments);
    await tx.flightSegment.deleteMany({ where: { optionId: option.id } });
    await tx.flightSegment.createMany({ data: input.segments.map((segment, position) => ({ ...segment, optionId: option.id, position })) });
    await bump(tx, file.id, { deliveredAt: null });
    await note(tx, enquiry.id, actor.id, "TICKETING_ITINERARY_REVISED", null, { requestNumber: request.number, segments: input.segments.length });
  });
}

/* ------------------------------------------------------------------ retention */

/** Clears travel-document details once the trip is over. Names and ticket numbers stay for the record. */
export async function redactTicketingDocuments(apply: boolean, now = new Date()) {
  const files = await db.flightTicketing.findMany({
    where: { redactedAt: null, passengers: { some: { OR: [{ documentNumber: { not: null } }, { dateOfBirth: { not: null } }] } } },
    include: { options: { include: { segments: { orderBy: { position: "asc" } } } } },
  });
  let cleared = 0;
  for (const file of files) {
    const last = lastFlightDate(file, "arrive") ?? lastFlightDate(file);
    const due = last ? documentsExpireOn(last) : ["CANCELLED", "CLOSED"].includes(file.status) ? documentsExpireOn(file.updatedAt.toISOString().slice(0, 10)) : null;
    if (!due || due > now) continue;
    cleared += 1;
    if (apply)
      await db.$transaction([
        db.flightPassenger.updateMany({ where: { ticketingId: file.id }, data: { dateOfBirth: null, nationality: null, documentNumber: null, documentExpiry: null } }),
        db.flightTicketing.update({ where: { id: file.id }, data: { redactedAt: now } }),
      ]);
  }
  return { files: cleared, applied: apply };
}

/* ------------------------------------------------------------------ reads */

export type QueueFilter = "open" | "expiring" | "issued" | "requests" | "all";

export async function readTicketingFile(actorId: string, reference: string) {
  const actor = await db.user.findUnique({ where: { id: actorId }, select: { id: true, role: true, staffRole: true, isActive: true } });
  if (!actor || !canUseEnquiries(actor)) return null;
  const enquiry = await db.enquiry.findFirst({
    where: { reference, service: "FLIGHT", ...enquiryScope(actor) },
    select: {
      id: true, reference: true, status: true, name: true, phone: true, email: true, replyChannel: true, details: true, ownerId: true,
      owner: { select: { fullName: true } },
      activities: {
        where: { kind: { startsWith: "TICKETING_" } }, orderBy: { createdAt: "desc" }, take: 40,
        select: { id: true, kind: true, body: true, createdAt: true, changes: true, actor: { select: { fullName: true } } },
      },
      financialCase: { select: { currency: true, customerChargeMinor: true } },
    },
  });
  if (!enquiry) return null;
  const file = await db.flightTicketing.findUnique({ where: { enquiryId: enquiry.id }, include: fileInclude });
  const finance = isFinance(actor);
  const funding = await ticketingFunding(db, enquiry.id);
  return {
    enquiry, file, funding, party: enquiryParty(enquiry.details),
    canEdit: !finance && (actor.role === "ADMIN" || enquiry.ownerId === actor.id),
    // Finance sees the money and the ticket state, never passport details.
    canSeeDocuments: !finance,
  };
}

export async function ticketingQueue(actorId: string, filter: QueueFilter, skip: number, take: number) {
  const actor = await db.user.findUnique({ where: { id: actorId }, select: { id: true, role: true, staffRole: true, isActive: true } });
  if (!actor || !canUseEnquiries(actor)) return { rows: [], total: 0, summary: emptySummary() };
  const scope: Prisma.FlightTicketingWhereInput = { enquiry: enquiryScope(actor) };
  const active: Prisma.FlightTicketingWhereInput = { status: { in: ["OPTIONS", "AWAITING_PAYMENT", "READY_TO_TICKET", "TICKETING"] } };
  const soon = new Date(Date.now() + 48 * 3_600_000);
  const where: Prisma.FlightTicketingWhereInput = {
    AND: [scope,
      filter === "open" ? active
        : filter === "issued" ? { status: { in: ["ISSUED", "CLOSED"] } }
        : filter === "requests" ? { requests: { some: { status: { in: ["REQUESTED", "QUOTED", "APPROVED"] } } } }
        : filter === "expiring" ? { AND: [active, { OR: [{ status: "TICKETING", ticketTimeLimit: { lte: soon } }, { status: { not: "TICKETING" }, options: { some: { validUntil: { lte: soon } } } }] }] }
        : {}],
  };
  const [rows, total, groups, requests] = await Promise.all([
    db.flightTicketing.findMany({
      where, skip, take, orderBy: [{ updatedAt: "desc" }],
      include: {
        ...fileInclude,
        enquiry: { select: { reference: true, name: true, phone: true, owner: { select: { fullName: true } } } },
      },
    }),
    db.flightTicketing.count({ where }),
    db.flightTicketing.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    db.flightServiceRequest.count({ where: { status: { in: ["REQUESTED", "QUOTED", "APPROVED"] }, ticketing: scope } }),
  ]);
  const activeFiles = await db.flightTicketing.findMany({ where: { AND: [scope, active] }, include: { options: { select: { validUntil: true, selected: true } } } });
  const urgencies = activeFiles.map((file) => deadlineUrgency(fileDeadline({ status: file.status, options: file.options as never, ticketTimeLimit: file.ticketTimeLimit })));
  const summary = {
    ...emptySummary(),
    byStatus: Object.fromEntries(groups.map((g) => [g.status, g._count._all])) as Record<string, number>,
    overdue: urgencies.filter((u) => u === "overdue").length,
    critical: urgencies.filter((u) => u === "critical" || u === "soon").length,
    requests,
  };
  rows.sort((a, b) => (fileDeadline(a)?.getTime() ?? Infinity) - (fileDeadline(b)?.getTime() ?? Infinity));
  return { rows, total, summary };
}
const emptySummary = () => ({ byStatus: {} as Record<string, number>, overdue: 0, critical: 0, requests: 0 });

/** What a client sees on their trip: no document numbers, never another traveller's private data. */
export async function readClientTrip(userId: string, reference: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { isActive: true } });
  if (!user?.isActive) return null;
  const enquiry = await db.enquiry.findFirst({
    where: { reference, service: "FLIGHT", ...clientScope(userId) },
    select: { id: true, reference: true, status: true, name: true, clientAccess: { where: { userId, active: true }, select: { canAccept: true } } },
  });
  if (!enquiry) return null;
  const file = await db.flightTicketing.findUnique({
    where: { enquiryId: enquiry.id },
    select: {
      id: true, status: true, optionsSharedAt: true, pnr: true, partner: true, issuedAt: true, ticketTimeLimit: true,
      options: { orderBy: { position: "asc" }, include: { segments: { orderBy: { position: "asc" } } } },
      passengers: { orderBy: { position: "asc" }, select: { id: true, kind: true, title: true, givenNames: true, surname: true, ticketNumber: true, status: true } },
      requests: { orderBy: { number: "desc" }, select: { id: true, number: true, kind: true, status: true, description: true, resolution: true, createdAt: true, closedAt: true } },
    },
  });
  if (!file || file.status === "CANCELLED") return { enquiry, file: null };
  const visible = file.status === "OPTIONS" ? file.optionsSharedAt ? file.options : [] : file.options.filter((o) => o.selected);
  return { enquiry, file: { ...file, options: visible } };
}

export const airlineLabel = (code: string) => (isAirlineCode(code) ? airlines[code] : code);
