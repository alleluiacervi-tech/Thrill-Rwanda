import { z } from "zod";
import { airlines, isAirlineCode } from "@/lib/flight-airlines";
import { enquiryDateSchema } from "@/lib/flight-enquiry-schema";

/**
 * Pure rules for the air-ticketing desk. Tickets are issued by the contracted
 * ticketing partner; this module decides what staff may record and when.
 */

export const TICKETING_STATUSES = [
  "OPTIONS",
  "AWAITING_PAYMENT",
  "READY_TO_TICKET",
  "TICKETING",
  "ISSUED",
  "CLOSED",
  "CANCELLED",
] as const;
export type TicketingStatus = (typeof TICKETING_STATUSES)[number];

export const TICKETING_STAGES: { status: TicketingStatus; label: string; hint: string }[] = [
  { status: "OPTIONS", label: "Fare options", hint: "Checked fares are prepared and shared." },
  { status: "AWAITING_PAYMENT", label: "Awaiting payment", hint: "A fare is chosen; funds are being verified." },
  { status: "READY_TO_TICKET", label: "Ready to ticket", hint: "Funds are verified and every traveller is listed." },
  { status: "TICKETING", label: "With ticketing partner", hint: "The booking is held and the partner is issuing." },
  { status: "ISSUED", label: "Tickets issued", hint: "Ticket numbers are recorded and the itinerary is available." },
];

const transitions: Record<TicketingStatus, TicketingStatus[]> = {
  OPTIONS: ["AWAITING_PAYMENT", "CANCELLED"],
  AWAITING_PAYMENT: ["OPTIONS", "READY_TO_TICKET", "CANCELLED"],
  READY_TO_TICKET: ["AWAITING_PAYMENT", "TICKETING", "CANCELLED"],
  TICKETING: ["READY_TO_TICKET", "ISSUED", "CANCELLED"],
  ISSUED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};
export const nextTicketingStatuses = (from: TicketingStatus) => transitions[from];
export const canMoveTicketing = (from: TicketingStatus, to: TicketingStatus) => transitions[from].includes(to);
/** Passenger and itinerary data may be edited until the tickets are issued. */
export const isTicketingEditable = (status: TicketingStatus) => ["OPTIONS", "AWAITING_PAYMENT", "READY_TO_TICKET", "TICKETING"].includes(status);
export const isTicketingActive = (status: TicketingStatus) => !["CLOSED", "CANCELLED"].includes(status);

export class TicketingError extends Error {}

/* ------------------------------------------------------------------ deadlines */

export type Urgency = "none" | "ok" | "soon" | "critical" | "overdue";

/** How close a ticketing deadline is; only open files carry an urgency. */
export function deadlineUrgency(deadline: Date | null | undefined, now = new Date()): Urgency {
  if (!deadline) return "none";
  const left = deadline.getTime() - now.getTime();
  if (left <= 0) return "overdue";
  if (left < 6 * 3_600_000) return "critical";
  if (left < 24 * 3_600_000) return "soon";
  return "ok";
}

export function countdown(deadline: Date, now = new Date()) {
  const left = deadline.getTime() - now.getTime();
  const abs = Math.abs(left);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const text = days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  return left <= 0 ? `${text} overdue` : `${text} left`;
}

/* ------------------------------------------------------------------ identifiers */

export const pnrSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{5,8}$/, "A booking reference (PNR) is 5 to 8 letters or digits");
export const ticketNumberSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\d{13}$/, "A ticket number is 13 digits, for example 176 2345678901"));

/** Airline designators are two characters (WB, ET); the list also accepts any other valid code. */
const airlineCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2}$/, "Use the two-character airline code");
const airportCode = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use the three-letter airport code");
const localTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use the airport-local date and time");
const money = z.coerce.number().int().min(1).max(2_000_000_000);
const text = (max: number) => z.string().trim().max(max);

export const CABINS = ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"] as const;

export const segmentSchema = z
  .object({
    airline: airlineCode,
    flightNumber: z.string().trim().toUpperCase().regex(/^\d{1,4}[A-Z]?$/, "Use the flight number without the airline code"),
    origin: airportCode,
    destination: airportCode,
    departLocal: localTime,
    arriveLocal: localTime,
    cabin: z.enum(CABINS).default("ECONOMY"),
    bookingClass: z.string().trim().toUpperCase().regex(/^[A-Z]?$/, "Booking class is one letter").default(""),
    terminal: text(20).default(""),
  })
  .superRefine((segment, ctx) => {
    if (segment.origin === segment.destination)
      ctx.addIssue({ code: "custom", path: ["destination"], message: "A flight needs two different airports" });
  });
export type SegmentInput = z.infer<typeof segmentSchema>;

