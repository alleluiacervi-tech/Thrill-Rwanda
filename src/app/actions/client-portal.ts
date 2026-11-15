"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { acceptClientQuote, requestClientSupport } from "@/lib/client-portal";
import { OperationsError, type OperationsState } from "@/lib/launch-rules";
export async function recordClientAction(
  _state: OperationsState,
  form: FormData,
): Promise<OperationsState> {
  const user = await requireUser("/account/enquiries");
  try {
    const input = Object.fromEntries(form);
    let message = "";
    if (form.get("command") === "ACCEPT") {
      await acceptClientQuote(user.id, {
        ...input,
        checked: form.get("checked") === "on",
      });
      message =
        "Exact quotation version accepted. Payment verification and supplier confirmation follow separately.";
    } else if (form.get("command") === "SUPPORT") {
      const reference = await requestClientSupport(user.id, input);
      message = `Support request saved: ${reference}. This does not change or cancel the service or settle a refund.`;
    } else throw new OperationsError("Unknown action");
    revalidatePath("/account/enquiries", "layout");
    revalidatePath("/staff", "layout");
    revalidatePath("/admin", "layout");
    return { status: "ok", message };
  } catch (e) {
    return {
      status: "error",
      message:
        e instanceof OperationsError
          ? e.message
          : e instanceof z.ZodError
            ? e.issues.map((i) => i.message).join("; ")
            : "Could not confirm the change. Reload and inspect the current case before retrying.",
    };
  }
}
