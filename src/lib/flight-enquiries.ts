import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  ENQUIRY_CONSENT_TEXT,
  ENQUIRY_CONSENT_VERSION,
  type FlightEnquiryInput,
} from "@/lib/flight-enquiry-schema";

export class EnquirySubmissionError extends Error {}
const hash = (v: string) => createHash("sha256").update(v).digest("hex");

/** Separate from Booking: guest leads never reserve stock or initiate payment. */
export async function saveFlightEnquiry(input: FlightEnquiryInput) {
  const {
    submissionKey,
    website: _website,
    consent: _consent,
    ...payload
  } = input;
  void _website;
  void _consent;
  const fingerprint = hash(JSON.stringify(payload));
  const contactKey = hash(input.phone.replace(/\D/g, ""));
  return db.$transaction(async (tx) => {
    // Serialize retries of the same token, then submissions for the same contact.
    // Locks live in PostgreSQL, so they also work across application instances.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${submissionKey}, 0))`;
    const previous = await tx.enquiry.findUnique({ where: { submissionKey } });
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new EnquirySubmissionError(
          "This form has already been submitted with different details. Reload to start a new request.",
        );
      return { reference: previous.reference };
    }
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${contactKey}, 1))`;
    const recent = await tx.enquiry.count({
      where: {
        contactKey,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });
    if (recent >= 5)
      throw new EnquirySubmissionError(
        "Several requests have been received for this number. Please contact us or try again later.",
      );
    const privacy = await tx.legalDocument.findUnique({
      where: { slug: "privacy" },
      select: { version: true },
    });
    const row = await tx.enquiry.create({
      data: {
        submissionKey,
        fingerprint,
        contactKey,
        reference: `TRQ-${randomUUID()}`,
        name: input.name,
        phone: input.phone,
        email: input.email || null,
        replyChannel: input.replyChannel,
        consentVersion: ENQUIRY_CONSENT_VERSION,
        consentText: ENQUIRY_CONSENT_TEXT,
        privacyVersion: privacy?.version ?? 0,
        details: payload,
      },
    });
    return { reference: row.reference };
  });
}
