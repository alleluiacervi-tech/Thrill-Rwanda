"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { saveEnquiry, EnquirySubmissionError } from "@/lib/flight-enquiries";
import { serviceEnquirySchema } from "@/lib/service-enquiry-schema";
import {
  todayInRwanda,
  type FlightEnquiryState,
} from "@/lib/flight-enquiry-schema";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { isFinance, SOURCES } from "@/lib/enquiry-workflow";

async function capture(
  form: FormData,
  manual = false,
): Promise<FlightEnquiryState> {
  const actor = manual ? await requireEnquiryStaff() : null;
  if (actor && isFinance(actor))
    return {
      status: "error",
      message: "Finance cannot create or edit customer enquiries.",
    };
  const parsed = serviceEnquirySchema.safeParse({
    ...Object.fromEntries(form),
    consent: form.get("consent") === "on",
    flexible: form.get("flexible") === "on",
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
  const input = parsed.data;
  if (!manual && input.startDate && input.startDate < todayInRwanda())
    return {
      status: "error",
      message: "Choose a date that has not passed.",
      fieldErrors: { startDate: "Choose today or a future date" },
    };
  const source = manual
    ? z.enum(SOURCES).safeParse(form.get("source"))
    : { success: true as const, data: "WEBSITE" };
  const permission = String(form.get("permissionEvidence") ?? "").trim();
  if (
    !source.success ||
    (manual && (permission.length < 10 || permission.length > 1000))
  )
    return {
      status: "error",
      message:
        "Choose a lead source and record how permission to contact was obtained (10–1000 characters).",
    };
  const {
    submissionKey,
    consent,
    website,
    name,
    phone,
    email,
    replyChannel,
    ...details
  } = input;
  void consent;
  void website;
  try {
    const result = await saveEnquiry(
      {
        submissionKey,
        name,
        phone,
        email,
        replyChannel,
        service: input.service,
        source: source.data,
        details,
        consentVersion: manual ? "staff-recorded-v1" : "service-enquiry-v1",
        consentText: manual
          ? permission
          : "I have read the privacy notice and agree to be contacted about this request.",
      },
      actor?.id,
    );
    if (manual) {
      revalidatePath("/staff/enquiries");
      revalidatePath("/admin/enquiries");
    }
    return { status: "success", reference: result.reference };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof EnquirySubmissionError
          ? error.message
          : "We could not confirm your request was saved. Retry this form; retries do not create duplicate requests.",
    };
  }
}
export async function submitServiceEnquiry(
  _previous: FlightEnquiryState,
  form: FormData,
) {
  return capture(form);
}
export async function captureManualEnquiry(
  _previous: FlightEnquiryState,
  form: FormData,
) {
  return capture(form, true);
}
