"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { getCurrentUser, requireAdmin } from "@/lib/session";
import { todayInRwanda } from "@/lib/flight-enquiry-schema";
import { db } from "@/lib/db";
import { toQuoteMinor } from "@/lib/quote-rules";
import {
  beginCollection, collectionCheckout, issuePaymentLink, revokePaymentLink, type CollectionAccess,
} from "@/lib/collections/checkout";
import { reconcileCollection, recordCollectionSettlement } from "@/lib/collections/reconcile";
import { CollectionError, COLLECTION_METHODS, OPEN_COLLECTIONS } from "@/lib/collections/rules";
import { getUrubutoProvider } from "@/lib/collections/urubuto";
import { logActivity } from "@/lib/activity";

export type CollectionAction = { message?: string; error?: boolean; url?: string };

async function checkoutAccess(form: FormData): Promise<{ access: CollectionAccess; path: string } | null> {
  const token = String(form.get("token") ?? "");
  if (/^[\w-]{43}$/.test(token)) return { access: { token }, path: `/pay/${token}` };
  const reference = String(form.get("bookingReference") ?? "");
  const user = await getCurrentUser();
  if (!user || !/^[\w-]{4,80}$/.test(reference)) return null;
  return { access: { bookingReference: reference, customerId: user.id }, path: `/checkout/${reference}/pay` };
}

export async function submitCollection(_previous: CollectionAction, form: FormData): Promise<CollectionAction> {
  const access = await checkoutAccess(form);
  if (!access) return { error: true, message: "This checkout is unavailable." };
  try {
    if (form.get("command") === "check") {
      const current = await collectionCheckout(access.access);
      if (current?.attempt && OPEN_COLLECTIONS.includes(current.attempt.status)) {
        await reconcileCollection(current.attempt.reference);
      }
    } else {
      const parsed = z.object({
        method: z.enum(COLLECTION_METHODS),
        phone: z.string().trim().min(8).max(32),
        email: z.email().max(254),
        expectedMinor: z.coerce.number().int().positive().max(2_000_000_000),
      }).safeParse(Object.fromEntries(form));
      if (!parsed.success) return { error: true, message: "Enter a valid phone and email and select a payment method." };
      await beginCollection(access.access, parsed.data);
    }
    revalidatePath(access.path);
    return {};
  } catch (error) {
    return { error: true, message: error instanceof CollectionError ? error.message : "The payment could not be checked. Refresh and review its status before attempting a new payment." };
  }
}

export async function managePaymentLink(_previous: CollectionAction, form: FormData): Promise<CollectionAction> {
  const actor = await requireEnquiryStaff();
  const parsed = z.object({
    reference: z.string().regex(/^TRQ-[\w-]{4,76}$/),
    expiryDays: z.coerce.number().int().min(1).max(14),
    deposit: z.string().trim().max(30),
    currency: z.enum(["RWF", "USD", "EUR", "GBP"]),
    command: z.enum(["issue", "revoke"]),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: true, message: "Check the deposit and link expiry." };
  const { reference, expiryDays, deposit, command, currency } = parsed.data;
  try {
    let url: string | undefined;
    if (command === "revoke") await revokePaymentLink(actor.id, reference);
    else {
      const accepted = await db.quoteAcceptance.findFirst({ where: { enquiry: { reference } }, select: { quote: { select: { currency: true } } } });
      if (accepted?.quote.currency !== currency) throw new CollectionError("Use the accepted quotation currency.");
      url = await issuePaymentLink(actor.id, reference, expiryDays, deposit ? toQuoteMinor(deposit, currency) : undefined);
    }
    revalidatePath(`/admin/enquiries/${reference}`);
    revalidatePath(`/staff/enquiries/${reference}`);
    return { url, message: url ? "Payment link created. Copy it from this screen." : "Payment link revoked." };
  } catch (error) {
    return { error: true, message: error instanceof CollectionError ? error.message : "Check the payment link details and reload before retrying." };
  }
}

export async function recordGatewaySettlement(_previous: CollectionAction, form: FormData): Promise<CollectionAction> {
  const actor = await requireEnquiryStaff();
  const parsed = z.object({
    attemptId: z.uuid(), accountId: z.uuid(), statementRef: z.string().trim().min(2).max(160),
    net: z.string().trim().max(20), fee: z.string().trim().max(20), currency: z.literal("RWF"),
    evidence: z.string().trim().min(10).max(2000), date: z.iso.date(),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success || form.get("verified") !== "on" || parsed.data.date > todayInRwanda()) {
    return { error: true, message: "Enter the approved account, exact statement amounts, date and verification evidence." };
  }
  try {
    const input = parsed.data;
    await recordCollectionSettlement(actor.id, {
      attemptId: input.attemptId, accountId: input.accountId, statementRef: input.statementRef,
      netMinor: toQuoteMinor(input.net, input.currency), feeMinor: toQuoteMinor(input.fee, input.currency),
      creditedAt: new Date(`${input.date}T00:00:00+02:00`), evidence: input.evidence,
    });
    revalidatePath("/admin/payments");
    revalidatePath("/staff/finance");
    return { message: "Settlement reconciled against the verified collection." };
  } catch (error) {
    return { error: true, message: error instanceof CollectionError ? error.message : "Could not reconcile settlement. Check the reference and amounts." };
  }
}

export async function savePaymentRouting(_previous: CollectionAction, form: FormData): Promise<CollectionAction> {
  const admin = await requireAdmin("/admin/payments/routing");
  const environment = process.env.APP_ENV === "production" ? "live" : "staging";
  const gateway = getUrubutoProvider();
  const parsed = z.object({
    version: z.coerce.number().int().min(-1).max(2_147_483_646),
    methods: z.array(z.enum(COLLECTION_METHODS)).max(COLLECTION_METHODS.length),
    minMinor: z.coerce.number().int().positive().max(2_000_000_000),
    maxMinor: z.coerce.number().int().positive().max(2_000_000_000),
    evidence: z.string().trim().min(10).max(1000),
    feeTerms: z.string().trim().max(1000),
  }).safeParse({ ...Object.fromEntries(form), methods: [...new Set(form.getAll("methods"))] });
  if (!parsed.success || parsed.data.minMinor > parsed.data.maxMinor) {
    return { error: true, message: "Enter valid RWF limits and an approval evidence reference." };
  }
  const enabled = form.get("enabled") === "on";
  const { version, ...values } = parsed.data;
  if (enabled && (!gateway?.enabled || gateway.provider.environment !== environment || !values.methods.length ||
    values.methods.some((method) => !gateway.eligible("RWF", values.minMinor).includes(method) || !gateway.eligible("RWF", values.maxMinor).includes(method)))) {
    return { error: true, message: "The approved environment must support every selected method and the entire configured amount range." };
  }
  try {
    const data = { ...values, version: version + 1, enabled };
    const result = version === -1
      ? await db.paymentRoutingPolicy.createMany({ data: { environment, ...data }, skipDuplicates: true })
      : await db.paymentRoutingPolicy.updateMany({ where: { environment, version }, data });
    if (!result.count) return { error: true, message: "Settings changed. Refresh the page before saving." };
    await logActivity(admin.id, {
      action: "payments.routing", area: "Finance", target: "UrubutoPay",
      summary: `${enabled ? "Enabled" : "Paused"} UrubutoPay collections in ${environment}`, changes: data,
    });
    revalidatePath("/admin/payments/routing");
    revalidatePath("/admin/payments");
    return { message: "Payment routing saved." };
  } catch {
    return { error: true, message: "Could not save payment routing. Reload the settings before retrying." };
  }
}
