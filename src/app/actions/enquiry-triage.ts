"use server";
import { revalidatePath } from "next/cache";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { triageSchema, type EnquiryActionState } from "@/lib/enquiry-workflow";
import { EnquiryWorkflowError, updateEnquiry } from "@/lib/enquiry-triage";
import { logActivity } from "@/lib/activity";

export async function saveEnquiryTriage(
  _previous: EnquiryActionState,
  form: FormData,
): Promise<EnquiryActionState> {
  const actor = await requireEnquiryStaff();
  const parsed = triageSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      status: "error",
      message: "Check the status, follow-up and note fields.",
    };
  try {
    const reference = await updateEnquiry(actor.id, parsed.data);
    await logActivity(actor.id, {
      action: "enquiry.update",
      area: "Enquiries",
      target: reference,
      summary: `Updated enquiry ${reference}: status ${parsed.data.status.toLowerCase().replaceAll("_", " ")}${parsed.data.note ? ", with a note" : ""}`,
      changes: { status: parsed.data.status, ownerId: parsed.data.ownerId || null, followUp: parsed.data.followUp || null } as never,
    });
    for (const base of ["/admin/enquiries", "/staff/enquiries"]) {
      revalidatePath(base);
      revalidatePath(`${base}/${reference}`);
    }
    return { status: "ok", message: "Enquiry updated and activity recorded." };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof EnquiryWorkflowError
          ? error.message
          : "Could not save. Reload to check the latest record before retrying.",
    };
  }
}
