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
