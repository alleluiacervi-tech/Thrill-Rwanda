import { cache } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  publicationMap,
  serviceFor,
  type PublicService,
} from "@/lib/launch-rules";
export const getPublications = cache(async () =>
  publicationMap(await db.servicePublication.findMany()),
);
export async function requirePublicService(service: PublicService) {
  const mode = (await getPublications())[service];
  if (mode === "HIDDEN") notFound();
  return mode;
}
export async function directBookingEnabled(type: string) {
  const service = serviceFor(type);
  return !!service && (await getPublications())[service] === "DIRECT";
}
