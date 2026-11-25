import {
  whatsappApproved,
  sendWhatsAppTemplate,
  type WhatsAppTransport,
} from "@/lib/whatsapp";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { renderEmail, type RenderedEmail } from "@/lib/email/template";
import { buildSite } from "@/lib/site-config";
import {
  quoteContentHash,
  renderQuoteHtml,
  renderQuoteText,
} from "@/lib/quote-render";
import type { QuoteSnapshot } from "@/lib/quote-rules";
import { canUseEnquiries } from "@/lib/enquiry-workflow";
import { emailChannel, sendViaMailbox, SmtpDeliveryError } from "@/lib/email/smtp";
import type { Prisma, NotificationJobStatus } from "@/generated/prisma/client";

export class NotificationDeliveryError extends Error {
  constructor(
    public code: string,
    public retryable: boolean,
  ) {
    super(code);
  }
}
export type OutboxEmail = RenderedEmail & { from?: string; replyTo?: string };
export type EmailTransport = (
  to: string,
  email: OutboxEmail,
  idempotencyKey: string,
) => Promise<{ providerId: string }>;
/** Fixed trusted HTTPS destination; never log credentials, content or provider error bodies. */
export const sendOutboxEmail: EmailTransport = async (
  to,
  email,
  idempotencyKey,
) => {
  // Without Resend, the business mailbox sends it (src/lib/email/smtp.ts).
  if (emailChannel() === "smtp") {
    try {
      return await sendViaMailbox({ to, subject: email.subject, html: email.html, text: email.text, replyTo: email.replyTo, key: idempotencyKey });
    } catch (error) {
      if (error instanceof SmtpDeliveryError) throw new NotificationDeliveryError(error.code, error.retryable);
      throw new NotificationDeliveryError("PROVIDER_TEMPORARY", true);
    }
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: email.from ?? process.env.EMAIL_FROM,
      to,
      subject: email.subject,
      reply_to: email.replyTo,
      html: email.html,
      text: email.text,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new NotificationDeliveryError(
      response.status === 429 || response.status >= 500
        ? "PROVIDER_TEMPORARY"
        : "PROVIDER_REJECTED",
      response.status === 429 || response.status >= 500,
    );
  const data = (await response.json()) as { id?: string };
  if (!data.id)
    throw new NotificationDeliveryError("PROVIDER_RESPONSE_INVALID", true);
  return { providerId: data.id };
};
export async function processNotificationBatch(
  options: {
    send?: EmailTransport;
    sendWhatsApp?: WhatsAppTransport;
    whatsappConfigured?: boolean;
    limit?: number;
    now?: Date;
    ids?: string[];
    emailConfigured?: boolean;
  } = {},
) {
  const now = options.now ?? new Date();
  const outcomes: { id: string; status: string }[] = [];
  for (let index = 0; index < Math.min(options.limit ?? 3, 20); index++) {
    const eligible: Prisma.NotificationJobWhereInput = {
      AND: [
        options.ids ? { id: { in: options.ids } } : {},
        {
          OR: [
            {
              status: { in: ["PENDING", "FAILED"] },
              nextAttemptAt: { lte: now },
            },
            { status: "SENDING", leaseUntil: { lt: now } },
          ],
        },
      ],
    };
    const claimed = await db.$transaction(async (tx) => {
      const candidate = await tx.notificationJob.findFirst({
        where: eligible,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      if (!candidate) return null;
      if (candidate.attempts >= 5) {
        await tx.notificationJob.updateMany({
          where: { id: candidate.id, ...eligible },
          data: {
            status: "BLOCKED",
            lastError: "ATTEMPTS_EXHAUSTED",
            leaseUntil: null,
            leaseToken: null,
          },
        });
        return null;
      }
      if (candidate.status === "SENDING")
        await tx.notificationAttempt.updateMany({
          where: { jobId: candidate.id, status: "STARTED" },
          data: {
            status: "LEASE_EXPIRED",
            errorCode: "LEASE_EXPIRED",
            completedAt: now,
          },
        });
      const leaseToken = randomUUID();
      const changed = await tx.notificationJob.updateMany({
        where: { id: candidate.id, ...eligible },
        data: {
          status: "SENDING",
          attempts: { increment: 1 },
          leaseToken,
          leaseUntil: new Date(now.getTime() + 300000),
        },
      });
      if (!changed.count) return null;
      const attempt = await tx.notificationAttempt.create({
        data: {
          jobId: candidate.id,
          number: candidate.attempts + 1,
          status: "STARTED",
          startedAt: now,
        },
      });
      return { job: candidate, leaseToken, attempt };
    });
    if (!claimed) break;
    const { job, leaseToken, attempt } = claimed;
    const finish = async (
      status: NotificationJobStatus,
      code: string | null = null,
      providerId?: string,
    ) => {
      await db.$transaction(async (tx) => {
        await tx.notificationAttempt.update({
          where: { id: attempt.id },
          data: { status, errorCode: code, completedAt: new Date() },
        });
        await tx.notificationJob.updateMany({
          where: { id: job.id, leaseToken, status: "SENDING" },
          data: {
            status,
            lastError: code,
            leaseToken: null,
            leaseUntil: null,
            ...(providerId ? { providerId } : {}),
            ...(status === "SENT" ? { sentAt: new Date() } : {}),
            nextAttemptAt: new Date(
              now.getTime() +
                Math.min(3600, 60 * 2 ** Math.min(job.attempts, 6)) * 1000,
            ),
          },
        });
      });
      outcomes.push({ id: job.id, status });
    };
    try {
      if (job.attempts >= 5) {
        await finish("BLOCKED", "ATTEMPTS_EXHAUSTED");
        continue;
      }
      const enquiry = await db.enquiry.findUnique({
        where: { id: job.enquiryId },
      });
      if (!enquiry) {
        await finish("CANCELLED", "ENQUIRY_UNAVAILABLE");
        continue;
      }
      if (job.channel === "WHATSAPP") {
        const message = job.message as {
          phone?: string;
          reference?: string;
          status?: string;
          consentId?: string;
          consentVersion?: number;
        } | null;
        const consent = await db.whatsAppConsent.findUnique({
          where: { enquiryId: enquiry.id },
        });
        if (
          !consent?.active ||
          consent.id !== message?.consentId ||
          consent.version !== message.consentVersion ||
          consent.phone !== message.phone
        ) {
          await finish("CANCELLED", "CONSENT_REVOKED");
          continue;
        }
        if (job.firstAttemptAt) {
          await finish("BLOCKED", "DELIVERY_REVIEW_REQUIRED");
          continue;
        }
        if (!(options.whatsappConfigured ?? (await whatsappApproved()))) {
          await finish("BLOCKED", "WHATSAPP_NOT_APPROVED");
          continue;
        }
        if (
          message.reference !== enquiry.reference ||
          message.status !== enquiry.status
        ) {
          await finish("CANCELLED", "STATUS_SUPERSEDED");
          continue;
        }
        const recorded = await db.notificationJob.updateMany({
          where: { id: job.id, leaseToken, status: "SENDING" },
          data: { firstAttemptAt: now },
        });
        if (!recorded.count) continue;
        try {
          const sent = await (options.sendWhatsApp ?? sendWhatsAppTemplate)({
            phone: consent.phone,
            reference: enquiry.reference,
            status: enquiry.status,
          });
          await finish("SENT", null, sent.providerId);
        } catch {
          await finish("BLOCKED", "DELIVERY_REVIEW_REQUIRED");
        }
        continue;
      }
      if (job.channel === "IN_APP") {
        const recipient = job.recipientId
          ? await db.user.findUnique({ where: { id: job.recipientId } })
          : null;
        if (
          !recipient ||
          !canUseEnquiries(recipient) ||
          (recipient.role !== "ADMIN" &&
            (recipient.id !== enquiry.ownerId ||
              recipient.staffRole === "FINANCE"))
        ) {
          await finish("CANCELLED", "RECIPIENT_ACCESS_REVOKED");
          continue;
        }
        await db.notification.upsert({
          where: { id: job.id },
          update: {},
          create: {
            id: job.id,
            userId: recipient.id,
            type: "enquiry.received",
            title:
              job.kind === "STAFF_ASSIGNED"
                ? "Enquiry assigned to you"
                : "New enquiry",
            body: `Enquiry ${enquiry.reference} is available in your secure workspace.`,
            href: `/staff/enquiries/${enquiry.reference}`,
            channel: "in_app",
          },
        });
        await finish("SENT");
        continue;
      }
      if (
        !job.toEmail ||
        enquiry.email !== job.toEmail ||
        enquiry.replyChannel !== "EMAIL"
      ) {
        await finish("CANCELLED", "CHANNEL_NOT_APPROVED");
        continue;
      }
      if (
        job.firstAttemptAt &&
        now.getTime() - job.firstAttemptAt.getTime() >= 23 * 3600000
      ) {
        await finish("BLOCKED", "DELIVERY_REVIEW_REQUIRED");
        continue;
      }
      let email: OutboxEmail;
      if (job.kind === "QUOTE_ISSUED") {
        const quote = job.quoteId
          ? await db.quoteVersion.findUnique({ where: { id: job.quoteId } })
          : null;
        const latest = await db.quoteVersion.findFirst({
          where: { enquiryId: enquiry.id },
          orderBy: { number: "desc" },
        });
        if (
          !quote ||
          latest?.id !== quote.id ||
          quote.expiresAt <= now ||
          quote.paymentDeadline <= now
        ) {
          await finish("CANCELLED", "QUOTE_EXPIRED_OR_SUPERSEDED");
          continue;
        }
        const snapshot = quote.snapshot as QuoteSnapshot;
        if (quoteContentHash(snapshot) !== quote.contentHash) {
          await finish("BLOCKED", "QUOTE_INTEGRITY_FAILED");
          continue;
        }
        email = {
          subject: `Quotation ${enquiry.reference} · v${quote.number}`,
          html: renderQuoteHtml(snapshot),
          text: renderQuoteText(snapshot),
        };
      } else if (job.kind === "STAFF_EMAIL") {
        const saved = job.message as Partial<OutboxEmail> | null;
        if (!saved || typeof saved.subject !== "string" || typeof saved.html !== "string" || typeof saved.text !== "string") {
          await finish("BLOCKED", "MESSAGE_CONTENT_MISSING");
          continue;
        }
        email = { subject: saved.subject, html: saved.html, text: saved.text };
      } else if (job.kind === "CUSTOMER_ACK") {
        email = renderEmail(
          {
            subject: `Your enquiry ${enquiry.reference} is saved`,
            heading: "Your request is saved",
            paragraphs: [
              `Keep enquiry reference ${enquiry.reference} when contacting us.`,
              "This is an enquiry, not a booking or a fare hold. Our team must check options before providing a written quotation. No ticket has been issued and no payment has been taken.",
            ],
          },
          buildSite(await db.siteSettings.findUnique({ where: { id: 1 } })),
        );
      } else {
        await finish("BLOCKED", "UNKNOWN_NOTIFICATION_KIND");
        continue;
      }
      // Freeze exact email bytes before contacting the provider: retries keep the same payload.
      if (
        job.message &&
        typeof job.message === "object" &&
        !Array.isArray(job.message)
      ) {
        email = job.message as OutboxEmail;
      } else {
        await db.notificationJob.updateMany({
          where: { id: job.id, leaseToken },
          data: { message: email },
        });
      }
      if (!email.from && process.env.EMAIL_FROM) {
        email = { ...email, from: process.env.EMAIL_FROM };
        await db.notificationJob.updateMany({
          where: { id: job.id, leaseToken },
          data: { message: email },
        });
      }
      if (!(
        options.emailConfigured ??
        (!!options.send || emailChannel() !== null)
      )) {
        await finish("BLOCKED", "EMAIL_CONFIGURATION_MISSING");
        continue;
      }
      if (!job.firstAttemptAt)
        await db.notificationJob.updateMany({
          where: { id: job.id, leaseToken },
          data: { firstAttemptAt: now },
        });
      const sent = await (options.send ?? sendOutboxEmail)(
        job.toEmail,
        email,
        `enquiry-${job.id}`,
      );
      await finish("SENT", null, sent.providerId);
    } catch (error) {
      const code =
        error instanceof NotificationDeliveryError
          ? error.code
          : "DELIVERY_TEMPORARY";
      const retryable =
        !(error instanceof NotificationDeliveryError) || error.retryable;
      await finish(
        retryable && job.attempts + 1 < 5 ? "FAILED" : "BLOCKED",
        retryable && job.attempts + 1 >= 5 ? "ATTEMPTS_EXHAUSTED" : code,
      );
    }
  }
  return outcomes;
}
