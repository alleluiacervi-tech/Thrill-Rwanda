import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { layouts, meetingSpaces, meetingVenues, spaceTypes, type MeetingSpace, type MeetingVenue } from "@/lib/meeting-directory";

export async function readBusinessVenues(onlyPublished: boolean) {
  try {
    return await db.businessVenue.findMany({
      where: onlyPublished ? { isPublished: true, spaces: { some: { isPublished: true } } } : undefined,
      include: {
        spaces: { where: onlyPublished ? { isPublished: true } : undefined, orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2021") throw error;

    console.warn("Business venue catalogue tables are missing. Apply the business venue migration.");
    return null;
  }
}

export async function publicBusinessVenueCatalogue() {
  const properties = (await readBusinessVenues(true)) ?? [];
  const venues: MeetingVenue[] = [...meetingVenues];
  const spaces: MeetingSpace[] = [...meetingSpaces];
  for (const property of properties) {
    if (property.kind !== "Hotel" && property.kind !== "Convention centre") continue;
    venues.push({
      slug: property.slug,
      name: property.name,
      kind: property.kind,
      description: property.description,
      source: property.source ?? undefined,
      image: property.image ?? undefined,
    });
    for (const room of property.spaces) {
      const type = spaceTypes.find((value) => value === room.type);
      if (!type) continue;
      const stored = room.capacities as Partial<Record<string, unknown>>;
      spaces.push({
        id: room.id,
        venue: property.slug,
        name: room.name,
        type,
        capacities: Object.fromEntries(layouts.flatMap((layout) => {
          const value = stored?.[layout];
          return typeof value === "number" && value > 0 ? [[layout, value]] : [];
        })),
        publishedMaximum: room.maximum ?? undefined,
        features: room.features ?? undefined,
      });
    }
  }
  return { venues, spaces };
}
