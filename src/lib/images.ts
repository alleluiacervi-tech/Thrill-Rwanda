/**
 * Listing photography.
 *
 * PLACEHOLDER SET. Gorilla, Lake Kivu and Kigali frames are Rwanda photos;
 * the rest are generic safari stand-ins. These are Unsplash photographs standing in until
 * Thrill Rwanda supplies its own. Every id below was verified to return
 * HTTP 200 before being added — a few candidates 404'd and were dropped, so
 * re-verify with a HEAD request before adding more rather than trusting a
 * search result.
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
  "gorilla-trekking-volcanoes-2-day": photo("photo-1589442690840-1c2c880254ac"),
  "akagera-big-five-3-day": photo("photo-1519659528534-7fd733a832a0"),
  "nyungwe-canopy-chimps-3-day": "/media/photos/nyungwe-canopy-walk.jpeg",
  "kigali-city-memorial-day": "/media/photos/kigali-convention-centre-night.jpeg",
  "lake-kivu-congo-nile-3-day": photo("photo-1514548383638-cef9251a73ec"),
  "grand-rwanda-7-day": photo("photo-1564101160531-4838e8a5f4e7"),
};

export const hotelImages: Record<string, string> = {
  "volcanoes-ridge-lodge": photo("photo-1781039869379-5561fe260d26"),
  "kivu-lakeshore-lodge": photo("photo-1514548383638-cef9251a73ec"),
  "kigali-parkside-suites": photo("photo-1708772565599-2c4e4b3ed9db"),
  "akagera-savannah-camp": photo("photo-1779216175784-a67b6da108bb"),
};

export const vehicleImages: Record<string, string> = {
  "toyota-landcruiser-prado-2023": photo("photo-1758881534566-fd5c54d7e7c8"),
  "toyota-alphard-2022": photo("photo-1656772118305-1c1937d1717a"),
  "mercedes-e-class-2023": photo("photo-1533630217389-3a5e4dff5683"),
  "toyota-rav4-2022": photo("photo-1534476478164-b15fec4f091c"),
};

export const destinationImages: Record<string, string> = {
  "volcanoes-national-park": photo("photo-1589442690840-1c2c880254ac"),
  "nyungwe-national-park": "/media/photos/nyungwe-canopy-walk-2.jpeg",
  "akagera-national-park": photo("photo-1519659528534-7fd733a832a0"),
  "lake-kivu": photo("photo-1514548383638-cef9251a73ec"),
  kigali: "/media/photos/kigali-convention-centre-night.jpeg",
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
