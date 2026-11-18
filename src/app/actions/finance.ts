"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { executeFinanceCommand } from "@/lib/finance";
import {
  createSettlementAccount,
  saveSupplier,
  changeAccountStatus,
} from "@/lib/finance-registry";
import {
  financeCommandSchema,
  supplierSchema,
  FinanceError,
  type FinanceActionState,
} from "@/lib/finance-rules";
import { logActivity } from "@/lib/activity";
const refresh = () => {
  for (const path of ["/staff", "/admin"]) revalidatePath(path, "layout");
};
const fail = (error: unknown): FinanceActionState => ({
  status: "error",
  message:
    error instanceof FinanceError
      ? error.message
      : "Could not confirm this operation. Reload and inspect the records before retrying; account references, contract references and request keys must be unique.",
});
export async function recordFinanceAction(
  _previous: FinanceActionState,
  form: FormData,
): Promise<FinanceActionState> {
  const actor = await requireEnquiryStaff();
  const parsed = financeCommandSchema.safeParse({
    ...Object.fromEntries(form),
    verified: form.get("verified") === "on",
  });
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    };
  try {
    await executeFinanceCommand(actor.id, parsed.data);
    await logActivity(actor.id, {
      action: `finance.${parsed.data.action.toLowerCase()}`,
      area: "Finance",
      target: parsed.data.reference,
      summary: `${parsed.data.action.toLowerCase().replaceAll("_", " ")} on ${parsed.data.reference}${parsed.data.amount ? `: ${parsed.data.currency} ${parsed.data.amount}` : ""}`,
      changes: { amount: parsed.data.amount || null, currency: parsed.data.currency, externalRef: parsed.data.externalRef || null } as never,
    });
    refresh();
    return {
      status: "ok",
      message:
        "Operation recorded and audited. No money was moved, ticket issued or booking created automatically.",
    };
  } catch (error) {
    return fail(error);
  }
}
export async function recordSupplier(
  _previous: FinanceActionState,
  form: FormData,
): Promise<FinanceActionState> {
  const actor = await requireEnquiryStaff();
  const parsed = supplierSchema.safeParse({
    ...Object.fromEntries(form),
    currencies: String(form.get("currencies") ?? "")
      .split(",")
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean),
    publicationAllowed: form.get("publicationAllowed") === "on",
    verified: form.get("verified") === "on",
  });
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    };
  try {
    await saveSupplier(actor.id, parsed.data);
    await logActivity(actor.id, {
      action: parsed.data.id ? "supplier.update" : "supplier.create",
      area: "Suppliers",
      target: parsed.data.name,
      targetId: parsed.data.id || null,
      summary: `${parsed.data.id ? "Edited" : "Added"} supplier ${parsed.data.name}`,
    });
    refresh();
    return {
      status: "ok",
      message:
        "Supplier saved and audited. This does not publish supplier names, logos or offers.",
    };
  } catch (error) {
    return fail(error);
  }
}
export async function recordSettlementAccount(
  _previous: FinanceActionState,
  form: FormData,
): Promise<FinanceActionState> {
  const actor = await requireEnquiryStaff();
  try {
    await createSettlementAccount(actor.id, {
      ...Object.fromEntries(form),
      verified: form.get("verified") === "on",
    });
    await logActivity(actor.id, {
      action: "finance.account_create",
      area: "Finance",
      target: String(form.get("label") ?? "settlement account"),
      summary: `Registered settlement account ${String(form.get("label") ?? "")}`.trim(),
    });
    refresh();
    return {
      status: "ok",
      message:
        "Approved off-site account registered. No bank connection or gateway was activated.",
    };
  } catch (error) {
    return fail(error);
  }
}
export async function recordAccountStatus(
  _previous: FinanceActionState,
  form: FormData,
): Promise<FinanceActionState> {
  const actor = await requireEnquiryStaff();
  const parsed = z
    .object({
      id: z.string().uuid(),
      version: z.coerce.number().int().min(0),
      active: z.enum(["true", "false"]),
      evidence: z.string().trim().min(10).max(2000),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      status: "error",
      message: "Enter a valid account, version and approval evidence.",
    };
  try {
    await changeAccountStatus(
      actor.id,
      parsed.data.id,
      parsed.data.version,
      parsed.data.active === "true",
      parsed.data.evidence,
    );
    await logActivity(actor.id, {
      action: "finance.account_status",
      area: "Finance",
      targetId: parsed.data.id,
      summary: `${parsed.data.active === "true" ? "Activated" : "Deactivated"} a settlement account`,
      changes: { evidence: parsed.data.evidence } as never,
    });
    refresh();
    return { status: "ok", message: "Account status updated and audited." };
  } catch (error) {
    return fail(error);
  }
}
