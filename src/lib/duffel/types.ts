/**
 * The parts of Duffel's v2 flight API this app reads and writes.
 * Amounts are strings in the major unit ("45.00"); times are ISO 8601.
 */

export type DuffelCarrier = { id?: string; name: string; iata_code: string | null; logo_symbol_url?: string | null };

export type DuffelPlace = { iata_code: string | null; name?: string; city_name?: string | null; time_zone?: string | null };

export type DuffelSegmentPassenger = {
  passenger_id: string;
  cabin_class: string | null;
  cabin_class_marketing_name?: string | null;
  fare_basis_code?: string | null;
  baggages?: { type: "checked" | "carry_on"; quantity: number }[];
};

export type DuffelSegment = {
  id: string;
  origin: DuffelPlace;
  destination: DuffelPlace;
  departing_at: string;
  arriving_at: string;
  duration?: string | null;
  origin_terminal?: string | null;
  destination_terminal?: string | null;
  marketing_carrier: DuffelCarrier;
  operating_carrier: DuffelCarrier;
  marketing_carrier_flight_number: string;
  passengers?: DuffelSegmentPassenger[];
};

export type DuffelSlice = {
  id: string;
  origin: DuffelPlace;
  destination: DuffelPlace;
  duration?: string | null;
  fare_brand_name?: string | null;
  segments: DuffelSegment[];
};

export type DuffelCondition = { allowed: boolean; penalty_amount: string | null; penalty_currency: string | null } | null;

export type DuffelOfferPassenger = { id: string; type: string | null; age?: number | null };

export type DuffelOffer = {
  id: string;
  total_amount: string;
  total_currency: string;
  tax_amount?: string | null;
  expires_at: string;
  live_mode?: boolean;
  owner: DuffelCarrier;
  slices: DuffelSlice[];
  passengers: DuffelOfferPassenger[];
  conditions?: { change_before_departure?: DuffelCondition; refund_before_departure?: DuffelCondition } | null;
  payment_requirements?: { requires_instant_payment?: boolean; payment_required_by?: string | null; price_guarantee_expires_at?: string | null } | null;
  passenger_identity_documents_required?: boolean;
  supported_passenger_identity_document_types?: string[];
};

export type DuffelOfferRequest = {
  id: string;
  live_mode?: boolean;
  offers?: DuffelOffer[];
};

export type DuffelDocument = { type: string; unique_identifier: string; passenger_ids: string[] };

export type DuffelOrder = {
  id: string;
  booking_reference: string;
  live_mode?: boolean;
  type?: string;
  total_amount: string;
  total_currency: string;
  documents?: DuffelDocument[];
  passengers?: { id: string; given_name?: string; family_name?: string }[];
  payment_status?: { awaiting_payment?: boolean; payment_required_by?: string | null; paid_at?: string | null } | null;
  cancelled_at?: string | null;
};

export type DuffelCancellation = {
  id: string;
  order_id: string;
  refund_amount: string | null;
  refund_currency: string | null;
  refund_to?: string | null;
  expires_at?: string | null;
  confirmed_at?: string | null;
};

export type DuffelPassengerRequest = { type?: string; age?: number };

export type DuffelOrderPassenger = {
  id: string;
  type?: string;
  title: string;
  gender: "m" | "f";
  given_name: string;
  family_name: string;
  born_on: string;
  email: string;
  phone_number: string;
  identity_documents?: { type: "passport"; unique_identifier: string; issuing_country_code: string; expires_on: string }[];
  infant_passenger_id?: string;
};
