import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { Panel, StatGrid, StatTile, StatusPill } from "@/components/dashboard/dash-ui";
import {
  OperationsForm,
  type OperationsField,
} from "@/components/dashboard/operations-form";
export default async function Page() {
  await requireAdmin();
  const accounts = await db.corporateAccount.findMany({
    include: {
      members: { include: { user: { select: { email: true } } } },
      cases: { include: { enquiry: { select: { reference: true } } } },
    },
    orderBy: { name: "asc" },
    take: 100,
  });
  const evidence: OperationsField = {
      name: "evidence",
      label: "Verified authority, company consent and sharing scope evidence",
      type: "textarea",
      required: true,
    },
    active: OperationsField = {
      name: "active",
      label: "Access active",
      type: "checkbox",
      value: "true",
    };
  const newCompanyId = randomUUID();
  const members = accounts.reduce((n, a) => n + a.members.filter((m) => m.active).length, 0);
  const shared = accounts.reduce((n, a) => n + a.cases.filter((c) => c.active).length, 0);
  return (
    <>
      <DashboardHead
        title="Corporate accounts"
        lede="Company workspaces with verified representatives and the cases shared with them."
      />
      <StatGrid>
        <StatTile label="Companies" value={accounts.length} />
        <StatTile label="Active" value={accounts.filter((a) => a.active).length} tone="good" />
        <StatTile label="Representatives" value={members} note="with access" />
        <StatTile label="Shared cases" value={shared} />
      </StatGrid>
      <Panel
        title="Add a company"
        description="Record the authority and consent evidence first. Access is never granted by email domain."
        className="mb-6"
      >
        <OperationsForm
          key={newCompanyId}
          title="Create a verified company workspace"
          hidden={{ command: "CORPORATE_ACCESS", kind: "ACCOUNT", id: newCompanyId, version: -1 }}
          fields={[{ name: "name", label: "Company name", required: true }, active, evidence]}
        />
      </Panel>
      {accounts.length === 0 ? (
        <EmptyPanel title="No companies yet" body="Verified company workspaces will be listed here." />
      ) : (
        <div className="grid gap-5">
          {accounts.map((a) => (
            <Panel
              key={a.id}
              title={a.name}
              description={`${a.members.filter((m) => m.active).length} representatives · ${a.cases.filter((c) => c.active).length} shared cases`}
              aside={<StatusPill tone={a.active ? "good" : "alert"}>{a.active ? "Active" : "Suspended"}</StatusPill>}
            >
              <OperationsForm
                key={`${a.id}-${a.version}`}
                title="Company status"
                hidden={{ command: "CORPORATE_ACCESS", kind: "ACCOUNT", id: a.id, version: a.version }}
                fields={[
                  { name: "name", label: "Company name", value: a.name, required: true },
                  { ...active, value: String(a.active) },
                  evidence,
                ]}
              />
              <p className="mt-5 text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Representatives</p>
              <OperationsForm
                title="Add a representative"
                hidden={{ command: "CORPORATE_ACCESS", kind: "MEMBER", id: a.id, version: -1 }}
                fields={[{ name: "email", label: "Account email", type: "email", required: true }, active, evidence]}
              />
              {a.members.map((m) => (
                <OperationsForm
                  key={`${m.id}-${m.version}`}
                  title={`${m.user.email} · ${m.active ? "Active" : "Revoked"}`}
                  hidden={{ command: "CORPORATE_ACCESS", kind: "MEMBER", id: a.id, email: m.user.email, version: m.version }}
                  fields={[{ ...active, value: String(m.active) }, evidence]}
                />
              ))}
              <p className="mt-5 text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Shared enquiries</p>
              <OperationsForm
                title="Share an enquiry"
                hidden={{ command: "CORPORATE_ACCESS", kind: "CASE", id: a.id, version: -1 }}
                fields={[{ name: "reference", label: "Enquiry reference", required: true }, active, evidence]}
              />
              {a.cases.map((c) => (
                <OperationsForm
                  key={`${c.id}-${c.version}`}
                  title={`${c.enquiry.reference} · ${c.active ? "Shared" : "Revoked"}`}
                  hidden={{ command: "CORPORATE_ACCESS", kind: "CASE", id: a.id, reference: c.enquiry.reference, version: c.version }}
                  fields={[{ ...active, value: String(c.active) }, evidence]}
                />
              ))}
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