/** Segment times are airport-local, so only the calendar dates are compared, never a duration. */
export function validateSegmentOrder(segments: Pick<SegmentInput, "departLocal" | "arriveLocal">[]) {
  for (const [index, segment] of segments.entries()) {
    if (segment.arriveLocal.slice(0, 10) < segment.departLocal.slice(0, 10))
      throw new TicketingError(`Flight ${index + 1} lands before it departs.`);
    const previous = segments[index - 1];
    if (previous && segment.departLocal.slice(0, 10) < previous.arriveLocal.slice(0, 10))
      throw new TicketingError(`Flight ${index + 1} leaves before the previous flight lands.`);
  }
}

export const optionSchema = z.object({
  label: z.string().trim().min(2, "Name the option").max(80),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  totalMinor: money,
  fareBasis: text(40).default(""),
  baggage: text(300).default(""),
  changeRule: text(500).default(""),
  refundRule: text(500).default(""),
  validUntil: z.coerce.date(),
  /** MANUAL fares are typed by the desk; DUFFEL fares came from the API and carry its offer id. */
  source: z.enum(["MANUAL", "DUFFEL"]).default("MANUAL"),
  externalId: z.string().trim().max(80).nullable().default(null),
  segments: z.array(segmentSchema).min(1, "Add at least one flight").max(12),
});
type ParsedOption = z.infer<typeof optionSchema>;
/** What the desk passes in. The supplier link is optional, so hand-typed fares need not mention it. */
export type OptionInput = Omit<ParsedOption, "source" | "externalId"> & Partial<Pick<ParsedOption, "source" | "externalId">>;
export const optionsSchema = z.array(optionSchema).min(1, "Add at least one fare option").max(6);

/* ------------------------------------------------------------------ travellers */

export const PASSENGER_KINDS = ["ADULT", "CHILD", "INFANT"] as const;
export type PassengerKind = (typeof PASSENGER_KINDS)[number];
const nameText = z
  .string()
  .trim()
  .min(1, "Enter the name exactly as on the passport")
  .max(60)
  .regex(/^[A-Za-z][A-Za-z' -]*$/, "Use letters as printed in the passport (no accents or digits)");

export const passengerSchema = z.object({
  kind: z.enum(PASSENGER_KINDS),
  title: z.enum(["", "MR", "MS", "MRS", "MISS", "MSTR", "DR"]).default(""),
  givenNames: nameText,
  surname: nameText,
  dateOfBirth: enquiryDateSchema.or(z.literal("")).default(""),
  nationality: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use the two-letter country code").or(z.literal("")).default(""),
  documentNumber: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5,20}$/, "Enter the passport number").or(z.literal("")).default(""),
  documentExpiry: enquiryDateSchema.or(z.literal("")).default(""),
});
export type PassengerInput = z.infer<typeof passengerSchema>;
export const passengersSchema = z.array(passengerSchema).min(1, "List at least one traveller").max(20);

export function ageOn(dateOfBirth: string, on: string) {
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  const [ty, tm, td] = on.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

/** Checks the list against the fare and the date of travel. Returns messages rather than throwing so the form can show them all. */
export function passengerProblems(
  passengers: PassengerInput[],
  lastDeparture: string | null,
  party?: { adults: number; children: number; infants: number },
) {
  const problems: string[] = [];
  const names = new Set<string>();
  for (const [i, p] of passengers.entries()) {
    const who = `Traveller ${i + 1}`;
    const key = `${p.givenNames}/${p.surname}/${p.dateOfBirth}`.toLowerCase();
    if (names.has(key)) problems.push(`${who} duplicates another traveller.`);
    names.add(key);
    if (lastDeparture && p.documentExpiry) {
      const sixMonths = new Date(`${lastDeparture}T00:00:00Z`);
      sixMonths.setUTCMonth(sixMonths.getUTCMonth() + 6);
      if (p.documentExpiry < lastDeparture) problems.push(`${who}'s passport expires before the trip.`);
      else if (p.documentExpiry < sixMonths.toISOString().slice(0, 10))
        problems.push(`${who}'s passport expires within six months of the last flight; many countries refuse entry.`);
    }
    if (p.dateOfBirth && lastDeparture) {
      const age = ageOn(p.dateOfBirth, lastDeparture);
      if (age < 0) problems.push(`${who} has a date of birth after the trip.`);
      else if (p.kind === "INFANT" && age >= 2) problems.push(`${who} is 2 or older on the last flight and cannot travel as an infant.`);
      else if (p.kind === "CHILD" && (age < 2 || age >= 12)) problems.push(`${who} is ${age} and must be booked as ${age < 2 ? "an infant" : "an adult"}.`);
      else if (p.kind === "ADULT" && age < 12) problems.push(`${who} is ${age} and must be booked as ${age < 2 ? "an infant" : "a child"}.`);
    }
  }
  const count = (kind: PassengerKind) => passengers.filter((p) => p.kind === kind).length;
  if (count("INFANT") > count("ADULT")) problems.push("Each infant needs an accompanying adult.");
  if (party) {
    for (const [kind, label, wanted] of [["ADULT", "adults", party.adults], ["CHILD", "children", party.children], ["INFANT", "infants", party.infants]] as const)
      if (count(kind) !== wanted) problems.push(`The request was for ${wanted} ${label}; ${count(kind)} listed.`);
  }
  return problems;
}

/** Party size from the original enquiry; defaults to one adult for older or phone-captured records. */
export function enquiryParty(details: unknown) {
  const parsed = z
    .object({ adults: z.coerce.number().int().min(0).max(20), children: z.coerce.number().int().min(0).max(20), infants: z.coerce.number().int().min(0).max(20) })
    .safeParse(details);
  return parsed.success && parsed.data.adults + parsed.data.children + parsed.data.infants > 0 ? parsed.data : null;
}

/* ------------------------------------------------------------------ issuing */

export const issueSchema = z.object({
  pnr: pnrSchema,
  partner: z.string().trim().min(2, "Name the ticketing partner").max(120),
  partnerReference: text(80).default(""),
  evidence: z.string().trim().min(10, "Describe the partner's confirmation (what you saw and where)").max(1000),
  tickets: z.array(z.object({ passengerId: z.string().uuid(), ticketNumber: ticketNumberSchema })).min(1),
});
export type IssueInput = z.infer<typeof issueSchema>;

export function ticketProblems(tickets: IssueInput["tickets"], passengerIds: string[]) {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const t of tickets) {
    if (seen.has(t.ticketNumber)) problems.push(`Ticket ${t.ticketNumber} is entered twice.`);
    seen.add(t.ticketNumber);
  }
  const given = new Set(tickets.map((t) => t.passengerId));
  if (passengerIds.some((id) => !given.has(id))) problems.push("Every traveller needs a ticket number.");
  if (tickets.some((t) => !passengerIds.includes(t.passengerId))) problems.push("A ticket was entered for someone who is not on this file.");
  return problems;
}

