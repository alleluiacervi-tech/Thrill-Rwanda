"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { accessRefusal, roleLabel, type AccessChange } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

/**
 * Granting and removing access: the super admin's job.
 *
 * Every change here goes through one path:
 *   1. the actor is re-read from the database (a stale session cannot act),
 *   2. the target row is locked, so two super admins cannot race,
 *   3. the rules in src/lib/access.ts decide,
 *   4. the change and its activity-log entry are written.
 */

export type AccessState = { status: "idle" | "error" | "ok"; message?: string };

const fail = (message: string): AccessState => ({ status: "error", message });

class Refused extends Error {}

const schemas = {
  role: z.object({ userId: z.string().uuid(), role: z.enum(["CUSTOMER", "PROVIDER", "ADMIN"]) }),
  staffRole: z.object({ userId: z.string().uuid(), staffRole: z.enum(["SALES", "OPERATIONS", "FINANCE", ""]) }),
  superAdmin: z.object({ userId: z.string().uuid(), on: z.enum(["true", "false"]) }),
  active: z.object({ userId: z.string().uuid(), on: z.enum(["true", "false"]) }),
};

const describe = (change: AccessChange) => {
  switch (change.kind) {
    case "role":
      return `role ${change.role.toLowerCase()}`;
    case "staffRole":
      return change.staffRole ? `staff access ${change.staffRole.toLowerCase()}` : "no staff access";
    case "superAdmin":
      return change.on ? "super admin" : "no super admin";
    case "active":
      return change.on ? "active" : "deactivated";
  }
};

async function apply(userId: string, change: AccessChange): Promise<AccessState> {
  const session = await requireAdmin("/admin/users");

  let summary = "";
  let target = "";
  let before: Record<string, unknown> = {};
  let after: Record<string, unknown> = {};
  try {
    await db.$transaction(async (tx) => {
      const actor = await tx.user.findUnique({
        where: { id: session.id },
        select: { id: true, role: true, staffRole: true, isSuperAdmin: true, isActive: true },
      });
      if (!actor?.isActive) throw new Refused("Your account can no longer change access.");

      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const person = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true, fullName: true, role: true, staffRole: true, isSuperAdmin: true, isActive: true,
          provider: { select: { id: true } },
        },
      });
      if (!person) throw new Refused("That account no longer exists.");

      const othersSuper = await tx.user.count({
        where: { role: "ADMIN", isSuperAdmin: true, isActive: true, id: { not: person.id } },
      });
      const refusal = accessRefusal(actor, person, change, othersSuper);
      if (refusal) throw new Refused(refusal);

      // Promoting to PROVIDER without a provider record would leave them on
      // /provider/apply with no way forward, so say so rather than doing it.
      if (change.kind === "role" && change.role === "PROVIDER" && !person.provider)
        throw new Refused("That user has no provider record yet. Use “Make provider…” to create one.");

      const data =
        change.kind === "role"
          ? // Leaving the administrator role takes super admin with it.
            { role: change.role as "CUSTOMER" | "PROVIDER" | "ADMIN", ...(change.role !== "ADMIN" ? { isSuperAdmin: false } : {}) }
          : change.kind === "staffRole"
            ? { staffRole: (change.staffRole || null) as "SALES" | "OPERATIONS" | "FINANCE" | null }
            : change.kind === "superAdmin"
              ? { isSuperAdmin: change.on }
              : { isActive: change.on };
      if (change.kind === "staffRole" && change.staffRole && !person.isActive)
        throw new Refused("Reactivate this account before giving it staff access.");

      const updated = await tx.user.update({
        where: { id: person.id },
        data,
        select: { role: true, staffRole: true, isSuperAdmin: true, isActive: true },
      });

      // The staff-access register kept by the enquiry workflow, as before.
      if (change.kind === "staffRole")
        await tx.staffAccessChange.create({
          data: { actorId: actor.id, targetId: person.id, previousRole: person.staffRole, nextRole: updated.staffRole },
        });

      // A deactivated account is signed out everywhere at once.
      if (change.kind === "active" && !change.on) await tx.session.deleteMany({ where: { userId: person.id } });

      target = person.fullName;
      before = { access: roleLabel(person), active: person.isActive };
      after = { access: roleLabel(updated), active: updated.isActive };
      summary =
        change.kind === "active"
          ? change.on
            ? `Reactivated ${person.fullName}'s account`
            : `Deactivated ${person.fullName}'s account and signed them out`
          : `Changed ${person.fullName}'s access from ${roleLabel(person)} to ${roleLabel(updated)}`;
    });
  } catch (err) {
    if (err instanceof Refused) return fail(err.message);
    console.error("[access] change failed", err);
    return fail("Could not change access. Please try again.");
  }

  await logActivity(session.id, {
    action: `access.${change.kind}`,
    area: "Access",
    target,
    targetId: userId,
    summary,
    changes: { before, after, requested: describe(change) } as never,
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/activity");
  revalidatePath("/staff/enquiries");
  return { status: "ok", message: summary + "." };
}

export async function setRole(_prev: AccessState, form: FormData) {
  const p = schemas.role.safeParse(Object.fromEntries(form));
  return p.success ? apply(p.data.userId, { kind: "role", role: p.data.role }) : fail("That role isn't valid.");
}

export async function setStaffRole(_prev: AccessState, form: FormData) {
  const p = schemas.staffRole.safeParse(Object.fromEntries(form));
  return p.success
    ? apply(p.data.userId, { kind: "staffRole", staffRole: p.data.staffRole || null })
    : fail("Choose a valid staff permission.");
}

export async function setSuperAdmin(_prev: AccessState, form: FormData) {
  const p = schemas.superAdmin.safeParse(Object.fromEntries(form));
  return p.success ? apply(p.data.userId, { kind: "superAdmin", on: p.data.on === "true" }) : fail("That change isn't valid.");
}

export async function setActive(_prev: AccessState, form: FormData) {
  const p = schemas.active.safeParse(Object.fromEntries(form));
  return p.success ? apply(p.data.userId, { kind: "active", on: p.data.on === "true" }) : fail("That change isn't valid.");
}
