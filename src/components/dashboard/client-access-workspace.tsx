import { WhatsAppConsentForm } from "@/components/dashboard/whatsapp-consent-form";
import { db } from "@/lib/db";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { enquiryScope, isFinance } from "@/lib/enquiry-workflow";
import { OperationsForm } from "@/components/dashboard/operations-form";
export async function ClientAccessWorkspace({
  reference,
}: {
  reference: string;
}) {
  const actor = await requireEnquiryStaff();
  if (isFinance(actor)) return null;
  const e = await db.enquiry.findFirst({
    where: { reference, ...enquiryScope(actor) },
    select: { id: true, ownerId: true },
  });
  if (
    !e ||
    (actor.role !== "ADMIN" &&
      (actor.staffRole !== "SALES" || e.ownerId !== actor.id))
  )
    return null;
  const grants = await db.clientCaseAccess.findMany({
    where: { enquiryId: e.id },
    include: { user: { select: { email: true } } },
  });
  const evidence = {
    name: "evidence",
    label:
      "Identity verification, authority and consent evidence (20+ characters, no ID copies)",
    type: "textarea",
    required: true,
  };
  return (
    <section className="my-8">
      <h2 className="text-2xl">Verified customer portal access</h2>
      <p>
        Check the account owner and their authority through an established
        contact channel. Knowing a reference or matching an email address is not
        sufficient. Acceptance permission can bind the customer to the exact
        quotation terms.
      </p>
      <OperationsForm
        title="Grant verified account access"
        hidden={{ command: "CLIENT_ACCESS", reference, version: -1 }}
        fields={[
          {
            name: "email",
            label: "Existing account email",
            type: "email",
            required: true,
          },
          {
            name: "active",
            label: "Enable case access",
            type: "checkbox",
            value: "true",
          },
          {
            name: "canAccept",
            label: "Authorize quotation acceptance",
            type: "checkbox",
          },
          evidence,
        ]}
      />
      {grants.map((g) => (
        <OperationsForm
          key={`${g.id}-${g.version}`}
          title={`${g.user.email} · ${g.active ? "Active" : "Revoked"}`}
          hidden={{
            command: "CLIENT_ACCESS",
            reference,
            email: g.user.email,
            version: g.version,
          }}
          fields={[
            {
              name: "active",
              label: "Case access active",
              type: "checkbox",
              value: String(g.active),
            },
            {
              name: "canAccept",
              label: "May accept quotations",
              type: "checkbox",
              value: String(g.canAccept),
            },
            evidence,
          ]}
        />
      ))}
      <WhatsAppConsentForm reference={reference} />
    </section>
  );
}
