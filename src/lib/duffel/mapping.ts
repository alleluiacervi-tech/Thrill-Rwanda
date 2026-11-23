import { airportCodeOf, todayInRwanda } from "@/lib/flight-enquiry-schema";
import type { OptionInput, SegmentInput } from "@/lib/ticketing-rules";
import type {
  DuffelCondition,
  DuffelOffer,
  DuffelOrder,
  DuffelOrderPassenger,
  DuffelPassengerRequest,
  DuffelSegment,
} from "@/lib/duffel/types";

/**
 * Pure translation between this app's flight records and Duffel's. Nothing
 * here touches the network or the database, so it is tested with fixtures.
 */

/** Thrown for problems staff can fix on the enquiry or the travellers, before anything is sent to Duffel. */
export class DuffelInputError extends Error {}

/* -------------------------------------------------------------------- money */

/** Amounts are held in minor units; RWF has none, every other currency has two. Matches formatQuoteMoney. */
export const minorFactor = (currency: string) => (currency === "RWF" ? 1 : 100);

export function toMinor(amount: string, currency: string): number {
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new DuffelInputError(`Duffel sent an amount this app cannot read: ${amount}`);
  const [whole, fraction = ""] = amount.split(".");
  const digits = String(minorFactor(currency)).length - 1;
  const minor = Number(whole) * minorFactor(currency) + Number(fraction.padEnd(digits, "0").slice(0, digits) || 0);
  // Rounds up a stray extra digit instead of ever undercharging.
  const extra = fraction.length > digits && Number(fraction.slice(digits)) > 0 ? 1 : 0;
  return minor + extra;
}

/* ------------------------------------------------------------------- search */

type EnquiryDetails = {
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  tripType?: string;
  additionalLegs?: { origin: string; destination: string; departureDate: string }[];
  adults?: number;
  children?: number;
  infants?: number;
  cabin?: string;
  nonstopOnly?: boolean;
};

const CABIN: Record<string, string> = { ECONOMY: "economy", PREMIUM_ECONOMY: "premium_economy", BUSINESS: "business", FIRST: "first" };

function code(place: string | undefined, role: string): string {
  const found = place ? airportCodeOf(place) : null;
  if (!found) {
    throw new DuffelInputError(
      `Live search needs an airport code for the ${role}${place ? ` ("${place}")` : ""}. Edit the enquiry so it reads like "Kigali (KGL)".`,
    );
  }
  return found;
}

/** The search Duffel is asked to run, built from what the client asked for. */
export function searchFromEnquiry(raw: unknown, today = todayInRwanda()) {
  const d = (raw ?? {}) as EnquiryDetails;
  const slices: { origin: string; destination: string; departure_date: string }[] = [];
  const leg = (origin: string | undefined, destination: string | undefined, date: string | undefined, n: number) => {
    if (!date) throw new DuffelInputError("The enquiry has no departure date.");
    if (date < today) throw new DuffelInputError(`Flight ${n} is on ${date}, which has already passed.`);
    slices.push({ origin: code(origin, "departure"), destination: code(destination, "destination"), departure_date: date });
  };
  leg(d.origin, d.destination, d.departureDate, 1);
  if (d.tripType === "RETURN") {
    if (!d.returnDate) throw new DuffelInputError("The enquiry has no return date.");
    leg(d.destination, d.origin, d.returnDate, 2);
  }
  if (d.tripType === "MULTI_CITY") d.additionalLegs?.forEach((l, i) => leg(l.origin, l.destination, l.departureDate, i + 2));

  const passengers: DuffelPassengerRequest[] = [
    ...Array.from({ length: d.adults ?? 1 }, () => ({ type: "adult" })),
    ...Array.from({ length: d.children ?? 0 }, () => ({ type: "child" })),
    ...Array.from({ length: d.infants ?? 0 }, () => ({ type: "infant_without_seat" })),
  ];
  return {
    slices,
    passengers,
    cabin_class: CABIN[d.cabin ?? "ECONOMY"] ?? "economy",
    max_connections: d.nonstopOnly ? 0 : 1,
  };
}

/* ------------------------------------------------------------------ offers */

export function durationText(iso: string | null | undefined): string {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?$/.exec(iso ?? "");
  if (!m) return "";
  const days = Number(m[1] ?? 0);
  const hours = Number(m[2] ?? 0) + days * 24;
  const minutes = Number(m[3] ?? 0);
  return `${hours ? `${hours}h ` : ""}${minutes ? `${minutes}m` : hours ? "" : "0m"}`.trim();
}

const localTime = (iso: string) => iso.slice(0, 16);

function baggageText(offer: DuffelOffer): string {
  const first = offer.slices[0]?.segments[0]?.passengers?.[0]?.baggages ?? [];
  const checked = first.filter((b) => b.type === "checked").reduce((n, b) => n + b.quantity, 0);
  const carry = first.filter((b) => b.type === "carry_on").reduce((n, b) => n + b.quantity, 0);
  const parts = [
    checked ? `${checked} checked ${checked === 1 ? "bag" : "bags"}` : "No checked bag",
    carry ? `${carry} carry-on` : "",
  ].filter(Boolean);
  return `${parts.join(" and ")} per traveller`;
}

