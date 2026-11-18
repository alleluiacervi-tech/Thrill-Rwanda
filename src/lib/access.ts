/**
 * Who may do what with other people's access. Pure, so the rules can be
 * tested and shared by the user list, the actions and the activity log.
 *
 * - A super admin has full access, including granting and removing access
 *   for everyone (roles, staff permissions, super admin, deactivation).
 * - Other administrators run the business but cannot change anyone's access.
 * - At least one active super admin must always remain, and nobody can remove
 *   their own super admin access or deactivate themselves.
 */

export type AccessPerson = {
  role: string;
  staffRole?: string | null;
  isSuperAdmin?: boolean;
};

/** How a person's access is named on screen and in the activity log. */
export function roleLabel(p: AccessPerson) {
  if (p.role === "ADMIN") return p.isSuperAdmin ? "Super admin" : "Admin";
  if (p.staffRole) return p.staffRole[0] + p.staffRole.slice(1).toLowerCase();
  return p.role[0] + p.role.slice(1).toLowerCase();
}

export const isSuperAdmin = (p: AccessPerson | null | undefined) =>
  !!p && p.role === "ADMIN" && !!p.isSuperAdmin;

export type AccessChange =
  | { kind: "role"; role: string }
  | { kind: "staffRole"; staffRole: string | null }
  | { kind: "superAdmin"; on: boolean }
  | { kind: "active"; on: boolean };

/**
 * Why `actor` may not make `change` to `target`, or null when it may.
 * `superAdminsLeft` is the number of active super admins other than the target.
 */
export function accessRefusal(
  actor: AccessPerson & { id: string },
  target: AccessPerson & { id: string; isActive?: boolean },
  change: AccessChange,
  superAdminsLeft: number,
): string | null {
  if (!isSuperAdmin(actor)) return "Only a super admin can change someone's access.";

  const self = actor.id === target.id;
  const targetIsSuper = isSuperAdmin(target);
  const removesSuper =
    targetIsSuper &&
    ((change.kind === "superAdmin" && !change.on) ||
      (change.kind === "role" && change.role !== "ADMIN") ||
      (change.kind === "active" && !change.on));

  if (self && change.kind === "active" && !change.on) return "You can't deactivate your own account.";
  if (self && removesSuper) return "You can't remove your own super admin access. Ask another super admin.";
  if (removesSuper && superAdminsLeft < 1) return "At least one active super admin must remain.";
  if (change.kind === "superAdmin" && change.on && target.role !== "ADMIN")
    return "Make this person an administrator first.";
  if (change.kind === "superAdmin" && change.on && target.isActive === false)
    return "Reactivate this account first.";
  return null;
}
