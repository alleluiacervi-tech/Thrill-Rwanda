import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Two jobs:
 *
 * 1. Expose the resolved pathname as `x-pathname` so server layouts can
 *    highlight the active nav item without becoming client components.
 *
 * 2. Bounce obviously-signed-out traffic away from the dashboards before it
 *    reaches a server component. This is an OPTIMISATION, not the security
 *    boundary — it only checks that a session cookie exists, not that it is
 *    valid or what role it carries. The real checks are `requireUser`,
 *    `requireProvider` and `requireAdmin` in src/lib/session.ts, which hit
 *    the database on every protected render.
 */
const PROTECTED = ["/account", "/provider", "/admin", "/staff"];

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  // The admin sidebar has entries that differ only by query string
  // (`/admin/providers?status=PENDING`), so the active one cannot be
  // identified from the pathname alone.
  headers.set("x-search", search);

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const cookie = getSessionCookie(request);
    if (!cookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    // Everything except static assets and the auth API itself.
    "/((?!_next/static|_next/image|favicon.ico|api/auth|robots.txt|sitemap.xml).*)",
  ],
};