function conditionText(c: DuffelCondition | undefined): string {
  if (!c) return "Not stated by the airline.";
  if (!c.allowed) return "Not allowed.";
  return c.penalty_amount && c.penalty_currency ? `Allowed, fee ${c.penalty_amount} ${c.penalty_currency}.` : "Allowed.";
}

const cabinOf = (offer: DuffelOffer): SegmentInput["cabin"] => {
  const raw = offer.slices[0]?.segments[0]?.passengers?.[0]?.cabin_class ?? "economy";
  return (raw.toUpperCase() as SegmentInput["cabin"]) ?? "ECONOMY";
};

/** One flight in a form the desk screens already understand. */
function segmentOf(s: DuffelSegment, cabin: SegmentInput["cabin"]): SegmentInput {
  const airline = s.marketing_carrier.iata_code ?? "";
  return {
    airline,
    flightNumber: s.marketing_carrier_flight_number.replace(new RegExp(`^${airline}`, "i"), ""),
    origin: s.origin.iata_code ?? "",
    destination: s.destination.iata_code ?? "",
    departLocal: localTime(s.departing_at),
    arriveLocal: localTime(s.arriving_at),
    cabin,
    bookingClass: "",
    terminal: s.origin_terminal ?? "",
  };
}

/** A fare option, ready to save in the ticketing file alongside the ones typed by hand. */
export function offerToOption(offer: DuffelOffer, label: string): OptionInput & { source: "DUFFEL"; externalId: string } {
  const cabin = cabinOf(offer);
  return {
    label: label.slice(0, 80),
    currency: offer.total_currency,
    totalMinor: toMinor(offer.total_amount, offer.total_currency),
    fareBasis: (offer.slices[0]?.segments[0]?.passengers?.[0]?.fare_basis_code ?? "").slice(0, 40),
    baggage: baggageText(offer),
    changeRule: `Before departure: ${conditionText(offer.conditions?.change_before_departure)}`,
    refundRule: `Before departure: ${conditionText(offer.conditions?.refund_before_departure)}`,
    validUntil: new Date(offer.expires_at),
    segments: offer.slices.flatMap((slice) => slice.segments.map((s) => segmentOf(s, cabin))),
    source: "DUFFEL",
    externalId: offer.id,
  } as OptionInput & { source: "DUFFEL"; externalId: string };
}

/** What the search screen shows for one result. Plain data: it crosses to the browser. */
export type FareResult = {
  id: string;
  airline: { name: string; code: string; logo: string | null };
  totalMinor: number;
  currency: string;
  expiresAt: string;
  fareBrand: string;
  baggage: string;
  changeRule: string;
  refundRule: string;
  slices: {
    from: string;
    to: string;
    duration: string;
    stops: number;
    segments: { flight: string; from: string; to: string; departLocal: string; arriveLocal: string }[];
  }[];
};

export function summariseOffer(offer: DuffelOffer): FareResult {
  const o = offerToOption(offer, offer.owner.name);
  return {
    id: offer.id,
    airline: { name: offer.owner.name, code: offer.owner.iata_code ?? "", logo: offer.owner.logo_symbol_url ?? null },
    totalMinor: o.totalMinor,
    currency: o.currency,
    expiresAt: offer.expires_at,
    fareBrand: offer.slices[0]?.fare_brand_name ?? "",
    baggage: o.baggage,
    changeRule: o.changeRule,
    refundRule: o.refundRule,
    slices: offer.slices.map((slice) => ({
      from: slice.origin.iata_code ?? "",
      to: slice.destination.iata_code ?? "",
      duration: durationText(slice.duration),
      stops: Math.max(0, slice.segments.length - 1),
      segments: slice.segments.map((s) => ({
        flight: `${s.marketing_carrier.iata_code ?? ""}${s.marketing_carrier_flight_number.replace(new RegExp(`^${s.marketing_carrier.iata_code ?? ""}`, "i"), "")}`,
        from: s.origin.iata_code ?? "",
        to: s.destination.iata_code ?? "",
        departLocal: localTime(s.departing_at),
        arriveLocal: localTime(s.arriving_at),
      })),
    })),
  };
}

