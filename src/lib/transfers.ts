import { cache } from "react";
import { db } from "@/lib/db";
import { splitAreas, type PublicZone } from "@/lib/transfer-zones-shared";

// Server-side reads of the transfer zone prices. The public site only ever
// sees active zones, in the order the admin chose.

export const listActiveZones = cache(async (): Promise<PublicZone[]> => {
  // The homepage reads these too; a failed read leaves transfers as requests rather than taking the page down.
  const rows = await db.transferZone
    .findMany({
      where: { isActive: true },
      orderBy: [{ origin: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    })
    .catch((err) => {
      console.error("[transfers] zone read failed", err);
      return [];
    });
  return rows.map((r) => ({
    id: r.id,
    origin: r.origin,
    name: r.name,
    areas: splitAreas(r.areas),
    distance: r.distance,
    sedanMinor: r.sedanMinor,
    vanMinor: r.vanMinor,
    premiumMinor: r.premiumMinor,
  }));
});
