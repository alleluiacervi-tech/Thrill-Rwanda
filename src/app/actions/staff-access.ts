"use server";
import { setStaffRole } from "@/app/actions/access";
import type { EnquiryActionState } from "@/lib/enquiry-workflow";

/**
 * Kept for the existing staff-access form. Granting staff access is a super
 * admin's decision; the rules, row lock, staff-access register and activity
 * log all live in src/app/actions/access.ts.
 */
export async function setStaffAccess(
  _previous: EnquiryActionState,
  form: FormData,
): Promise<EnquiryActionState> {
  return setStaffRole({ status: "idle" }, form);
}
