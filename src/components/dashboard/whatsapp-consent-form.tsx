import { db } from "@/lib/db";
import { OperationsForm } from "@/components/dashboard/operations-form";
export async function WhatsAppConsentForm({
  reference,
}: {
  reference: string;
}) {
  const e = await db.enquiry.findUnique({
    where: { reference },
    select: { phone: true, whatsappConsent: true },
  });
  if (!e) return null;
  const c = e.whatsappConsent;
  return (
    <OperationsForm
      key={`${c?.id}-${c?.version}`}
      title="Verified WhatsApp status-update consent"
      hidden={{
        command: "WHATSAPP_CONSENT",
        reference,
        version: c?.version ?? -1,
      }}
      fields={[
        {
          name: "phone",
          label: "Verified international enquiry phone (+country code)",
          value: c?.phone ?? e.phone,
          required: true,
        },
        {
          name: "active",
          label: "Customer explicitly opted into template status updates",
          type: "checkbox",
          value: String(c?.active ?? false),
        },
        {
          name: "evidence",
          label:
            "Opt-in wording, scope, contact verification and time evidence (20+ characters)",
          type: "textarea",
          required: true,
        },
      ]}
    />
  );
}
