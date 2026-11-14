"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, landingPath, requireUser } from "@/lib/session";

/** Customer account actions (Step 11). All scoped to the session user. */

export type AccountState = { status: "idle" | "error" | "ok"; message?: string };

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your name").max(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
});

export async function updateAccountProfile(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check those details." };
  }

  // Email and role are deliberately not editable here: email changes need
  // re-verification, and role is an admin action.
  await db.user.update({
    where: { id: user.id },
    data: { fullName: parsed.data.fullName, phone: parsed.data.phone || null },
  });

  revalidatePath("/account/profile");
  revalidatePath("/admin/profile");
  return { status: "ok", message: "Profile saved." };
}

// Only the dashboards show notification counts; revalidating '/' would also throw away the public catalogue cache.
function refreshDashboards() {
  revalidatePath("/account", "layout");
  revalidatePath("/provider", "layout");
  revalidatePath("/admin", "layout");
}

export async function markNotificationsRead(
  _prev: AccountState,
  _formData: FormData,
): Promise<AccountState> {
  await markAllNotificationsRead();
  return { status: "ok" };
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  refreshDashboards();
}

/** Marks one of the signed-in user's own notifications read; another user's id matches nothing. */
export async function markNotificationRead(id: string) {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(id).success) return;
  await db.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  refreshDashboards();
}

export type NotificationPreview = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
  read: boolean;
};

/** The newest few for the header dropdown, fetched when it opens so it is never stale. */
export async function latestNotifications(): Promise<{ items: NotificationPreview[]; unread: number }> {
  const user = await requireUser();
  const [rows, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true, body: true, href: true, createdAt: true, readAt: true },
    }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return {
    unread,
    items: rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      href: n.href,
      createdAt: n.createdAt.toISOString(),
      read: n.readAt !== null,
    })),
  };
}

/** Where the just-signed-in user should land; read from the new session cookie. */
export async function postSignInPath() {
  const user = await getCurrentUser();
  return user ? landingPath(user) : "/account";
}
