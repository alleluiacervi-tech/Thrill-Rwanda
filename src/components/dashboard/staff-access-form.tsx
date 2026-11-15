"use client";
import { useActionState } from "react";
import { setStaffAccess } from "@/app/actions/staff-access";
import type { EnquiryActionState } from "@/lib/enquiry-workflow";
export function StaffAccessForm({
  userId,
  current,
}: {
  userId: string;
  current: string | null;
}) {
  const [state, action, pending] = useActionState(setStaffAccess, {
    status: "idle",
  } as EnquiryActionState);
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="block text-xs">
        Staff permission
        <select
          className="mt-1 block rounded border p-1"
          name="staffRole"
          defaultValue={current ?? ""}
        >
          <option value="">No staff access</option>
          <option value="SALES">Sales</option>
          <option value="OPERATIONS">Operations</option>
          <option value="FINANCE">Finance</option>
        </select>
      </label>
      <button type="submit" disabled={pending} className="text-xs underline">
        {pending ? "Saving…" : "Save staff access"}
      </button>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className="max-w-48 text-xs"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
