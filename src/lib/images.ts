/**
 * Listing photography.
 *
 * MIXED SET. Paths under /media/photos are real: Thrill Rwanda's own
 * pictures, and photographs from Visit Rwanda, which the owner confirmed
 * may be used on this site (docs/PHOTO_SOURCES.md lists every file and where
 * it came from). Everything built with photo() is still an Unsplash
 * stand-in: the hotels, the vehicles and the sign-in panel.
 *
 * When real photography arrives:
 *   1. Upload to R2 and set R2_PUBLIC_URL (next.config.ts then allows that
 *      host and nothing else).
 *   2. Replace the values here with those URLs.
 * Nothing else changes — every call site reads through this module.
 *
 * Licence note: Unsplash images are free for commercial use without
 * attribution, but hotlinking someone else's CDN is not a production
 * strategy. Replace before launch; it's on the checklist in the README.
 */

const CDN = "https://images.unsplash.com";

/** Builds a sized, cropped URL. Next's optimiser resizes again per viewport. */
export function photo(id: string, width = 1600) {
  return `${CDN}/${id}?auto=format&fit=crop&w=${width}&q=75`;
}

/** The homepage hero. Wide, dark, and legible under an overlay. */
export const heroImage = photo("photo-1516426122078-c23e76319801", 2400);

/**
 * The auth screens' side panel. Deliberately a different frame from the
 * hero — signing in straight after landing shouldn't feel like the page
 * failed to change. Portrait-ish crop, since the panel is a tall column.
 */
export const authImage = photo("photo-1621139261252-27d1a67449f4", 1400);

export const tourImages: Record<string, string> = {
  "gorilla-trekking-volcanoes-2-day": "/media/photos/silverback-bamboo.jpg",
  "akagera-big-five-3-day": "/media/photos/akagera-lioness.jpg",
  "nyungwe-canopy-chimps-3-day": "/media/photos/nyungwe-colobus.jpg",
  "kigali-city-memorial-day": "/media/photos/kigali-convention-centre-night.jpeg",
  "lake-kivu-congo-nile-3-day": "/media/photos/lake-kivu-islands.jpeg",
  "grand-rwanda-7-day": "/media/photos/virunga-volcano.jpg",
};

export const hotelImages: Record<string, string> = {
  "volcanoes-ridge-lodge": photo("photo-1781039869379-5561fe260d26"),
  "kivu-lakeshore-lodge": "/media/photos/lake-kivu-islands.jpeg",
  "kigali-parkside-suites": "/media/photos/kigali-skyline.jpg",
  "akagera-savannah-camp": photo("photo-1779216175784-a67b6da108bb"),
};

export const vehicleImages: Record<string, string> = {
  "toyota-landcruiser-prado-2023": photo("photo-1758881534566-fd5c54d7e7c8"),
  "toyota-alphard-2022": photo("photo-1656772118305-1c1937d1717a"),
  "mercedes-e-class-2023": photo("photo-1533630217389-3a5e4dff5683"),
  "toyota-rav4-2022": photo("photo-1534476478164-b15fec4f091c"),
};

export const destinationImages: Record<string, string> = {
  "volcanoes-national-park": "/media/photos/volcanoes-summit-mist.jpeg",
  "nyungwe-national-park": "/media/photos/nyungwe-canopy-walk.jpeg",
  "akagera-national-park": "/media/photos/akagera-lioness.jpg",
  "lake-kivu": "/media/photos/lake-kivu-islands.jpeg",
  // The daytime frame: the night one reads as a black panel in the destination rail.
  kigali: "/media/photos/kigali-convention-centre-day.jpg",
};

/**
 * Where to anchor a destination photo when its tall, narrow panel crops it,
 * so the subject (here the canopy bridge) stays in frame.
 */
export const destinationFocus: Record<string, string> = {
  "nyungwe-national-park": "22% 50%",
};

/** Extra frames for detail-page galleries. */
export const galleryImages = [
  "/media/photos/volcanoes-trek.jpeg",
  "/media/photos/volcanoes-summit-mist.jpeg",
  photo("photo-1554990772-0bea55d510d5"),
  photo("photo-1517846875602-2371528547d4"),
  photo("photo-1518709766631-a6a7f45921c3"),
  photo("photo-1559494487-a5bbc635ed2b"),
  photo("photo-1639221652297-f0ce04992bb4"),
  photo("photo-1764977224678-65ab06ea020a"),
];

/** Single lookup used by pages and by the seed script. */
export function imageFor(
  kind: "tour" | "hotel" | "vehicle" | "destination",
  slug: string,
): string | undefined {
  const map = {
    tour: tourImages,
    hotel: hotelImages,
    vehicle: vehicleImages,
    destination: destinationImages,
  }[kind];
  return map[slug];
}
