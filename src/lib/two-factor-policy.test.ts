import { describe, expect, it, vi } from "vitest";
import { isTeam, setupPath, twoFactorRequired } from "./two-factor-policy";

describe("who must use two-step sign-in", () => {
  it("requires it of administrators and every staff role", () => {
    expect(twoFactorRequired({ role: "ADMIN" }, undefined)).toBe(true);
    for (const staffRole of ["SALES", "OPERATIONS", "FINANCE"])
      expect(twoFactorRequired({ role: "CUSTOMER", staffRole }, undefined)).toBe(true);
  });
  it("leaves it optional for customers and providers", () => {
    expect(twoFactorRequired({ role: "CUSTOMER" }, undefined)).toBe(false);
    expect(twoFactorRequired({ role: "PROVIDER" }, undefined)).toBe(false);
    expect(isTeam({ role: "PROVIDER", staffRole: null })).toBe(false);
  });
  it("can be relaxed for local development only by an explicit switch", () => {
    expect(twoFactorRequired({ role: "ADMIN" }, "optional")).toBe(false);
    expect(twoFactorRequired({ role: "ADMIN" }, "required")).toBe(true);
    expect(twoFactorRequired({ role: "ADMIN" }, "")).toBe(true);
  });
  it("keeps the requirement in a deployed build even with the optional switch", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(twoFactorRequired({ role: "ADMIN" }, "optional")).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("sends people to set it up and back to where they were going, never off-site", () => {
    expect(setupPath("/admin/users")).toBe("/account/security?setup=required&next=%2Fadmin%2Fusers");
    expect(setupPath("//evil.example")).toBe("/account/security?setup=required");
    expect(setupPath()).toBe("/account/security?setup=required");
  });
});
