"use server";

import {publicPreviewAllowed} from "@/lib/soft-launch";
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
  const origins = form.getAll("legOrigin");
  const destinations = form.getAll("legDestination");
  const dates = form.getAll("legDate");
  if (origins.length !== destinations.length || origins.length !== dates.length)
    return { status: "error", message: "Each flight needs two airports and a departure date." };
  const parsed = flightEnquirySchema.safeParse({
    ...Object.fromEntries(form),
    additionalLegs: origins.length ? origins.map((origin, index) => ({ origin, destination: destinations[index], departureDate: dates[index] })) : undefined,
    nonstopOnly: form.get("nonstopOnly") === "on" ? true : undefined,
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
  if (!(await publicPreviewAllowed())) return {status:"error",message:"This private preview accepts requests from invited accounts only. Sign in with your verified account."};
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
