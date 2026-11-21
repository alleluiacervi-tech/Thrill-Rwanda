"use server";

import { revalidatePath } from "next/cache";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { businessEventUpdate, BusinessEventError, updateBusinessEvent } from "@/lib/business-events";
import type { EnquiryActionState } from "@/lib/enquiry-workflow";

export async function saveBusinessEventUpdate(
  _previous: EnquiryActionState,
  form: FormData,
): Promise<EnquiryActionState> {
  const actor = await requireEnquiryStaff();
  const parsed = businessEventUpdate.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { status: "error", message: parsed.error.issues[0].message };
  try {
    const reference = await updateBusinessEvent(actor.id, parsed.data);
    for (const base of ["/admin/enquiries", "/staff/enquiries", "/account/enquiries"])
      revalidatePath(`${base}/${reference}`);
    return { status: "ok", message: "Event update saved." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof BusinessEventError ? error.message : "Could not save the event update.",
    };
  }
}
