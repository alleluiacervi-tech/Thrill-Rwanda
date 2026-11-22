/**
 * Who must use two-step sign-in. Pure, so the guards, the auth hooks and the
 * tests share one rule.
 *
 * Administrators and staff (sales, operations, finance) must, because they
 * can see customers' details and money (brief §12). Everyone else may turn it
 * on for themselves. TEAM_TWO_FACTOR=optional relaxes the rule, for a local
 * development database only.
 */
export type TwoFactorPerson = { role: string; staffRole?: string | null };

export const isTeam = (p: TwoFactorPerson) => p.role === "ADMIN" || !!p.staffRole;

export function twoFactorRequired(p: TwoFactorPerson, env: string | undefined = process.env.TEAM_TWO_FACTOR) {
  return isTeam(p) && (env !== "optional" || process.env.NODE_ENV === "production");
}

/** Where a team member without two-step sign-in is sent, keeping where they were going. */
export const setupPath = (next?: string) =>
  `/account/security?setup=required${next && next.startsWith("/") && !next.startsWith("//") ? `&next=${encodeURIComponent(next)}` : ""}`;
