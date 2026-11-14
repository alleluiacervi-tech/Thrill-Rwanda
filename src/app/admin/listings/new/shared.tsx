import type { ProviderOption } from "@/components/dashboard/listing-fields";
import { db } from "@/lib/db";

// Verified only, matching the check resolveListingOwner re-runs on submit —
// offering a pending provider would present a choice the action refuses.
export async function verifiedProviders(): Promise<ProviderOption[]> {
  return db.provider.findMany({
    where: { status: "VERIFIED" },
    orderBy: { businessName: "asc" },
    select: { id: true, businessName: true, kind: true },
  });
}

// Passed to DashboardHead's `back`, so the link sits inside the white band.
export const backToListings = { href: "/admin/listings", label: "Back to listings" };
