"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { accessRefusal } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";

/**
 * Trusted devices and two-step resets.
 *
 * Better Auth stores each "trust this device" grant as a verification row
 * named trust-device-<random> whose value is the user id. Deleting those rows
 * makes every device ask for a code again at its next sign-in.
 */

export type SecurityState = { status: "idle" | "error" | "ok"; message?: string };

const trustedRows = (userId: string) => ({
  identifier: { startsWith: "trust-device-" },
  value: userId,
});

export async function forgetTrustedDevices(_prev: SecurityState): Promise<SecurityState> {
  const me = await requireUser("/account/security");
  const { count } = await db.verification.deleteMany({ where: trustedRows(me.id) });
  await logActivity(me.id, {
    action: "auth.forget_devices",
    area: "Sign-in",
    targetId: me.id,
    summary: `Stopped trusting ${count} ${count === 1 ? "device" : "devices"}; every device will ask for a code again`,
  });
  revalidatePath("/account/security");
  return {
    status: "ok",
    message: count
      ? `Done. ${count} ${count === 1 ? "device" : "devices"} will ask for a code at the next sign-in.`
      : "No device was trusted.",
  };
}

/**
 * For someone who has lost their phone and backup codes. A super admin
 * removes their authenticator, forgets their devices and signs them out; at
 * their next sign-in they are asked to set two-step sign-in up again.
 */
export async function resetTwoFactor(_prev: SecurityState, form: FormData): Promise<SecurityState> {
  const session = await requireAdmin("/admin/users");
  const userId = z.string().uuid().safeParse(form.get("userId"));
  if (!userId.success) return { status: "error", message: "That account reference isn't valid." };

  const [actor, person] = await Promise.all([
    db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, staffRole: true, isSuperAdmin: true } }),
    db.user.findUnique({
      where: { id: userId.data },
      select: { id: true, fullName: true, role: true, staffRole: true, isSuperAdmin: true, isActive: true },
    }),
  ]);
  if (!actor || !person) return { status: "error", message: "That account no longer exists." };
  // The same authority as any access change: a super admin, and never on themselves.
  const refusal = accessRefusal(actor, person, { kind: "staffRole", staffRole: person.staffRole ?? null }, 1);
  if (refusal) return { status: "error", message: refusal };
  if (actor.id === person.id)
    return { status: "error", message: "Ask another super admin to reset your own two-step sign-in." };

  await db.$transaction([
    db.twoFactor.deleteMany({ where: { userId: person.id } }),
    db.user.update({ where: { id: person.id }, data: { twoFactorEnabled: false } }),
    db.verification.deleteMany({ where: trustedRows(person.id) }),
    db.session.deleteMany({ where: { userId: person.id } }),
  ]);
  await logActivity(actor.id, {
    action: "auth.two_factor_reset",
    area: "Access",
    target: person.fullName,
    targetId: person.id,
    summary: `Reset ${person.fullName}'s two-step sign-in and signed them out; they will set it up again at their next sign-in`,
  });
  revalidatePath("/admin/users");
  return { status: "ok", message: `${person.fullName} will set up two-step sign-in again at their next sign-in.` };
}
