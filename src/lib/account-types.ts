/**
 * Sign-up account types.
 *
 * Lives here rather than in the server action because a `"use server"` file
 * may only export async functions — exporting this const from there is a
 * build error ("can only export async functions, found object"). Types are
 * erased and would have been fine; values are not.
 */
export const ACCOUNT_TYPES = ["CLIENT", "CAR", "HOTEL"] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Provider-shaped account types map onto the ProviderKind enum. */
export function providerKindFor(type: AccountType) {
  return type === "CAR" ? "CAR" : type === "HOTEL" ? "HOTEL" : null;
}
