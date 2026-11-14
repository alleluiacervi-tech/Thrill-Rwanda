import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { homeForRole } from "@/lib/session-routes";
import type { ProviderKind, Role } from "@/generated/prisma/enums";

/**
 * Server-side session + role guards.
 *
 * Step 18's rule: a provider must only ever see their own data. The way that
 * is enforced here is that `requireProvider()` derives the provider id from
 * the SESSION and returns it. Route handlers and queries must scope on that
 * returned id — never on an id taken from params, body or query string.
 *
 * Every guard redirects rather than throwing, so a logged-out visitor lands
 * on sign-in with a `next` param instead of seeing an error page.
 */

/** Deduped per request — several components can call this without refetching. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

function signInRedirect(next: string): never {
  redirect(`/sign-in?next=${encodeURIComponent(next)}`);
}

/** Any signed-in, active user. */
export async function requireUser(next = "/account") {
  const session = await getSession();
  if (!session?.user) signInRedirect(next);

  // A deactivated account keeps its rows but must not act.
  if (session.user.isActive === false) {
    redirect("/suspended");
  }
  return session.user;
}

export async function requireRole(role: Role, next: string) {
  const user = await requireUser(next);
  if (user.role !== role) redirect("/account?denied=1");
  return user;
}

/**
 * Returns the signed-in provider's own record. The returned `providerId` is
 * the ONLY id that provider-scoped queries may filter on.
 */
export async function requireProvider(next = "/provider") {
  const user = await requireUser(next);
  if (user.role !== "PROVIDER" && user.role !== "ADMIN") {
    // Approval updates the role in the DB, but the session cookie can hold the old one for up to 5 minutes.
    const fresh = await db.user.findUnique({ where: { id: user.id }, select: { role: true } });
    if (fresh?.role !== "PROVIDER") redirect("/account?denied=1");
  }

  const provider = await db.provider.findUnique({
    where: { userId: user.id },
    select: { id: true, businessName: true, status: true, slug: true, kind: true, kinds: true },
  });

  // A PROVIDER role with no provider row means the application was never
  // completed — send them to finish it rather than to an empty dashboard.
  if (!provider) redirect("/provider/apply");
  if (provider.status !== "VERIFIED") redirect("/provider/pending");

  return { user, provider, providerId: provider.id, kinds: providerKinds(provider) };
}

/**
 * The categories a provider may list in.
 *
 * `kinds` is the approved set; an empty one means the record predates
 * multi-category approval, so it falls back to the single `kind` they applied
 * under. It never defaults to everything — that is the bug this prevents.
 */
export function providerKinds(provider: {
  kind: ProviderKind;
  kinds: ProviderKind[];
}): ProviderKind[] {
  return provider.kinds.length > 0 ? provider.kinds : [provider.kind];
}

/**
 * Guards a listing route by category.
 *
 * Enforced on the server, not just by hiding buttons: a hotel owner who
 * guesses /provider/listings/vehicles/new has to be turned away too.
 */
export async function requireProviderFor(
  kind: ProviderKind,
  next = "/provider/listings",
) {
  const session = await requireProvider(next);
  if (!session.kinds.includes(kind)) {
    redirect(`/provider/listings?denied=${kind.toLowerCase()}`);
  }
  return session;
}

export async function requireAdmin(next = "/admin") {
  return requireRole("ADMIN", next);
}

/** Thrown when an admin submits a listing without a usable provider. */
export class ListingOwnerError extends Error {}

// Owner of a NEW listing. The form's `providerId` is honoured for an admin
// and for nobody else — a provider naming another provider must never take.
export async function resolveListingOwner(
  formData: FormData,
  next = "/provider/listings",
  /** The category being listed. The owner must be approved for it. */
  kind?: ProviderKind,
): Promise<{ providerId: string; onBehalf: boolean }> {
  const user = await requireUser(next);

  if (user.role === "ADMIN") {
    const id = String(formData.get("providerId") ?? "").trim();
    if (!id) {
      throw new ListingOwnerError("Choose which provider this listing belongs to.");
    }

    // Verified only — a pending account isn't cleared to trade.
    const provider = await db.provider.findFirst({
      where: { id, status: "VERIFIED" },
      select: { id: true, kind: true, kinds: true, businessName: true },
    });
    if (!provider) {
      throw new ListingOwnerError("That provider doesn't exist or isn't verified.");
    }
    // Checked for admins too: approving a hotel shouldn't quietly allow cars.
    if (kind && !providerKinds(provider).includes(kind)) {
      throw new ListingOwnerError(
        `${provider.businessName} isn't approved for this category. Change their categories first.`,
      );
    }
    return { providerId: provider.id, onBehalf: true };
  }

  const session = await requireProvider(next);
  if (kind && !session.kinds.includes(kind)) {
    throw new ListingOwnerError("Your account isn't approved to list in this category.");
  }
  return { providerId: session.providerId, onBehalf: false };
}

// Scope for an EXISTING listing. A union, not `providerId?: string`: an
// optional id lets a bug drop the owner filter and expose every listing.
export type ListingScope =
  | { kind: "admin" }
  | { kind: "provider"; providerId: string };

export async function resolveListingScope(
  next = "/provider/listings",
): Promise<ListingScope> {
  const user = await requireUser(next);
  // An admin acts across the platform: moderating a listing is the job.
  if (user.role === "ADMIN") return { kind: "admin" };

  const { providerId } = await requireProvider(next);
  return { kind: "provider", providerId };
}

/** The owner filter for a scope — empty for an admin, pinned for a provider. */
export function scopeFilter(scope: ListingScope) {
  return scope.kind === "admin" ? {} : { providerId: scope.providerId };
}

/** For pages that should bounce an already-signed-in visitor (sign-in/up). */
/** Where a user lands after signing in: their role's home, or the application status page for a provider applicant. */
export async function landingPath(user: { id: string; role?: string | null }) {
  if (user.role === "ADMIN") return "/admin";
  const provider = await db.provider.findUnique({ where: { userId: user.id }, select: { status: true } });
  if (!provider) return homeForRole(user.role);
  return provider.status === "VERIFIED" ? "/provider" : "/provider/pending";
}

export async function redirectIfAuthenticated(to?: string) {
  const session = await getSession();
  if (session?.user) redirect(to ?? (await landingPath(session.user)));
}

// Re-exported so server code can import it from the same place as the guards.
export { homeForRole };

/**
 * The dashboards this person may open. A provider is always a customer too,
 * and an admin may be both — switching used to mean signing out and back in.
 */
export async function workspacesFor(
  user: { id: string; role?: string | null },
  current: "customer" | "provider" | "admin",
) {
  const provider = await db.provider.findUnique({
    where: { userId: user.id },
    select: { status: true },
  });

  return [
    { label: "Customer", href: "/account", current: current === "customer" },
    // Pending and rejected applicants keep the link: it leads to their status page.
    ...(provider ? [{ label: "Provider", href: "/provider", current: current === "provider" }] : []),
    ...(user.role === "ADMIN" ? [{ label: "Admin", href: "/admin", current: current === "admin" }] : []),
  ];
}
