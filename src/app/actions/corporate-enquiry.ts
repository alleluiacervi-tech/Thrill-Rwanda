"use server";
import { submitServiceEnquiry } from "@/app/actions/service-enquiry";
import type { FlightEnquiryState } from "@/lib/flight-enquiry-schema";
export type CorporateEnquiryState = FlightEnquiryState;
/** Legacy action name now uses durable capture and requires current consent/form fields. */
export async function submitCorporateEnquiry(
  previous: FlightEnquiryState,
  form: FormData,
) {
  return submitServiceEnquiry(previous, form);
}
