import "server-only";
import { getCurrentUser } from "@/lib/session";

/**
 * The company mailbox holds customer correspondence, so only administrators
 * reach it. Re-read from the database on every call, so a demoted account loses
 * access at once instead of when its cookie expires.
 */
export async function mailActor() {
  const user = await getCurrentUser();
  return user && user.role === "ADMIN" ? user : null;
}

/**
 * Route handlers get none of the framework's cross-site protection that server
 * actions have, so a state-changing request must come from our own pages.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
