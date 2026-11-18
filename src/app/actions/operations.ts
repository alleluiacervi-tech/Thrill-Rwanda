"use server";
import { saveWhatsAppConsent } from "@/lib/whatsapp";
import {
  saveReleaseRecord,
  setDocumentHold,
  recordSupplierReview,
} from "@/lib/release-operations";
import { linkClient, saveCorporateAccess } from "@/lib/client-portal";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import {
  savePublication,
  savePolicy,
  saveSupportCase,
  approveOffer,
  deleteRetainedDocument,
} from "@/lib/operations";
import { refreshSite } from "@/lib/settings";
import { refreshPublicCatalogue } from "@/lib/catalogue";
import { OperationsError, type OperationsState } from "@/lib/launch-rules";
import { logActivity } from "@/lib/activity";
/** How each launch-control command reads in the activity log. */
const OPERATION_LABELS: Record<string, string> = {
  WHATSAPP_CONSENT: "Recorded WhatsApp consent",
  RELEASE_RECORD: "Saved a release record",
  DOCUMENT_HOLD: "Changed a document hold",
  SUPPLIER_REVIEW: "Reviewed a supplier",
  CLIENT_ACCESS: "Changed a customer's access to an enquiry",
  CORPORATE_ACCESS: "Changed corporate client access",
  OFFER: "Approved an offer for publication",
  DOCUMENT_DELETE: "Deleted a retained document",
  PUBLICATION: "Changed how a service is offered",
  POLICY: "Changed the operations policy",
  SUPPORT: "Updated a support case",
};

export async function recordOperation(
  _previous: OperationsState,
  form: FormData,
): Promise<OperationsState> {
  const actor = await requireEnquiryStaff();
  if (form.get("verified") !== "on")
    return {
      status: "error",
      message: "Verify authority and supporting evidence before saving",
    };
  try {
    const input = Object.fromEntries(form);
    switch (form.get("command")) {
      case "WHATSAPP_CONSENT":
        await saveWhatsAppConsent(actor.id, {
          ...input,
          active: form.get("active") === "on",
        });
        break;
      case "RELEASE_RECORD":
        await saveReleaseRecord(actor.id, input);
        break;
      case "DOCUMENT_HOLD":
        await setDocumentHold(actor.id, input);
        break;
      case "SUPPLIER_REVIEW":
        await recordSupplierReview(actor.id, input);
        break;
      case "CLIENT_ACCESS":
        await linkClient(actor.id, {
          ...input,
          active: form.get("active") === "on",
          canAccept: form.get("canAccept") === "on",
        });
        revalidatePath("/account/enquiries", "layout");
        break;
      case "CORPORATE_ACCESS":
        await saveCorporateAccess(actor.id, {
          ...input,
          active: form.get("active") === "on",
        });
        revalidatePath("/account", "layout");
        break;
      case "OFFER":
        await approveOffer(
          actor.id,
          String(form.get("id")),
          String(form.get("evidence")),
          String(form.get("contentHash")),
        );
        refreshPublicCatalogue();
        break;
      case "DOCUMENT_DELETE":
        await deleteRetainedDocument(
          actor.id,
          String(form.get("id")),
          String(form.get("evidence")),
        );
        break;
      case "PUBLICATION":
        await savePublication(actor.id, input);
        refreshSite();
        refreshPublicCatalogue();
        break;
      case "POLICY":
        await savePolicy(actor.id, {
          ...input,
          documentsEnabled: form.get("documentsEnabled") === "on",
        });
        break;
      case "SUPPORT":
        await saveSupportCase(actor.id, input);
        break;
      default:
        throw new OperationsError("Unknown action");
    }
    const command = String(form.get("command") ?? "");
    await logActivity(actor.id, {
      action: `operations.${command.toLowerCase()}`,
      area: command === "PUBLICATION" || command === "OFFER" ? "Launch" : command === "SUPPORT" ? "Support" : command.includes("ACCESS") ? "Access" : "Launch",
      target: String(form.get("service") ?? form.get("reference") ?? form.get("id") ?? "") || null,
      summary: `${OPERATION_LABELS[command] ?? command}${form.get("mode") ? `: ${String(form.get("mode")).toLowerCase()}` : ""}`,
      changes: { evidence: String(form.get("evidence") ?? "").slice(0, 500) } as never,
    });
    revalidatePath("/admin", "layout");
    revalidatePath("/staff", "layout");
    revalidatePath("/support");
    return { status: "ok", message: "Saved with audit evidence" };
  } catch (e) {
    return {
      status: "error",
      message:
        e instanceof OperationsError
          ? e.message
          : e instanceof z.ZodError
            ? e.issues.map((i) => i.message).join("; ")
            : "Could not confirm this change. Reload before retrying.",
    };
  }
}
