import { headers } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { roleLabel } from "@/lib/access";

/**
 * The activity log: who did what, and when.
 *
 * Every change made by an administrator, staff member or provider calls
 * `logActivity` once it has succeeded. Rows are append-only (a database
 * trigger refuses UPDATE and DELETE), and the actor's name, email and access
 * are copied in at the time, so the record stays true even if the account is
 * later renamed, demoted or deleted.
 *
 * Logging never breaks the action it records: if the write fails, the change
 * has already happened, so the failure is reported to the server log instead.
 */

export type ActivityArea =
  | "Access"
  | "Sign-in"
  | "Listings"
  | "Departures"
  | "Venues"
  | "Bookings"
  | "Enquiries"
  | "Quotes"
  | "Finance"
  | "Suppliers"
  | "Providers"
  | "Reviews"
  | "Launch"
  | "Settings"
  | "Content"
  | "Transfers"
  | "Support";

export type ActivityEntry = {
  /** Short machine name: "user.role", "venue.publish". */
  action: string;
  area: ActivityArea;
  /** What was acted on, as people would name it. */
  target?: string | null;
  targetId?: string | null;
  /** One readable sentence. */
  summary: string;
  /** Before and after, where it helps. Never passwords, tokens or card data. */
  changes?: Prisma.InputJsonValue;
};

/** The first address in X-Forwarded-For, or nothing outside a request. */
async function requestIp() {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  } catch {
    return null;
  }
}

export async function logActivity(actorId: string, entry: ActivityEntry) {
  try {
    const actor = await db.user.findUnique({
      where: { id: actorId },
      select: { fullName: true, email: true, role: true, staffRole: true, isSuperAdmin: true },
    });
    await db.activityLog.create({
      data: {
        actorId,
        actorName: actor?.fullName ?? "Unknown account",
        actorEmail: actor?.email ?? "",
        actorRole: actor ? roleLabel(actor) : "Unknown",
        action: entry.action,
        area: entry.area,
        target: entry.target ?? null,
        targetId: entry.targetId ?? null,
        summary: entry.summary.slice(0, 500),
        changes: entry.changes ?? {},
        ip: await requestIp(),
      },
    });
  } catch (err) {
    console.error("[activity] could not record", entry.action, err);
  }
}

/** "Draft" → "Published"; skipped when nothing changed. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, value] of Object.entries(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(value)) out[key] = { from: before[key] ?? null, to: value ?? null };
  }
  return out as Prisma.InputJsonValue;
}

/** For actions whose guard returns a scope rather than the person: logs as whoever is signed in. */
export async function logActivityAsCurrentUser(entry: ActivityEntry) {
  const { getCurrentUser } = await import("@/lib/session");
  const me = await getCurrentUser();
  if (me) await logActivity(me.id, entry);
}