/** Option names must be unique in a file, so a second fare from the same airline gets a number. */
export function labelFor(offer: DuffelOffer, taken: Iterable<string>): string {
  const base = `${offer.owner.name}${offer.slices[0]?.fare_brand_name ? ` ${offer.slices[0].fare_brand_name}` : ""}`.slice(0, 74);
  const used = new Set([...taken].map((t) => t.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) if (!used.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
}

/* ------------------------------------------------------------------- orders */

export type Traveller = {
  id: string;
  kind: string;
  title: string;
  givenNames: string;
  surname: string;
  dateOfBirth: string | null;
  nationality: string | null;
  documentNumber: string | null;
  documentExpiry: string | null;
};

const TYPE_OF_KIND: Record<string, string> = { ADULT: "adult", CHILD: "child", INFANT: "infant_without_seat" };

/** Duffel needs a gender; the form only records a title, so the title has to settle it. */
function genderAndTitle(t: Traveller): { gender: "m" | "f"; title: string } {
  const who = `${t.givenNames} ${t.surname}`;
  switch (t.title) {
    case "MR":
    case "MSTR":
      return { gender: "m", title: "mr" };
    case "MS":
      return { gender: "f", title: "ms" };
    case "MRS":
      return { gender: "f", title: "mrs" };
    case "MISS":
      return { gender: "f", title: "miss" };
    default:
      throw new DuffelInputError(`Set a title (Mr, Ms, Mrs or Miss) for ${who}. The airline needs it to record gender.`);
  }
}

/** International format, as Duffel requires. Never guesses a country code. */
export function internationalPhone(raw: string): string {
  const compact = raw.replace(/[\s().-]/g, "");
  const plus = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  if (!/^\+\d{8,15}$/.test(plus)) {
    throw new DuffelInputError("The client's phone number must include the country code, for example +250788123456, before it can be sent to the airline.");
  }
  return plus;
}

export function orderPassengers(offer: DuffelOffer, travellers: Traveller[], contact: { email: string; phone: string }) {
  if (!contact.email) throw new DuffelInputError("The airline needs an email address for the booking. Add one to the enquiry.");
  const phone = internationalPhone(contact.phone);
  const wanted = (type: string) => travellers.filter((t) => TYPE_OF_KIND[t.kind] === type).length;
  const offered = (type: string) => offer.passengers.filter((p) => p.type === type).length;
  for (const type of ["adult", "child", "infant_without_seat"]) {
    if (wanted(type) !== offered(type)) {
      throw new DuffelInputError("The travellers listed no longer match the party this fare was priced for. Search again with the right numbers.");
    }
  }

  const pool = new Map<string, string[]>();
  for (const p of offer.passengers) pool.set(p.type ?? "", [...(pool.get(p.type ?? "") ?? []), p.id]);
  const assigned = travellers.map((t) => ({ traveller: t, offerId: pool.get(TYPE_OF_KIND[t.kind] ?? "")!.shift()! }));
  const infants = assigned.filter((a) => a.traveller.kind === "INFANT");

  let adultIndex = 0;
  const passengers: DuffelOrderPassenger[] = assigned.map(({ traveller: t, offerId }) => {
    const { gender, title } = genderAndTitle(t);
    if (!t.dateOfBirth) throw new DuffelInputError(`Add a date of birth for ${t.givenNames} ${t.surname}.`);
    const p: DuffelOrderPassenger = {
      id: offerId,
      type: TYPE_OF_KIND[t.kind],
      title,
      gender,
      given_name: t.givenNames,
      family_name: t.surname,
      born_on: t.dateOfBirth,
      email: contact.email,
      phone_number: phone,
    };
    if (offer.passenger_identity_documents_required) {
      if (!t.documentNumber || !t.nationality || !t.documentExpiry) {
        throw new DuffelInputError(`${t.givenNames} ${t.surname} needs a passport number, nationality and expiry date for this airline.`);
      }
      p.identity_documents = [{ type: "passport", unique_identifier: t.documentNumber, issuing_country_code: t.nationality, expires_on: t.documentExpiry }];
    }
    // Each infant travels on a named adult's lap.
    if (t.kind === "ADULT") {
      const infant = infants[adultIndex++];
      if (infant) p.infant_passenger_id = infant.offerId;
    }
    return p;
  });
  return passengers;
}

/** Ticket numbers per traveller, matched by name because the order echoes names back, not our ids. */
export function ticketsFromOrder(order: DuffelOrder, travellers: Pick<Traveller, "id" | "givenNames" | "surname">[]) {
  const key = (a: string, b: string) => `${a}|${b}`.toUpperCase().replace(/\s+/g, " ").trim();
  const byName = new Map(travellers.map((t) => [key(t.givenNames, t.surname), t.id]));
  const out: { passengerId: string; ticketNumber: string }[] = [];
  const missing: string[] = [];
  for (const p of order.passengers ?? []) {
    const ours = byName.get(key(p.given_name ?? "", p.family_name ?? ""));
    const doc = (order.documents ?? []).find((d) => d.type === "electronic_ticket" && d.passenger_ids.includes(p.id));
    const number = doc?.unique_identifier.replace(/[\s-]/g, "");
    if (ours && number && /^\d{13}$/.test(number)) out.push({ passengerId: ours, ticketNumber: number });
    else missing.push(`${p.given_name ?? ""} ${p.family_name ?? ""}`.trim());
  }
  return { tickets: out, missing };
}