/* ------------------------------------------------------------------ after-sales */

export const SERVICE_KINDS = ["CHANGE", "REISSUE", "NAME_CORRECTION", "VOID", "REFUND"] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];
export const SERVICE_KIND_LABEL: Record<ServiceKind, string> = {
  CHANGE: "Change flights or dates",
  REISSUE: "Reissue ticket",
  NAME_CORRECTION: "Correct a name",
  VOID: "Void ticket",
  REFUND: "Refund ticket",
};
export const SERVICE_STATUSES = ["REQUESTED", "QUOTED", "APPROVED", "COMPLETED", "REJECTED", "WITHDRAWN"] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];
const serviceTransitions: Record<ServiceStatus, ServiceStatus[]> = {
  REQUESTED: ["QUOTED", "APPROVED", "REJECTED", "WITHDRAWN"],
  QUOTED: ["APPROVED", "REJECTED", "WITHDRAWN"],
  APPROVED: ["COMPLETED", "REJECTED"],
  COMPLETED: [],
  REJECTED: [],
  WITHDRAWN: [],
};
export const nextServiceStatuses = (from: ServiceStatus) => serviceTransitions[from];
export const isServiceOpen = (status: string) => ["REQUESTED", "QUOTED", "APPROVED"].includes(status);

export const clientServiceSchema = z.object({
  reference: z.string().min(1).max(80),
  kind: z.enum(SERVICE_KINDS),
  description: z.string().trim().min(10, "Tell us what you need (at least 10 characters)").max(1500),
  passengerIds: z.array(z.string().uuid()).max(20).default([]),
});

export const staffServiceSchema = z.object({
  reference: z.string().min(1).max(80),
  requestId: z.string().uuid(),
  status: z.enum(SERVICE_STATUSES),
  evidence: z.string().trim().max(1000).default(""),
  resolution: z.string().trim().max(1000).default(""),
  feeMinor: z.coerce.number().int().min(0).max(2_000_000_000).default(0),
  refundMinor: z.coerce.number().int().min(0).max(2_000_000_000).default(0),
});

/** A completed request must carry the partner's decision; a refund must say how much comes back. */
export function serviceCompletionProblems(kind: ServiceKind, input: { evidence: string; refundMinor: number }) {
  const problems: string[] = [];
  if (input.evidence.length < 10) problems.push("Record the partner's confirmation before completing.");
  if (kind === "REFUND" && input.refundMinor <= 0) problems.push("Enter the refund amount confirmed by the partner (zero is not a refund).");
  return problems;
}

/* ------------------------------------------------------------------ retention */

/** Travel-document details are kept until this many days after the last flight, then cleared. */
export const DOCUMENT_RETENTION_DAYS = 30;
export function documentsExpireOn(lastDeparture: string) {
  const date = new Date(`${lastDeparture}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + DOCUMENT_RETENTION_DAYS);
  return date;
}

export const airlineName = (code: string) => (isAirlineCode(code) ? airlines[code] : code);
export { formatQuoteMoney as money2 } from "@/lib/quote-rules";
