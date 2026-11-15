import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
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
  return (
    <>
      <DashboardHead
        title="Corporate client access"
        lede="Verify company representatives and consent before sharing named travel cases. No email-domain matching or automatic team invitations."
      />
      <OperationsForm
        key={newCompanyId}
        title="Create a verified company workspace"
        hidden={{
          command: "CORPORATE_ACCESS",
          kind: "ACCOUNT",
          id: newCompanyId,
          version: -1,
        }}
        fields={[
          { name: "name", label: "Company name", required: true },
          active,
          evidence,
        ]}
      />
      {accounts.map((a) => (
        <section key={a.id} className="my-7 rounded-xl border p-5">
          <h2 className="text-2xl">
            {a.name} · {a.active ? "Active" : "Suspended"}
          </h2>
          <OperationsForm
            key={`${a.id}-${a.version}`}
            title="Update company status"
            hidden={{
              command: "CORPORATE_ACCESS",
              kind: "ACCOUNT",
              id: a.id,
              version: a.version,
            }}
            fields={[
              {
                name: "name",
                label: "Company name",
                value: a.name,
                required: true,
              },
              { ...active, value: String(a.active) },
              evidence,
            ]}
          />
          <OperationsForm
            title="Add an authorized existing account"
            hidden={{
              command: "CORPORATE_ACCESS",
              kind: "MEMBER",
              id: a.id,
              version: -1,
            }}
            fields={[
              {
                name: "email",
                label: "Account email",
                type: "email",
                required: true,
              },
              active,
              evidence,
            ]}
          />
          {a.members.map((m) => (
            <OperationsForm
              key={`${m.id}-${m.version}`}
              title={`${m.user.email} · ${m.active ? "Active" : "Revoked"}`}
              hidden={{
                command: "CORPORATE_ACCESS",
                kind: "MEMBER",
                id: a.id,
                email: m.user.email,
                version: m.version,
              }}
              fields={[{ ...active, value: String(m.active) }, evidence]}
            />
          ))}
          <OperationsForm
            title="Share a verified company enquiry"
            hidden={{
              command: "CORPORATE_ACCESS",
              kind: "CASE",
              id: a.id,
              version: -1,
            }}
            fields={[
              { name: "reference", label: "Enquiry reference", required: true },
              active,
              evidence,
            ]}
          />
          {a.cases.map((c) => (
            <OperationsForm
              key={`${c.id}-${c.version}`}
              title={`${c.enquiry.reference} · ${c.active ? "Shared" : "Revoked"}`}
              hidden={{
                command: "CORPORATE_ACCESS",
                kind: "CASE",
                id: a.id,
                reference: c.enquiry.reference,
                version: c.version,
              }}
              fields={[{ ...active, value: String(c.active) }, evidence]}
            />
          ))}
        </section>
      ))}
    </>
  );
}
