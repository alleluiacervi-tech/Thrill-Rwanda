import { offerContentHash } from "@/lib/operations";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { Panel, StatGrid, StatTile, StatusPill } from "@/components/dashboard/dash-ui";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { OperationsForm } from "@/components/dashboard/operations-form";
import { PUBLIC_SERVICES, PUBLIC_MODES } from "@/lib/launch-rules";
export default async function Page() {
  await requireAdmin();
  const offers = await db.tour.findMany({
    include: { provider: { select: { status: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const documents = await db.bookingDocument.findMany({
    select: {
      id: true,
      kind: true,
      uploadedAt: true,
      expiresAt: true,
      legalHoldReason:true,
      booking: { select: { reference: true } },
    },
    orderBy: { uploadedAt: "asc" },
    take: 100,
  });
  const [rows, policy, audit] = await Promise.all([
    db.servicePublication.findMany(),
    db.operationsPolicy.findUnique({ where: { id: 1 } }),
    db.operationsAudit.findMany({
      where: { action: { in: ["PUBLICATION", "POLICY", "OFFER_APPROVAL"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const direct = rows.filter((r) => r.mode === "DIRECT").length;
  const approved = offers.filter((t) => t.offerApproval).length;
  const modeTone = (m: string) => (m === "DIRECT" ? "good" : m === "ENQUIRY" ? "info" : "neutral");
  return (
    <>
      <DashboardHead
        title="Launch controls"
        lede="What travellers can book directly, and what is request-only. Everything defaults to request-only."
      />
      <StatGrid>
        <StatTile label="Services direct" value={`${direct}/${PUBLIC_SERVICES.length}`} note="open for booking" />
        <StatTile label="Offers approved" value={`${approved}/${offers.length}`} tone={approved === offers.length ? "good" : "default"} />
        <StatTile label="Retained documents" value={documents.length} note="oldest 100 shown" />
        <StatTile label="Document policy" value={policy?.documentsEnabled ? "On" : "Off"} tone={policy?.documentsEnabled ? "alert" : "good"} />
      </StatGrid>

      <Panel
        title="Service publication"
        description="Record the business approval before enabling direct booking. Existing reservations are never affected."
        className="mb-6"
      >
        {PUBLIC_SERVICES.map((service) => {
          const r = rows.find((x) => x.service === service);
          const mode = r?.mode ?? "ENQUIRY";
          return (
            <OperationsForm
              key={`${service}-${r?.version}`}
              title={`${service.charAt(0)}${service.slice(1).toLowerCase()}  ·  ${modeTone(mode) === "good" ? "Direct booking" : mode === "ENQUIRY" ? "Request only" : mode.charAt(0) + mode.slice(1).toLowerCase()}`}
              hidden={{ command: "PUBLICATION", service, version: r?.version ?? -1 }}
              fields={[
                {
                  name: "mode",
                  label: "Publication mode",
                  value: mode,
                  options: PUBLIC_MODES.filter((m) => m !== "DIRECT" || ["TRIP", "STAY", "TRANSPORT"].includes(service)).map((value) => ({ value, label: value })),
                },
                { name: "evidence", label: "Business approval reference, scope and conditions", type: "textarea", required: true },
              ]}
            />
          );
        })}
      </Panel>

      <Panel
        title="Support and document policy"
        description="Collect documents only once necessity, access, retention and deletion are agreed. Retention is capped at 90 days."
        className="mb-6"
      >
        <OperationsForm
          key={`policy-${policy?.version ?? -1}`}
          title="Record approved operational policy"
          hidden={{ command: "POLICY", version: policy?.version ?? -1 }}
          fields={[
            { name: "supportHours", label: "Support hours, timezone and days", value: policy?.supportHours, required: true },
            { name: "escalation", label: "Public escalation contact and process", type: "textarea", value: policy?.escalation, required: true },
            { name: "emergencyNotice", label: "Urgent and out-of-hours guidance", type: "textarea", value: policy?.emergencyNotice, required: true },
            { name: "documentPurpose", label: "Approved document necessity and customer notice", type: "textarea", value: policy?.documentPurpose, required: true },
            { name: "documentDays", label: "Retention days from upload (1–90)", type: "number", value: String(policy?.documentDays ?? 30), required: true },
            { name: "documentsEnabled", label: "Enable necessary car-hire document collection", type: "checkbox", value: String(policy?.documentsEnabled ?? false) },
            { name: "evidence", label: "Approval evidence", type: "textarea", required: true },
          ]}
        />
      </Panel>

      <Panel
        title="Curated offers"
        description="Only complete, approved offers appear publicly. Editing an offer removes its approval."
        className="mb-6"
      >
        {offers.length === 0 ? <p className="text-sm text-[var(--ink-muted)]">No offers yet.</p> : null}
        <div className="grid gap-3">
          {offers.map((t) => (
            <div key={t.id} className="rounded-[var(--radius-card)] border border-[var(--line)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">{t.name}</p>
                <div className="flex items-center gap-4">
                  <a className="text-xs font-medium text-lake-700 hover:underline" href={`/admin/listings/tours/${t.id}/edit`}>Edit offer</a>
                  <StatusPill tone={t.offerApproval ? "good" : "warn"}>{t.offerApproval ? "Approved" : "Review needed"}</StatusPill>
                </div>
              </div>
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-[var(--ink-muted)]">View raw content</summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify({ ...t, provider: t.provider }, null, 2)}</pre>
              </details>
              <OperationsForm
                key={offerContentHash(t)}
                title="Approve this offer for publication"
                hidden={{ command: "OFFER", id: t.id, contentHash: offerContentHash(t) }}
                fields={[{ name: "evidence", label: "Offer, pricing, media and supplier approval evidence", type: "textarea", required: true }]}
              />
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Retained private documents"
        description="Expiry blocks access. Deletion removes stored bytes and leaves audit evidence."
        className="mb-6"
      >
        {documents.length === 0 ? <p className="text-sm text-[var(--ink-muted)]">No documents are retained.</p> : null}
        <div className="grid gap-3">
          {documents.map((d) => (
            <div key={d.id} className="rounded-[var(--radius-card)] border border-[var(--line)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  <span className="font-mono text-xs">{d.booking.reference}</span> · {d.kind}
                </p>
                <StatusPill tone={d.legalHoldReason ? "warn" : "neutral"}>{d.legalHoldReason ? "Legal hold" : "No hold"}</StatusPill>
              </div>
              <OperationsForm title="Record or release legal hold" hidden={{ command: "DOCUMENT_HOLD", id: d.id }} fields={[{ name: "mode", label: "Hold action", options: [{ value: "HOLD", label: "Hold" }, { value: "RELEASE", label: "Release" }] }, { name: "evidence", label: "Legal authority and reason (20+ characters)", type: "textarea", required: true }]} />
              <OperationsForm title="Delete retained copy" hidden={{ command: "DOCUMENT_DELETE", id: d.id }} fields={[{ name: "evidence", label: "Deletion authority and reason", type: "textarea", required: true }]} />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Recent approvals" flush>
        {audit.length === 0 ? (
          <p className="p-5 text-sm text-[var(--ink-muted)]">Nothing recorded yet.</p>
        ) : (
          <TableShell className="rounded-none border-0" dense>
            <thead><tr><Th>When</Th><Th>Action</Th><Th>Subject</Th><Th>Evidence</Th></tr></thead>
            <tbody>
              {audit.map((a) => (
                <Tr key={a.id}>
                  <Td className="tnum whitespace-nowrap">{a.createdAt.toISOString().slice(0, 16).replace("T", " ")}</Td>
                  <Td><StatusPill tone="info">{a.action.replaceAll("_", " ").toLowerCase()}</StatusPill></Td>
                  <Td className="font-mono text-xs">{a.entityId}</Td>
                  <Td className="max-w-md break-words text-xs text-[var(--ink-muted)]">{a.evidence}</Td>
                </Tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>
    </>
  );
}
