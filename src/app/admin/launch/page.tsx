import { offerContentHash } from "@/lib/operations";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
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
  return (
    <>
      <DashboardHead
        title="Launch controls"
        lede="Services default to request-only. Record actual business approval before enabling direct bookings. Existing reservations and payment history are preserved."
      />
      <h2 className="text-xl">Service publication</h2>
      {PUBLIC_SERVICES.map((service) => {
        const r = rows.find((x) => x.service === service);
        return (
          <OperationsForm
            key={`${service}-${r?.version}`}
            title={`${service} · ${r?.mode ?? "ENQUIRY"}`}
            hidden={{
              command: "PUBLICATION",
              service,
              version: r?.version ?? -1,
            }}
            fields={[
              {
                name: "mode",
                label: "Publication mode",
                value: r?.mode ?? "ENQUIRY",
                options: PUBLIC_MODES.filter(
                  (m) =>
                    m !== "DIRECT" ||
                    ["TRIP", "STAY", "TRANSPORT"].includes(service),
                ).map((value) => ({ value, label: value })),
              },
              {
                name: "evidence",
                label: "Business approval reference, scope and conditions",
                type: "textarea",
                required: true,
              },
            ]}
          />
        );
      })}
      <h2 className="mt-8 text-xl">Support and document policy</h2>
      <p>
        Enable document collection only after confirming necessity, restricted
        access, retention and deletion with the business owner. The maximum
        configured retention is 90 days; expired files cannot be downloaded.
      </p>
      <OperationsForm
        key={`policy-${policy?.version ?? -1}`}
        title="Record approved operational policy"
        hidden={{ command: "POLICY", version: policy?.version ?? -1 }}
        fields={[
          {
            name: "supportHours",
            label: "Support hours, timezone and days",
            value: policy?.supportHours,
            required: true,
          },
          {
            name: "escalation",
            label: "Public escalation contact and process",
            type: "textarea",
            value: policy?.escalation,
            required: true,
          },
          {
            name: "emergencyNotice",
            label: "Urgent and out-of-hours guidance",
            type: "textarea",
            value: policy?.emergencyNotice,
            required: true,
          },
          {
            name: "documentPurpose",
            label: "Approved document necessity and customer notice",
            type: "textarea",
            value: policy?.documentPurpose,
            required: true,
          },
          {
            name: "documentDays",
            label: "Retention days from upload (1–90)",
            type: "number",
            value: String(policy?.documentDays ?? 30),
            required: true,
          },
          {
            name: "documentsEnabled",
            label: "Enable necessary car-hire document collection",
            type: "checkbox",
            value: String(policy?.documentsEnabled ?? false),
          },
          {
            name: "evidence",
            label: "Approval evidence",
            type: "textarea",
            required: true,
          },
        ]}
      />
      <h2 className="mt-8 text-xl">Curated offers</h2>
      <p>
        Only offers with complete per-offer content and recorded approval appear
        publicly. Review names, descriptions, prices, media rights, supplier
        terms and suitability. Editing an offer removes its approval.
      </p>
      {offers.map((t) => (
        <article key={t.id} className="my-4 rounded-xl border p-4">
          <h3 className="text-xl">
            {t.name} · {t.offerApproval ? "Approved" : "Review needed"}
          </h3>
          <a className="underline" href={`/admin/listings/tours/${t.id}/edit`}>
            Edit full offer
          </a>
          <details className="mt-3">
            <summary>Review offer content</summary>
            <pre className="whitespace-pre-wrap break-words text-xs">
              {JSON.stringify({ ...t, provider: t.provider }, null, 2)}
            </pre>
          </details>
          <OperationsForm
            key={offerContentHash(t)}
            title="Approve this offer for publication"
            hidden={{
              command: "OFFER",
              id: t.id,
              contentHash: offerContentHash(t),
            }}
            fields={[
              {
                name: "evidence",
                label: "Offer, pricing, media and supplier approval evidence",
                type: "textarea",
                required: true,
              },
            ]}
          />
        </article>
      ))}
      <h2 className="mt-8 text-xl">Retained private documents</h2>
      <p>
        Oldest 100 documents. Expiry blocks access; deletion removes the stored
        bytes and leaves audit evidence. Backups follow the separate
        backup-retention procedure.
      </p>
      {documents.map((d) => (
        <OperationsForm
          key={d.id}
          title={`${d.booking.reference} · ${d.kind} · uploaded ${d.uploadedAt.toISOString().slice(0, 10)} · deadline ${d.expiresAt?.toISOString().slice(0, 10) ?? "legacy 30-day maximum"}`}
          hidden={{ command: "DOCUMENT_DELETE", id: d.id }}
          fields={[
            {
              name: "evidence",
              label: "Deletion authority and reason",
              type: "textarea",
              required: true,
            },
          ]}
        />
      ))}
      <h2 className="mt-8 text-xl">Recent approvals</h2>
      <ul>
        {audit.map((a) => (
          <li
            key={a.id}
            className="my-3 break-words border-b border-[var(--line)] pb-3"
          >
            {a.createdAt.toISOString()} · {a.action} · {a.entityId}
            <p>{a.evidence}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
