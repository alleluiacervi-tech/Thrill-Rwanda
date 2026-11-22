"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { processNotificationBatch } from "@/lib/notification-worker";
import { caseEmailInput, CaseEmailError, queueCaseEmail } from "@/lib/case-email";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import type { EnquiryActionState } from "@/lib/enquiry-workflow";

export async function sendCaseEmail(_previous: EnquiryActionState, form: FormData): Promise<EnquiryActionState> {
  const actor = await requireEnquiryStaff();
  const parsed = caseEmailInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "Enter a subject and a message of up to 5,000 characters." };
  try {
    const jobId = await queueCaseEmail(actor.id, parsed.data);
    after(async () => {
      await processNotificationBatch({ ids: [jobId], limit: 1 });
    });
  } catch (error) {
    return { status: "error", message: error instanceof CaseEmailError ? error.message : "Email could not be queued. Check the activity timeline before retrying." };
  }
  for (const base of ["/staff/enquiries", "/admin/enquiries"])
    revalidatePath(`${base}/${parsed.data.reference}`);
  return { status: "ok", message: "Email queued. Track its progress under Notification delivery." };
}
