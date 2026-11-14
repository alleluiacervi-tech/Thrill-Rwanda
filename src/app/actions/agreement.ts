"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { agreementForBooking } from "@/lib/agreement-booking";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * Signing the car hire agreement.
 *
 * The text is rebuilt on the server and stored with the signature, so what is
 * kept is what was agreed — not a copy the browser could have altered, and
 * not a reference to a template that may be edited later.
 */

export type SignState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "signed" };

// A drawn signature is a small PNG. The cap stops a pasted image of any size.
const MAX_SIGNATURE_BYTES = 400_000;

const schema = z.object({
  reference: z.string().trim().min(3).max(20),
  signedName: z.string().trim().min(3, "Type your full name as it appears on your licence").max(120),
  signature: z
    .string()
    .startsWith("data:image/png;base64,", "Please draw your signature in the box")
    .max(MAX_SIGNATURE_BYTES, "That signature image is too large"),
});

export async function signAgreement(_prev: SignState, formData: FormData): Promise<SignState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Please sign in again." };

  const parsed = schema.safeParse({
    reference: formData.get("reference"),
    signedName: formData.get("signedName"),
    signature: formData.get("signature"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const { reference, signedName, signature } = parsed.data;

  const booking = await db.booking.findFirst({
    where: { reference, customerId: user.id },
    select: {
      id: true,
      reference: true,
      serviceType: true,
      resourceId: true,
      startDate: true,
      endDate: true,
      totalMinor: true,
      currency: true,
      details: true,
      customer: { select: { fullName: true, email: true, phone: true } },
      provider: { select: { businessName: true } },
      agreement: { select: { id: true } },
    },
  });

  if (!booking) return { status: "error", message: "We couldn't find that booking." };
  if (booking.serviceType !== "VEHICLE") {
    return { status: "error", message: "This agreement applies to car hire only." };
  }
  if (booking.agreement) {
    return { status: "error", message: "This agreement has already been signed." };
  }

  const agreement = await agreementForBooking(booking.id);
  if (!agreement) return { status: "error", message: "We couldn't find that booking." };

  const head = await headers();

  try {
    await db.bookingAgreement.create({
      data: {
        bookingId: booking.id,
        version: agreement.version,
        body: agreement.body,
        signature,
        signedName,
        // Kept for a dispute: who signed, and from where.
        ipAddress: head.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: head.get("user-agent")?.slice(0, 500) ?? null,
      },
    });
  } catch (err) {
    console.error("[agreement] save failed", err);
    return { status: "error", message: "We couldn't save that signature. Please try again." };
  }

  revalidatePath(`/account/bookings/${reference}`);
  return { status: "signed" };
}
