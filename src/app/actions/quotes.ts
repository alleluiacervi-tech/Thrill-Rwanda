"use server";
import { revalidatePath } from "next/cache";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { getSite } from "@/lib/settings";
import { issueQuote, recordQuoteAcceptance, QuoteError } from "@/lib/quotes";
import {
  quoteInputSchema,
  acceptanceSchema,
  type QuoteActionState,
} from "@/lib/quote-rules";
import { logActivity } from "@/lib/activity";
const refresh = (reference: string) => {
  for (const base of ["/staff/enquiries", "/admin/enquiries"]) {
    revalidatePath(base);
    revalidatePath(`${base}/${reference}`);
  }
};
export async function issueWrittenQuote(
  _previous: QuoteActionState,
  form: FormData,
): Promise<QuoteActionState> {
  const actor = await requireEnquiryStaff();
  let lines: unknown;
  try {
    lines = JSON.parse(String(form.get("lines") ?? ""));
  } catch {
    return { status: "error", message: "Check the quotation line items." };
  }
  const parsed = quoteInputSchema.safeParse({
    ...Object.fromEntries(form),
    lines,
    checked: form.get("checked") === "on",
    sendEmail: form.get("sendEmail") === "on",
  });
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  try {
    const brand = await getSite();
    await issueQuote(actor.id, parsed.data, {
      name: brand.legalName,
      email: brand.contact.email,
      phone: brand.contact.phone,
      address: brand.contact.address,
    });
    await logActivity(actor.id, {
      action: "quote.issue",
      area: "Quotes",
      target: parsed.data.reference,
      summary: `Issued a written quote (${parsed.data.currency}) for enquiry ${parsed.data.reference}`,
    });
    refresh(parsed.data.reference);
    return {
      status: "ok",
      message:
        "Written quote issued. A new immutable version is saved; requested email delivery is queued, not yet confirmed sent.",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof QuoteError
          ? error.message
          : "Could not confirm the quote was issued. Reload to inspect versions before retrying.",
    };
  }
}
export async function recordWrittenQuoteAcceptance(
  _previous: QuoteActionState,
  form: FormData,
): Promise<QuoteActionState> {
  const actor = await requireEnquiryStaff();
  const parsed = acceptanceSchema.safeParse({
    ...Object.fromEntries(form),
    verified: form.get("verified") === "on",
  });
  if (!parsed.success)
    return {
      status: "error",
      message:
        "Enter the customer's name, channel, acceptance evidence and verification for this exact version.",
    };
  try {
    await recordQuoteAcceptance(actor.id, parsed.data);
    await logActivity(actor.id, {
      action: "quote.accept",
      area: "Quotes",
      target: parsed.data.reference,
      targetId: parsed.data.quoteId,
      summary: `Recorded ${parsed.data.customerName}'s acceptance of a quote for ${parsed.data.reference} (by ${parsed.data.channel.toLowerCase()})`,
    });
    refresh(parsed.data.reference);
    return {
      status: "ok",
      message:
        "Acceptance recorded against this exact quote version. Payment is still outstanding; no booking was created.",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof QuoteError
          ? error.message
          : "Could not confirm acceptance. Reload before retrying.",
    };
  }
}
