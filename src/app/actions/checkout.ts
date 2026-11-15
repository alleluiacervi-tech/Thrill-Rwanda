"use server";
import { documentDeadline } from "@/lib/document-access";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { BookingError, cancelBooking } from "@/lib/booking";
import { resolveBookingSubjectDetails } from "@/lib/booking-display";
import { agreementForBooking } from "@/lib/agreement-booking";
import { DOCUMENT_LABELS, requiredDocuments } from "@/lib/booking-documents";
import { db } from "@/lib/db";
import { currentTermsVersion } from "@/lib/legal";
import { notifyBookingCreated } from "@/lib/notifications";
import { CHECKOUT_STATUSES, PaymentError, startCheckout } from "@/lib/payments";
import { pesapalConfigured, pesapalIpnId } from "@/lib/pesapal";
import { getCurrentUser } from "@/lib/session";
import { paysOnline } from "@/lib/settings";

// Step two of booking: agree the terms (and sign, for car hire), then pay. Hotels skip payment.

// A drawn signature is a small PNG. The cap stops a pasted image of any size.
const MAX_SIGNATURE_BYTES = 400_000;

export type ConfirmState =
  | { status: "idle" }
  | { status: "error"; message: string; retryable: boolean }
  | { status: "redirect"; url: string };

export async function confirmBooking(
  _prev: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Please sign in again.", retryable: true };

  const reference = String(formData.get("reference") ?? "").trim();
  if (formData.get("termsAccepted") !== "on") {
    return {
      status: "error",
      message: "Please accept the booking terms to continue.",
      retryable: true,
    };
  }

  // Scoped to the session user, so a reference alone can't confirm someone else's booking.
  const booking = await db.booking.findFirst({
    where: { reference, customerId: user.id },
    select: {
      id: true,
      status: true,
      serviceType: true,
      details: true,
      agreement: { select: { id: true } },
      documents: { select: { kind: true, uploadedAt: true, expiresAt: true } },
    },
  });
  if (!booking || !(CHECKOUT_STATUSES as readonly string[]).includes(booking.status)) {
    return { status: "error", message: "This booking can no longer be completed.", retryable: false };
  }

  // Car hire: licence and ID copies are required before confirming.
  if (booking.serviceType === "VEHICLE") {
    const documentPolicy = await db.operationsPolicy.findUnique({ where: { id: 1 } });
    if (!documentPolicy?.documentsEnabled) return { status: "error", message: "Contact the desk to confirm approved document requirements before confirming car hire.", retryable: false };
    const have = new Set(booking.documents.filter(d => documentDeadline(d.uploadedAt, d.expiresAt, documentPolicy.documentDays) > new Date()).map((d) => d.kind));
    const missing = requiredDocuments(booking.details).filter((k) => !have.has(k));
    if (missing.length) {
      return {
        status: "error",
        message: `Please upload your ${missing.map((k) => DOCUMENT_LABELS[k].label.toLowerCase()).join(" and ")}.`,
        retryable: true,
      };
    }
  }

  // Car hire: the agreement is signed here, before any money moves.
  if (booking.serviceType === "VEHICLE" && !booking.agreement) {
    const signedName = String(formData.get("signedName") ?? "").trim();
    const signature = String(formData.get("signature") ?? "");
    if (signedName.length < 3) {
      return { status: "error", message: "Type your full name as it appears on your licence.", retryable: true };
    }
    if (!signature.startsWith("data:image/png;base64,")) {
      return { status: "error", message: "Please sign the hire agreement in the box.", retryable: true };
    }
    if (signature.length > MAX_SIGNATURE_BYTES) {
      return { status: "error", message: "That signature image is too large.", retryable: true };
    }

    // Rebuilt on the server, so what is stored is what was agreed.
    const agreement = await agreementForBooking(booking.id);
    if (!agreement) return { status: "error", message: "We couldn't load the agreement.", retryable: true };
    const head = await headers();
    await db.bookingAgreement.create({
      data: {
        bookingId: booking.id,
        version: agreement.version,
        body: agreement.body,
        signature,
        signedName,
        ipAddress: head.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: head.get("user-agent")?.slice(0, 500) ?? null,
      },
    });
  }

  // A retry after a failed payment has agreed already, and mustn't notify twice.
  const firstConfirm = !(booking.details as { terms?: unknown } | null)?.terms;

  // The terms version agreed to is kept with the booking, as before.
  await db.booking.update({
    where: { id: booking.id },
    data: {
      details: {
        ...((booking.details as Record<string, unknown> | null) ?? {}),
        terms: { acceptedAt: new Date().toISOString(), version: await currentTermsVersion() },
      },
    },
  });
  revalidatePath(`/account/bookings/${reference}`);

  // Hotels are paid at the property: confirmed here, then the property accepts it.
  if (booking.serviceType === "ROOM" && booking.status === "AWAITING_PAYMENT") {
    await db.booking.update({ where: { id: booking.id }, data: { status: "PENDING" } });
  }

  // Customer, provider and admins hear now, not when the dates were first held. Never throws.
  if (firstConfirm) await notifyBookingCreated(booking.id);

  if (booking.serviceType === "ROOM") {
    return { status: "redirect", url: `/account/bookings/${reference}` };
  }

  // Without a live gateway the booking stays held and the page explains how to pay.
  if (!pesapalConfigured() || !pesapalIpnId() || !(await paysOnline(booking.serviceType))) {
    return { status: "redirect", url: `/account/bookings/${reference}` };
  }

  try {
    await startCheckout({ bookingId: booking.id, customerId: user.id });
    // Pesapal's form is embedded on our own payment page.
    return { status: "redirect", url: `/checkout/${reference}/pay` };
  } catch (err) {
    if (err instanceof PaymentError) {
      return { status: "error", message: err.message, retryable: err.retryable };
    }
    console.error("[checkout] payment failed to start", err);
    return {
      status: "error",
      message: "We couldn't start that payment. Nothing has been charged — please try again.",
      retryable: true,
    };
  }
}

/** Back to step one: releases the held dates so they can be picked again. */
export async function leaveCheckout(formData: FormData) {
  const user = await getCurrentUser();
  const reference = String(formData.get("reference") ?? "").trim();
  if (!user || !reference) redirect("/");

  const booking = await db.booking.findFirst({
    where: { reference, customerId: user.id },
    select: {
      serviceType: true,
      resourceId: true,
      payments: { where: { status: "SUCCEEDED" }, select: { id: true }, take: 1 },
    },
  });
  // Money has moved: going back must not cancel it.
  if (booking?.payments.length) redirect(`/account/bookings/${reference}`);
  const href = booking
    ? (await resolveBookingSubjectDetails([booking])).get(booking.resourceId)?.href
    : null;

  try {
    await cancelBooking({ reference, customerId: user.id, reason: "Went back to change details" });
    // Licence and ID copies aren't kept for a booking that never happened.
    await db.bookingDocument.deleteMany({ where: { booking: { reference, customerId: user.id } } });
  } catch (err) {
    // Already paid or no longer held: leave it alone and show the booking instead.
    if (!(err instanceof BookingError)) throw err;
    redirect(`/account/bookings/${reference}`);
  }
  revalidatePath("/account/bookings");
  redirect(href ?? "/account/bookings");
}
