import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { OperationsError } from "@/lib/launch-rules";
import { canUseEnquiries, enquiryScope } from "@/lib/enquiry-workflow";
import { environmentName } from "@/lib/release-rules";
export const e164 = (value: string) => {
  const phone = value.replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(phone))
    throw new OperationsError(
      "Use a verified international phone number beginning with +",
    );
  return phone;
};
export async function saveWhatsAppConsent(actorId: string, raw: unknown) {
  const input = z
    .object({
      reference: z.string().min(4).max(80),
      version: z.coerce.number().int().min(-1),
      phone: z.string().max(40),
      active: z.boolean(),
      evidence: z.string().trim().min(20).max(2000),
    })
    .parse(raw);
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (
      !actor ||
      !canUseEnquiries(actor) ||
      !(actor.role === "ADMIN" || actor.staffRole === "SALES")
    )
      throw new OperationsError("Consent administration denied");
    const e = await tx.enquiry.findFirst({
      where: { reference: input.reference, ...enquiryScope(actor) },
    });
    if (!e || (actor.role !== "ADMIN" && e.ownerId !== actorId))
      throw new OperationsError("Consent administration denied");
    const phone = e164(input.phone);
    if (input.active && phone !== e164(e.phone))
      throw new OperationsError(
        "Use this enquiry's verified phone; correct contact details through the desk before consent",
      );
    const old = await tx.whatsAppConsent.findUnique({
      where: { enquiryId: e.id },
    });
    if ((old?.version ?? -1) !== input.version)
      throw new OperationsError("Consent changed. Reload");
    await tx.whatsAppConsent.upsert({
      where: { enquiryId: e.id },
      create: {
        enquiryId: e.id,
        phone,
        active: input.active,
        evidence: input.evidence,
        actorId,
      },
      update: {
        phone,
        active: input.active,
        evidence: input.evidence,
        actorId,
        version: { increment: 1 },
      },
    });
    if (!input.active)
      await tx.notificationJob.updateMany({
        where: {
          enquiryId: e.id,
          channel: "WHATSAPP",
          status: { in: ["PENDING", "FAILED", "BLOCKED"] },
        },
        data: { status: "CANCELLED", lastError: "CONSENT_REVOKED" },
      });
    await tx.operationsAudit.create({
      data: {
        actorId,
        entityId: e.id,
        action: "WHATSAPP_CONSENT",
        evidence: input.evidence,
        changes: {
          active: input.active,
          previousVersion: old?.version ?? null,
        },
      },
    });
  });
}
export async function enqueueWhatsAppStatus(
  tx: Prisma.TransactionClient,
  enquiryId: string,
) {
  const e = await tx.enquiry.findUnique({
    where: { id: enquiryId },
    include: { whatsappConsent: true },
  });
  if (!e?.whatsappConsent?.active) return;
  const c = e.whatsappConsent;
  await tx.notificationJob.createMany({
    data: [
      {
        enquiryId,
        kind: "STATUS_UPDATE",
        channel: "WHATSAPP",
        dedupeKey: `${enquiryId}:wa:${e.version}:${c.version}`,
        message: {
          reference: e.reference,
          status: e.status,
          phone: c.phone,
          consentId: c.id,
          consentVersion: c.version,
        },
      },
    ],
    skipDuplicates: true,
  });
}
export async function whatsappApproved() {
  const record = await db.releaseRecord.findUnique({
    where: {
      environment_key: {
        environment: environmentName(),
        key: "WHATSAPP_CHANNEL",
      },
    },
  });
  return (
    process.env.WHATSAPP_ENABLED === "true" &&
    record?.state === "VERIFIED" &&
    record.reviewAt > new Date() &&
    /^\d{5,30}$/.test(process.env.WHATSAPP_PHONE_ID ?? "") &&
    !!process.env.WHATSAPP_ACCESS_TOKEN &&
    /^[a-z0-9_]+$/.test(process.env.WHATSAPP_STATUS_TEMPLATE ?? "") &&
    /^[a-z]{2}(_[A-Z]{2})?$/.test(process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "")
  );
}
export type WhatsAppMessage = {
  phone: string;
  reference: string;
  status: string;
};
export type WhatsAppTransport = (
  message: WhatsAppMessage,
) => Promise<{ providerId: string }>;
/** Meta has no send idempotency key here: uncertain outcomes must be blocked for human review. */
export const sendWhatsAppTemplate: WhatsAppTransport = async (message) => {
  if (!/^\d{5,30}$/.test(process.env.WHATSAPP_PHONE_ID ?? ""))
    throw new Error("WHATSAPP_CONFIGURATION");
  const response = await fetch(
    `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: e164(message.phone).slice(1),
        type: "template",
        template: {
          name: process.env.WHATSAPP_STATUS_TEMPLATE,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: message.reference },
                { type: "text", text: message.status.replaceAll("_", " ") },
              ],
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok)
    throw new Error(
      response.status >= 500
        ? "WHATSAPP_DELIVERY_UNCERTAIN"
        : "WHATSAPP_PROVIDER_REJECTED",
    );
  const body = (await response.json()) as { messages?: { id?: string }[] };
  const providerId = body.messages?.[0]?.id;
  if (!providerId) throw new Error("WHATSAPP_DELIVERY_UNCERTAIN");
  return { providerId };
};
