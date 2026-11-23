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
import { Panel, StatGrid, StatTile, StatusPill } from "@/components/dashboard/dash-ui";
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
  const doneApprovals = REQUIRED_RELEASE_KEYS.length - outstanding.length;
  const readyPct = Math.round((doneApprovals / Math.max(1, REQUIRED_RELEASE_KEYS.length)) * 100);
  const stale = (w: (typeof workers)[number]) => !w.succeededAt || now.getTime() - w.succeededAt.getTime() > 86400000;
  const stateOf = (key: string) => {
    const r = records.find((x) => x.key === key);
    return verified.has(key) ? { tone: "good" as const, text: "Verified" }
      : r?.state === "VERIFIED" ? { tone: "warn" as const, text: "Review due" }
      : r?.state === "NOT_APPLICABLE" ? { tone: "neutral" as const, text: "Not applicable" }
      : { tone: "alert" as const, text: "Pending" };
  };
  return (
    <>
      <DashboardHead
        title="Launch readiness"
        lede={`Environment: ${environment}. Hosting checks and company approvals to clear before going public.`}
        action={<Link href="/admin/launch" className="text-sm font-medium text-lake-700 hover:underline">Launch controls →</Link>}
      />
      <Panel className="mb-6">
        <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Approvals complete</p>
            <p className="tnum mt-2 font-display text-5xl leading-none">{readyPct}%</p>
          </div>
          <div className="min-w-[14rem] flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-[var(--paper-sunken)]">
              <div className="h-full rounded-full bg-forest-700" style={{ width: `${readyPct}%` }} />
            </div>
            <p className="mt-2 text-xs text-[var(--ink-muted)]">
              {doneApprovals} of {REQUIRED_RELEASE_KEYS.length} required approvals verified
            </p>
          </div>
        </div>
      </Panel>
      <StatGrid>
        <StatTile label="Setup checks open" value={openChecks.length} tone={openChecks.length ? "alert" : "good"} href="#configuration" />
        <StatTile label="Blocked emails" value={blocked} tone={blocked ? "alert" : "good"} />
        <StatTile label="Failed jobs" value={failed} tone={failed ? "alert" : "good"} />
        <StatTile label="Documents to review" value={overdueDocs} note="expired, not held" />
      </StatGrid>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Setup"
          description={openChecks.length ? "Needs attention before launch." : "Every configuration check passed."}
          aside={<StatusPill tone={openChecks.length ? "alert" : "good"}>{openChecks.length ? `${openChecks.length} open` : "All clear"}</StatusPill>}
          className="scroll-mt-24"
        >
          <div id="configuration" />
          <ul className="grid gap-3">
            {openChecks.map((check) => (
              <li key={check.key} className="border-b border-[var(--line)] pb-3 last:border-0 last:pb-0">
                <p className="text-sm font-medium">{configHelp[check.key]?.title ?? title(check.key)}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">{configHelp[check.key]?.action ?? check.detail}</p>
              </li>
            ))}
          </ul>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium text-[var(--ink-muted)]">Passed ({checks.length - openChecks.length})</summary>
            <ul className="mt-3 grid gap-1.5 text-xs text-[var(--ink-muted)]">
              {checks.filter((check) => check.ok).map((check) => <li key={check.key}>{check.detail}</li>)}
            </ul>
          </details>
        </Panel>
        <Panel title="Scheduled jobs" description="Last successful run of each worker.">
          {workers.length ? (
            <ul className="grid gap-3">
              {workers.map((w) => (
                <li key={w.name} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">{w.name}</span>
                    <span className="block text-xs text-[var(--ink-muted)]">
                      {w.succeededAt ? stamp(w.succeededAt) : "No successful run"} · {w.processed} processed
                      {w.errorCode ? ` · ${w.errorCode}` : ""}
                    </span>
                  </span>
                  <StatusPill tone={stale(w) ? "alert" : "good"}>{stale(w) ? "Stale" : "Healthy"}</StatusPill>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--ink-muted)]">No scheduled job has reported yet.</p>
          )}
        </Panel>
      </div>

      <section id="approvals" className="mt-8 scroll-mt-24">
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Company approvals</h2>
          <p className="mt-1 max-w-2xl text-xs text-[var(--ink-muted)]">
            Verify after the responsible person has checked it. Record owner, reference and review date. Keep passwords, keys and ID documents out of here.
          </p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] px-5">
          {RELEASE_KEYS.map((key) => {
            const r = records.find((r) => r.key === key);
            const state = stateOf(key);
            const local = (date: Date | null | undefined) =>
              date ? new Date(date.getTime() + 7200000).toISOString().slice(0, 16) : "";
            return (
              <OperationsForm
                key={`${key}-${r?.version}`}
                title={`${title(key)}  ·  ${state.text}`}
                hidden={{ command: "RELEASE_RECORD", key, version: r?.version ?? -1 }}
                fields={[
                  { name: "owner", label: "Company operational owner", value: r?.owner, required: true },
                  {
                    name: "state",
                    label: "Evidence status",
                    value: r?.state ?? "PENDING",
                    options: (key === "WHATSAPP_CHANNEL" ? ["PENDING", "VERIFIED", "NOT_APPLICABLE"] : ["PENDING", "VERIFIED"]).map(
                      (value) => ({ value, label: title(value) }),
                    ),
                  },
                  { name: "evidence", label: "Approval, test, account ownership or handover evidence", type: "textarea", value: r?.evidence, required: true },
                  { name: "reviewAt", label: "Review due (Kigali UTC+2)", type: "datetime-local", value: local(r?.reviewAt), required: true },
                  { name: "cost", label: "Recurring cost, optional", value: r?.costMinor == null ? "" : String(r.costMinor / (r.currency === "RWF" ? 1 : 100)) },
                  {
                    name: "currency",
                    label: "Cost currency",
                    value: r?.currency ?? "",
                    options: ["", "USD", "EUR", "GBP", "RWF"].map((value) => ({ value, label: value || "Not recorded" })),
                  },
                  { name: "renewalAt", label: "Renewal time, optional (Kigali)", type: "datetime-local", value: local(r?.renewalAt) },
                ]}
              />
            );
          })}
        </div>
      </section>
    </>
  );
}
