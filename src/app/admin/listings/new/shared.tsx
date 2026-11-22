import type { ProviderOption } from "@/components/dashboard/listing-fields";
import { db } from "@/lib/db";
import { providerKinds } from "@/lib/session";

// Verified only, matching the check resolveListingOwner re-runs on submit —
// offering a pending provider would present a choice the action refuses.
export async function verifiedProviders(kind: ProviderOption["kind"]): Promise<ProviderOption[]> {
  const providers = await db.provider.findMany({
    where: { status: "VERIFIED" },
    orderBy: { businessName: "asc" },
    select: { id: true, businessName: true, kind: true, kinds: true },
  });
  return providers
    .filter((provider) => providerKinds(provider).includes(kind))
    .map(({ id, businessName }) => ({ id, businessName, kind }));
}

// Passed to DashboardHead's `back`, so the link sits inside the white band.
export const backToListings = { href: "/admin/listings", label: "Back to listings" };
