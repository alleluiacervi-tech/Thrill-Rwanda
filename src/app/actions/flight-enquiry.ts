"use server";

import {
  flightEnquirySchema,
  todayInRwanda,
  type FlightEnquiryState,
} from "@/lib/flight-enquiry-schema";
import {
  EnquirySubmissionError,
  saveFlightEnquiry,
} from "@/lib/flight-enquiries";

export async function submitFlightEnquiry(
  _previous: FlightEnquiryState,
  form: FormData,
): Promise<FlightEnquiryState> {
  const parsed = flightEnquirySchema.safeParse({
    ...Object.fromEntries(form),
    flexible: form.get("flexible") === "on",
    consent: form.get("consent") === "on",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] ??= issue.message;
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors,
    };
  }
  if (parsed.data.departureDate < todayInRwanda())
    return {
      status: "error",
      message: "Choose a departure date that has not passed.",
      fieldErrors: { departureDate: "Choose today or a future date" },
    };
  try {
    const saved = await saveFlightEnquiry(parsed.data);
    return { status: "success", reference: saved.reference };
  } catch (error) {
    // Do not log payloads, contact details, database errors or submission tokens.
    return {
      status: "error",
      message:
        error instanceof EnquirySubmissionError
          ? error.message
          : "We could not confirm that your request was saved. Please retry this form; retries do not create duplicate requests.",
    };
  }
}
