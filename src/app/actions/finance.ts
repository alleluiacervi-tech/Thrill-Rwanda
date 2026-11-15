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
    refresh();
    return { status: "ok", message: "Account status updated and audited." };
  } catch (error) {
    return fail(error);
  }
}
