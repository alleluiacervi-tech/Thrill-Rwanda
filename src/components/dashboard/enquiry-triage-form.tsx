"use client";
import { useActionState } from "react";
import { saveEnquiryTriage } from "@/app/actions/enquiry-triage";
import { Button } from "@/components/ui/button";
import { label, type EnquiryActionState } from "@/lib/enquiry-workflow";
const field =
  "mt-2 w-full rounded-xl border border-[var(--line-strong)] bg-[var(--paper-raised)] p-3";
export function EnquiryTriageForm({
  reference,
  version,
  status,
  ownerId,
  actorId,
  admin,
  finance,
  followUp,
  owners,
  transitions,
}: {
  reference: string;
  version: number;
  status: string;
  ownerId: string | null;
  actorId: string;
  admin: boolean;
  finance: boolean;
  followUp: string;
  owners: { id: string; fullName: string }[];
  transitions: string[];
}) {
  const [state, action, pending] = useActionState(saveEnquiryTriage, {
    status: "idle",
  } as EnquiryActionState);
  return (
    <form
      action={action}
      onReset={(e) => e.preventDefault()}
      className="mt-8 space-y-5 rounded-xl border border-[var(--line)] p-5"
    >
      <h2 className="text-xl">Update enquiry</h2>
      <p className="text-sm">
        Milestones require a supporting reference or evidence. These records do
        not issue quotes, reconcile money or create bookings automatically.
      </p>
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="version" value={version} />
      {state.message && (
        <p role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      )}
      <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
        <label>
          Status
          <select name="status" className={field} defaultValue={status}>
            <option value={status}>{label(status)}</option>
            {transitions.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>
        {!finance && (
          <>
            <label>
              Owner
              {admin ? (
                <select
                  name="ownerId"
                  className={field}
                  defaultValue={ownerId ?? ""}
                >
                  <option value="">Unassigned</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.fullName}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input type="hidden" name="ownerId" value={actorId} />
                  <span className="mt-3 block">
                    {ownerId
                      ? "Assigned to you"
                      : "Saving will claim this enquiry for you"}
                  </span>
                </>
              )}
            </label>
            <label>
              Next follow-up (Kigali, UTC+2)
              <input
                name="followUp"
                type="datetime-local"
                defaultValue={followUp}
                className={field}
              />
            </label>
            <label>
              Internal note
              <textarea
                name="note"
                rows={3}
                maxLength={2000}
                className={field}
              />
            </label>
          </>
        )}
        <label>
          Outcome reason (required for lost, cancelled or refunded)
          <textarea name="reason" maxLength={1000} className={field} />
        </label>
        <label>
          Milestone evidence
          <textarea
            name="evidence"
            maxLength={2000}
            rows={3}
            className={field}
            placeholder="Quote version and expiry; acceptance; reconciled payment reference; verified supplier confirmation; or refund evidence. Do not paste identity documents or card details."
          />
        </label>
      </fieldset>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save enquiry"}
      </Button>
    </form>
  );
}
