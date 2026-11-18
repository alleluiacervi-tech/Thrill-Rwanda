"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { TEMPLATE_BY_KEY } from "@/lib/email/templates";
import { requireAdmin } from "@/lib/session";
import { logActivity, logActivityAsCurrentUser } from "@/lib/activity";

/**
 * Editing the wording of a customer email.
 *
 * Deleting the row restores the built-in copy, which is why "reset" is a
 * delete rather than writing the default back in: the shipped wording can
 * then improve over time without an admin's old copy pinning it.
 */

export type EmailTemplateState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "saved" }
  | { status: "reset" };

const schema = z.object({
  key: z.string().trim().min(3).max(60),
  subject: z.string().trim().min(3, "Give the email a subject").max(200),
  body: z.string().trim().min(20, "The email needs a message").max(20_000),
  ctaLabel: z.string().trim().max(60).optional().or(z.literal("")),
});

export async function saveEmailTemplate(
  _prev: EmailTemplateState,
  formData: FormData,
): Promise<EmailTemplateState> {
  const admin = await requireAdmin();

  const parsed = schema.safeParse({
    key: formData.get("key"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    ctaLabel: formData.get("ctaLabel") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check those details." };
  }

  const { key, subject, body, ctaLabel } = parsed.data;
  if (!TEMPLATE_BY_KEY.has(key as never)) {
    return { status: "error", message: "That email doesn't exist." };
  }

  await db.emailTemplate.upsert({
    where: { key },
    update: { subject, body, ctaLabel: ctaLabel || null, updatedBy: admin.id },
    create: { key, subject, body, ctaLabel: ctaLabel || null, updatedBy: admin.id },
  });

  revalidatePath("/admin/emails");
  await logActivity(admin.id, {
    action: "email_template.save",
    area: "Content",
    target: String(formData.get("key") ?? "email template"),
    summary: `Edited the ${String(formData.get("key") ?? "")} email template`,
  });
  return { status: "saved" };
}

export async function resetEmailTemplate(
  _prev: EmailTemplateState,
  formData: FormData,
): Promise<EmailTemplateState> {
  await requireAdmin();

  const key = String(formData.get("key") ?? "");
  if (!TEMPLATE_BY_KEY.has(key as never)) {
    return { status: "error", message: "That email doesn't exist." };
  }

  await db.emailTemplate.deleteMany({ where: { key } });

  await logActivityAsCurrentUser({
    action: "email_template.reset",
    area: "Content",
    target: String(formData.get("key") ?? "email template"),
    summary: `Reset the ${String(formData.get("key") ?? "")} email template to its default`,
  });
  revalidatePath("/admin/emails");
  return { status: "reset" };
}
