"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { canUseEnquiries } from "@/lib/enquiry-workflow";
import type { QuoteActionState } from "@/lib/quote-rules";
import { logActivityAsCurrentUser } from "@/lib/activity";
export async function retryEnquiryNotification(
  _previous: QuoteActionState,
  form: FormData,
): Promise<QuoteActionState> {
  const caller = await requireEnquiryStaff();
  const id = z.string().uuid().safeParse(form.get("jobId"));
  if (!id.success)
    return { status: "error", message: "Invalid notification reference." };
  try {
    const reference = await db.$transaction(async (tx) => {
      const actor = await tx.user.findUnique({ where: { id: caller.id } });
      const job = await tx.notificationJob.findUnique({
        where: { id: id.data },
        include: { enquiry: true },
      });
      if (
        !actor ||
        !canUseEnquiries(actor) ||
        !job ||
        !(
          actor.role === "ADMIN" ||
          (["SALES", "OPERATIONS"].includes(actor.staffRole ?? "") &&
            job.enquiry.ownerId === actor.id)
        )
      )
        throw new Error();
      if (
        !["FAILED", "BLOCKED"].includes(job.status) ||
        job.attempts >= 5 ||
        job.lastError === "DELIVERY_REVIEW_REQUIRED" ||
        (job.firstAttemptAt &&
          Date.now() - job.firstAttemptAt.getTime() >= 23 * 3600000)
      )
        throw new Error();
      const changed = await tx.notificationJob.updateMany({
        where: { id: job.id, status: { in: ["FAILED", "BLOCKED"] } },
        data: { status: "PENDING", nextAttemptAt: new Date(), lastError: null },
      });
      if (!changed.count) throw new Error();
      await tx.enquiryActivity.create({
        data: {
          enquiryId: job.enquiryId,
          actorId: actor.id,
          kind: "NOTIFICATION_RETRY",
          changes: { jobId: job.id },
        },
      });
      return job.enquiry.reference;
    });
    for (const base of ["/staff/enquiries", "/admin/enquiries"])
      revalidatePath(`${base}/${reference}`);
    await logActivityAsCurrentUser({
      action: "notification.retry",
      area: "Enquiries",
      target: reference,
      summary: `Retried a failed notification for enquiry ${reference}`,
    });
    return {
      status: "ok",
      message: "Retry queued. Delivery is not yet confirmed.",
    };
  } catch {
    return {
      status: "error",
      message:
        "Retry is not permitted, already queued, exhausted or needs delivery review. Confirm the current state and contact an administrator; uncertain deliveries must not be blindly resent.",
    };
  }
}
