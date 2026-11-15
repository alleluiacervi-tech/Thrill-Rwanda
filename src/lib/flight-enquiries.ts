import { enqueueEnquiryNotifications } from "@/lib/enquiry-outbox";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  ENQUIRY_CONSENT_TEXT,
  ENQUIRY_CONSENT_VERSION,
  type FlightEnquiryInput,
} from "@/lib/flight-enquiry-schema";

export class EnquirySubmissionError extends Error {}
const hash = (v: string) => createHash("sha256").update(v).digest("hex");

export type CapturedEnquiry = {
  submissionKey: string;
  name: string;
  phone: string;
  email: string;
  replyChannel: string;
  details: Record<string, string | number | boolean>;
  service: string;
  source: string;
  consentVersion?: string;
  consentText?: string;
};

/** Guest leads never reserve stock or initiate payment. */
export async function saveEnquiry(input: CapturedEnquiry, actorId?: string) {
  const { submissionKey } = input;
  // Preserve fingerprints of Phase 1 flight forms that are still open during deployment.
  const payload =
    input.service === "FLIGHT" && input.source === "WEBSITE"
      ? input.details
      : input;
  const fingerprint = hash(JSON.stringify(payload));
  const contactKey = hash(
    input.phone ? input.phone.replace(/\D/g, "") : input.email.toLowerCase(),
  );
  return db.$transaction(async (tx) => {
    if (actorId) {
      const actor = await tx.user.findUnique({
        where: { id: actorId },
        select: { isActive: true, role: true, staffRole: true },
      });
      if (
        !actor?.isActive ||
        !(
          actor.role === "ADMIN" ||
          ["SALES", "OPERATIONS"].includes(actor.staffRole ?? "")
        )
      )
        throw new EnquirySubmissionError(
          "You no longer have permission to capture enquiries.",
        );
    }
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
    if (recent >= 5 && !actorId)
      throw new EnquirySubmissionError(
        "Several requests have been received for this contact. Please contact us or try again later.",
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
        service: input.service,
        source: input.source,
        name: input.name,
        phone: input.phone,
        email: input.email || null,
        replyChannel: input.replyChannel,
        consentVersion: input.consentVersion ?? ENQUIRY_CONSENT_VERSION,
        consentText: input.consentText ?? ENQUIRY_CONSENT_TEXT,
        privacyVersion: privacy?.version ?? 0,
        details: input.details,
      },
    });
    await enqueueEnquiryNotifications(tx, row);
    if (actorId)
      await tx.enquiryActivity.create({
        data: {
          enquiryId: row.id,
          actorId,
          kind: "MANUAL_CAPTURE",
          changes: { source: input.source },
          body: input.consentText,
        },
      });
    return { reference: row.reference };
  });
}

/** Backwards-compatible flight wrapper over shared durable capture. */
export async function saveFlightEnquiry(input: FlightEnquiryInput) {
  const { submissionKey, website, consent, ...payload } = input;
  void website;
  void consent;
  return saveEnquiry({
    submissionKey,
    name: input.name,
    phone: input.phone,
    email: input.email,
    replyChannel: input.replyChannel,
    details: payload,
    service: "FLIGHT",
    source: "WEBSITE",
  });
}
