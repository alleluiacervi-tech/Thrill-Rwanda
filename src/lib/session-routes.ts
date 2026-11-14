/**
 * Role → landing route. Lives in its own module because both server guards
 * (src/lib/session.ts) and client components (the header) need it, and
 * session.ts pulls in server-only imports.
 */
export function homeForRole(role?: string | null) {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "PROVIDER":
      return "/provider";
    default:
      return "/account";
  }
}
