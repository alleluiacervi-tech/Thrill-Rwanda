import { db } from "@/lib/db";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import {
  operationsNow,
  environmentChecks,
  environmentName,
  RELEASE_KEYS,
  REQUIRED_RELEASE_KEYS,
} from "@/lib/release-rules";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { OperationsForm } from "@/components/dashboard/operations-form";

const configHelp: Record<string, { title: string; action: string }> = {
  environment: { title: "Environment label", action: "Set APP_ENV in the host to the intended environment." },
  site_origin: { title: "Website and sign-in address", action: "Set NEXT_PUBLIC_SITE_URL and BETTER_AUTH_URL to the active HTTPS domain." },
  database: { title: "Web and migration databases", action: "Check that DATABASE_URL and DIRECT_URL identify the same hosted database branch. Match the branch in Neon before running migrations." },
  auth_secret: { title: "Sign-in secret", action: "Set a dedicated BETTER_AUTH_SECRET in the host." },
  cron_secret: { title: "Scheduled job secret", action: "Set a dedicated CRON_SECRET in the host and check the scheduler." },
  database_tls: { title: "Encrypted database connection", action: "Use the provider’s encrypted PostgreSQL URL." },
  private_storage: { title: "Listing image uploads", action: "Connect Cloudinary or R2 to enable file uploads. Listing forms also accept image URLs." },
  email_sender: { title: "Email delivery", action: "Configure Resend and a verified sender, then test delivery with an approved inbox." },
  backup_key: { title: "Encrypted backups", action: "Configure a separate backup key and verify a restore in an isolated database." },
  payment_mode: { title: "Payment activation", action: "Approve the merchant agreement and verify UrubutoPay collection and settlement before activating live routing." },
};

const title = (key: string) => key.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
const stamp = (date: Date) => date.toLocaleString("en-GB", { timeZone: "Africa/Kigali" });

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
  const openChecks = checks.filter((check) => !check.ok);
  const verified = new Set(records.filter((record) => record.state === "VERIFIED" && record.reviewAt > now).map((record) => record.key));
  const outstanding = REQUIRED_RELEASE_KEYS.filter((key) => !verified.has(key));
  return (
    <>
      <DashboardHead
        title="Launch checklist"
        lede={`Environment shown by the app: ${environment}. Use this checklist to review the hosting setup and record company approvals before a public launch.`}
      />
      <div className="my-6 grid gap-4 sm:grid-cols-2">
        <a href="#configuration" className="rounded-xl border border-[var(--line)] p-4">
          <strong>{openChecks.length} setup {openChecks.length === 1 ? "check needs" : "checks need"} attention</strong>
          <span className="mt-1 block text-sm">Hosting, email, uploads and backups</span>
        </a>
        <a href="#approvals" className="rounded-xl border border-[var(--line)] p-4">
          <strong>{outstanding.length} of {REQUIRED_RELEASE_KEYS.length} approvals outstanding</strong>
          <span className="mt-1 block text-sm">Company owners record evidence and review dates here.</span>
        </a>
      </div>
      <p className="my-5 text-sm">
        For day-to-day work, open <Link href="/admin/enquiries" className="underline">Enquiries</Link> or{" "}
        <Link href="/admin/listings" className="underline">Listings</Link>. To change what travelers see, use{" "}
        <Link href="/admin/launch" className="underline">Launch controls</Link>.
      </p>
      <section id="configuration" className="scroll-mt-24">
        <h2 className="text-2xl">Setup that needs attention</h2>
        {openChecks.length ? (
          <ul className="my-4 space-y-3">
            {openChecks.map((check) => (
              <li key={check.key} className="rounded-xl border border-[var(--line)] p-4">
                <strong>{configHelp[check.key]?.title ?? title(check.key)}</strong>
                <p className="mt-1 text-sm">{configHelp[check.key]?.action ?? check.detail}</p>
              </li>
            ))}
          </ul>
        ) : <p className="my-4">All configuration checks passed.</p>}
        <details className="my-5 rounded-xl border border-[var(--line)] p-4">
          <summary className="cursor-pointer font-semibold">Checks that passed ({checks.length - openChecks.length})</summary>
          <ul className="mt-3 space-y-2 text-sm">
            {checks.filter((check) => check.ok).map((check) => <li key={check.key}>{check.detail}</li>)}
          </ul>
        </details>
      </section>
      <h2 className="text-2xl">Scheduled jobs and delivery</h2>
      <p className="my-4">
        Blocked delivery jobs: {blocked} · Failed jobs: {failed} · Expired
        document candidates not held: {overdueDocs}
      </p>
      <ul>
        {workers.map((w) => (
          <li key={w.name} className="my-3">
            {w.name} · last success{" "}
            {w.succeededAt ? `${stamp(w.succeededAt)} Kigali` : "No successful run recorded"} · processed{" "}
            {w.processed} · {w.errorCode ?? "No recorded error"}
            {!w.succeededAt ||
            now.getTime() - w.succeededAt.getTime() > 86400000
              ? " · Check scheduler freshness"
              : ""}
          </li>
        ))}
      </ul>
      <h2 id="approvals" className="mt-8 scroll-mt-24 text-2xl">Company approvals</h2>
      <p className="mt-2">
        Mark an item verified after the responsible person has checked it. Record the owner,
        a ticket or approval reference, and a review date. Keep passwords, keys and identity documents out of this page.
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
            title={`${title(key)} · ${verified.has(key) ? "Verified" : r?.state === "VERIFIED" ? "Review due" : r?.state === "NOT_APPLICABLE" ? "Not applicable" : "Pending"}`}
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
                options: (key === "WHATSAPP_CHANNEL"
                  ? ["PENDING", "VERIFIED", "NOT_APPLICABLE"]
                  : ["PENDING", "VERIFIED"]).map(
                  (value) => ({ value, label: title(value) }),
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
