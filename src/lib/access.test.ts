import { describe, expect, it } from "vitest";
import { accessRefusal, isSuperAdmin, roleLabel } from "./access";

const superA = { id: "a", role: "ADMIN", isSuperAdmin: true };
const superB = { id: "b", role: "ADMIN", isSuperAdmin: true, isActive: true };
const admin = { id: "c", role: "ADMIN", isSuperAdmin: false, isActive: true };
const sales = { id: "d", role: "CUSTOMER", staffRole: "SALES", isActive: true };

describe("who may change access", () => {
  it("names access the way people say it", () => {
    expect(roleLabel(superA)).toBe("Super admin");
    expect(roleLabel(admin)).toBe("Admin");
    expect(roleLabel(sales)).toBe("Sales");
    expect(roleLabel({ role: "PROVIDER" })).toBe("Provider");
    expect(isSuperAdmin(admin)).toBe(false);
    // The flag means nothing without the administrator role.
    expect(isSuperAdmin({ role: "CUSTOMER", isSuperAdmin: true })).toBe(false);
  });

  it("lets a super admin grant every kind of access", () => {
    expect(accessRefusal(superA, sales, { kind: "role", role: "ADMIN" }, 1)).toBeNull();
    expect(accessRefusal(superA, sales, { kind: "staffRole", staffRole: "FINANCE" }, 1)).toBeNull();
    expect(accessRefusal(superA, admin, { kind: "superAdmin", on: true }, 1)).toBeNull();
    expect(accessRefusal(superA, admin, { kind: "active", on: false }, 1)).toBeNull();
    expect(accessRefusal(superA, superB, { kind: "superAdmin", on: false }, 1)).toBeNull();
  });

  it("refuses every access change by an ordinary administrator or staff", () => {
    for (const actor of [admin, sales])
      for (const change of [
        { kind: "role", role: "ADMIN" },
        { kind: "staffRole", staffRole: "SALES" },
        { kind: "superAdmin", on: true },
        { kind: "active", on: false },
      ] as const)
        expect(accessRefusal(actor, sales, change, 1)).toMatch(/Only a super admin/);
  });

  it("never lets a super admin lock themselves out", () => {
    expect(accessRefusal(superA, superA, { kind: "active", on: false }, 1)).toMatch(/your own account/);
    expect(accessRefusal(superA, superA, { kind: "superAdmin", on: false }, 1)).toMatch(/your own super admin/);
    expect(accessRefusal(superA, superA, { kind: "role", role: "CUSTOMER" }, 1)).toMatch(/your own super admin/);
  });

  it("keeps at least one active super admin", () => {
    expect(accessRefusal(superA, superB, { kind: "superAdmin", on: false }, 0)).toMatch(/At least one/);
    expect(accessRefusal(superA, superB, { kind: "role", role: "CUSTOMER" }, 0)).toMatch(/At least one/);
    expect(accessRefusal(superA, superB, { kind: "active", on: false }, 0)).toMatch(/At least one/);
  });

  it("makes super admin an extra on top of administrator, for an active account", () => {
    expect(accessRefusal(superA, sales, { kind: "superAdmin", on: true }, 1)).toMatch(/administrator first/);
    expect(accessRefusal(superA, { ...admin, isActive: false }, { kind: "superAdmin", on: true }, 1)).toMatch(/Reactivate/);
  });
});
