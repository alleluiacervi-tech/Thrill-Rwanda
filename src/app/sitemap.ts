import type { MetadataRoute } from "next";
import { listHotels, listTours, listVehicles } from "@/lib/catalogue";
import { site } from "@/lib/site";

// Step 19. Built from the live catalogue, refreshed hourly.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const url = (path: string) => `${site.url}${path}`;

  const staticRoutes: MetadataRoute.Sitemap = [
    { path: "/", priority: 1, changeFrequency: "daily" as const },
    { path: "/enquire", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/flights", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/tours", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/hotels", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/cars", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/transfers", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/corporate", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/about", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/contact", priority: 0.6, changeFrequency: "monthly" as const },
  ].map((r) => ({
    url: url(r.path),
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // A database hiccup still yields a valid sitemap of the fixed pages.
  const [tours, hotels, vehicles] = await Promise.all([listTours(), listHotels(), listVehicles()]).catch(
    () => [[], [], []] as [Awaited<ReturnType<typeof listTours>>, Awaited<ReturnType<typeof listHotels>>, Awaited<ReturnType<typeof listVehicles>>],
  );

  const tourRoutes: MetadataRoute.Sitemap = tours.map((t) => ({
    url: url(`/tours/${t.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const hotelRoutes: MetadataRoute.Sitemap = hotels.map((h) => ({
    url: url(`/hotels/${h.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const vehicleRoutes: MetadataRoute.Sitemap = vehicles.map((v) => ({
    url: url(`/cars/${v.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...tourRoutes, ...hotelRoutes, ...vehicleRoutes];
}
