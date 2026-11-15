import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import {
  operationsNow,
  environmentChecks,
  environmentName,
  RELEASE_KEYS,
  releaseEvidenceComplete,
} from "@/lib/release-rules";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { OperationsForm } from "@/components/dashboard/operations-form";
export default async function Page() {
  await requireAdmin();
  const now = operationsNow();
  const environment = environmentName(),
    [records, workers, blocked, failed, overdueDocs] = await Promise.all([
      db.releaseRecord.findMany({ where: { environment } }),
      db.workerHeartbeat.findMany(),
      db.notificationJob.count({ where: { status: "BLOCKED" } }),
      db.notificationJob.count({ where: { status: "FAILED" } }),
      db.bookingDocument.count({
        where: {
          legalHoldReason: null,
          OR: [
            { expiresAt: { lt: new Date() } },
            {
              expiresAt: null,
              uploadedAt: { lt: new Date(now.getTime() - 30 * 86400000) },
            },
          ],
        },
      }),
    ]);
  const checks = environmentChecks();
  return (
    <>
      <DashboardHead
        title="Release readiness & handover"
        lede={`Environment: ${environment}. Evidence completeness does not publish, deploy, activate channels or verify an external account automatically.`}
      />
      <p className="my-5 text-xl">
        {releaseEvidenceComplete(records) && checks.every((c) => c.ok)
          ? "Configured checks and required evidence are complete; follow the documented release procedure."
          : "Release prerequisites remain open."}
      </p>
      <h2 className="text-2xl">Configuration checks</h2>
      <ul className="my-5 space-y-2">
        {checks.map((c) => (
          <li key={c.key}>
            {c.ok ? "PASS" : "CHECK"} · {c.detail}
          </li>
        ))}
      </ul>
      <h2 className="text-2xl">Current operations</h2>
      <p className="my-4">
        Blocked delivery jobs: {blocked} · Failed jobs: {failed} · Expired
        document candidates not held: {overdueDocs}
      </p>
      <ul>
        {workers.map((w) => (
          <li key={w.name} className="my-3">
            {w.name} · last success{" "}
            {w.succeededAt?.toISOString() ?? "Never observed"} · processed{" "}
            {w.processed} · {w.errorCode ?? "No recorded error"}
            {!w.succeededAt ||
            now.getTime() - w.succeededAt.getTime() > 86400000
              ? " · Check scheduler freshness"
              : ""}
          </li>
        ))}
      </ul>
      <h2 className="mt-8 text-2xl">
        Owners, accounts, costs and approval evidence
      </h2>
      <p>
        Use evidence references and company owners only. Never enter
        credentials, API tokens, private keys or identity documents. Record
        recurring cost and renewal when applicable. Required gates must be
        Verified and reviewed before expiry; optional WhatsApp may remain Not
        applicable.
      </p>
      {RELEASE_KEYS.map((key) => {
        const r = records.find((r) => r.key === key);
        const local = (date: Date | null | undefined) =>
          date
            ? new Date(date.getTime() + 7200000).toISOString().slice(0, 16)
            : "";
        return (
          <OperationsForm
            key={`${key}-${r?.version}`}
            title={`${key.replaceAll("_", " ")} · ${r?.state ?? "PENDING"}`}
            hidden={{
              command: "RELEASE_RECORD",
              key,
              version: r?.version ?? -1,
            }}
            fields={[
              {
                name: "owner",
                label: "Company operational owner",
                value: r?.owner,
                required: true,
              },
              {
                name: "state",
                label: "Evidence status",
                value: r?.state ?? "PENDING",
                options: ["PENDING", "VERIFIED", "NOT_APPLICABLE"].map(
                  (value) => ({ value, label: value }),
                ),
              },
              {
                name: "evidence",
                label: "Approval, test, account ownership or handover evidence",
                type: "textarea",
                value: r?.evidence,
                required: true,
              },
              {
                name: "reviewAt",
                label: "Review due (Kigali UTC+2)",
                type: "datetime-local",
                value: local(r?.reviewAt),
                required: true,
              },
              {
                name: "cost",
                label: "Recurring cost, optional",
                value:
                  r?.costMinor == null
                    ? ""
                    : String(r.costMinor / (r.currency === "RWF" ? 1 : 100)),
              },
              {
                name: "currency",
                label: "Cost currency",
                value: r?.currency ?? "",
                options: ["", "USD", "EUR", "GBP", "RWF"].map((value) => ({
                  value,
                  label: value || "Not recorded",
                })),
              },
              {
                name: "renewalAt",
                label: "Renewal time, optional (Kigali)",
                type: "datetime-local",
                value: local(r?.renewalAt),
              },
            ]}
          />
        );
      })}
    </>
  );
}
