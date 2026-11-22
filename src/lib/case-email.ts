import { z } from "zod";
import { db } from "@/lib/db";
import { canUseEnquiries, isFinance } from "@/lib/enquiry-workflow";
import { renderEmail } from "@/lib/email/template";
import { buildSite } from "@/lib/site-config";

export const caseEmailInput = z.object({
  reference: z.string().min(1).max(80),
  version: z.coerce.number().int().nonnegative(),
  subject: z.string().trim().min(1).max(150).regex(/^[^\r\n]+$/),
  body: z.string().trim().min(1).max(5000),
});
export class CaseEmailError extends Error {}

export async function queueCaseEmail(actorId: string, input: z.infer<typeof caseEmailInput>) {
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({
      where: { id: actorId },
      select: { id: true, isActive: true, role: true, staffRole: true },
    });
    if (!actor || !canUseEnquiries(actor) || isFinance(actor))
      throw new CaseEmailError("Email access is restricted to the case team.");
    const where = {
      reference: input.reference,
      ...(actor.role === "ADMIN" ? {} : { ownerId: actorId }),
      version: input.version,
      replyChannel: "EMAIL",
    };
    const row = await tx.enquiry.findFirst({ where, select: { id: true, name: true, email: true } });
    if (!row?.email)
      throw new CaseEmailError("Refresh the case and check its owner and email preference before sending.");
    const claimed = await tx.enquiry.updateMany({
      where: { ...where, email: row.email }, data: { version: { increment: 1 } },
    });
    if (!claimed.count) throw new CaseEmailError("The case changed. Refresh it before sending.");
    const brand = buildSite(await tx.siteSettings.findUnique({ where: { id: 1 } }));
    const email = renderEmail({
      subject: input.subject,
      name: row.name,
      paragraphs: [input.body],
      details: [["Enquiry reference", input.reference]],
    }, brand);
    const job = await tx.notificationJob.create({
      select: { id: true },
      data: {
        enquiryId: row.id, toEmail: row.email, kind: "STAFF_EMAIL", channel: "EMAIL",
        dedupeKey: `staff-email:${row.id}:${input.version}`,
        message: { ...email, replyTo: brand.contact.email },
      },
    });
    await tx.enquiryActivity.create({
      data: {
        enquiryId: row.id, actorId, kind: "EMAIL_QUEUED", body: input.body,
        changes: { subject: input.subject, notificationId: job.id },
      },
    });
    return job.id;
  });
}
