import { db } from "@/lib/db";

/**
 * The public venue catalogue: published venues only. Read on each request to
 * /weddings, which is already rendered per visit for its request form.
 */

export type PublicVenue = {
  slug: string;
  name: string;
  kind: string;
  location: string;
  capacity: number;
  description: string;
  features: string[];
  image?: string;
};

const select = {
  slug: true,
  name: true,
  kind: true,
  location: true,
  capacity: true,
  description: true,
  features: true,
  images: true,
} as const;

const toPublic = ({ images, ...venue }: { images: string[] } & Omit<PublicVenue, "image">): PublicVenue => ({
  ...venue,
  image: images[0],
});

/** Published venues, largest first: the big rooms are the hardest to find. */
export async function listVenues(): Promise<PublicVenue[]> {
  const rows = await db.venue.findMany({
    where: { isPublished: true },
    orderBy: [{ capacity: "desc" }, { name: "asc" }],
    select,
  });
  return rows.map(toPublic);
}

/** One published venue by slug, or null. A draft is never returned. */
export async function publishedVenue(slug: string): Promise<PublicVenue | null> {
  if (!/^[a-z0-9-]{1,140}$/.test(slug)) return null;
  const row = await db.venue.findFirst({ where: { slug, isPublished: true }, select });
  return row ? toPublic(row) : null;
}
