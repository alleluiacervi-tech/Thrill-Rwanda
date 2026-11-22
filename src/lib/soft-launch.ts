import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canUseEnquiries } from "@/lib/enquiry-workflow";
export async function isSoftLaunchParticipant(id: string) {
  const user = await db.user.findUnique({ where: { id } });
  if (!user?.isActive) return false;
  if (canUseEnquiries(user)) return true;
  return !!(
    (await db.clientCaseAccess.findFirst({
      where: { userId: id, active: true },
      select: { id: true },
    })) ||
    (await db.corporateMember.findFirst({
      where: { userId: id, active: true, account: { active: true } },
      select: { id: true },
    }))
  );
}
export async function publicPreviewAllowed() {
  if (process.env.SOFT_LAUNCH_PRIVATE !== "true") return true;
  const user = await getCurrentUser();
  return !!user && isSoftLaunchParticipant(user.id);
}
export const previewExemptPath = (path: string) =>
  [
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
    "/soft-launch",
    "/suspended",
    "/account",
    "/admin",
    "/staff",
    "/provider",
    "/checkout",
    "/pay",
    "/payments/status",
  ].some((p) => path === p || path.startsWith(p + "/"));
