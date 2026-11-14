/**
 * Thrill Rwanda's own footage and photographs, served from /public/media.
 * Replace or add files there and list them here — pages read through this module.
 *
 * Videos are vertical reels at 720p; they are streamed on demand
 * (preload="none", with a poster frame), never autoplayed with sound.
 */

export type Reel = {
  src: string;
  /** Still frame shown until the clip is played. */
  poster: string;
  title: string;
  place: string;
  /** Seconds, shown on the card. */
  duration: number;
};

export const reels: Reel[] = [
  { src: "/media/videos/mountain-gorilla.m4v", poster: "/media/posters/mountain-gorilla.webp", title: "Face to face with a mountain gorilla", place: "Volcanoes National Park", duration: 18 },
  { src: "/media/videos/lake-kivu-aerial.m4v", poster: "/media/posters/lake-kivu-aerial.webp", title: "Lake Kivu from above", place: "Western Province", duration: 27 },
  { src: "/media/videos/crater-lake.m4v", poster: "/media/posters/crater-lake.webp", title: "The crater lake above the clouds", place: "Virunga volcanoes", duration: 14 },
  { src: "/media/videos/cultural-village-drive.m4v", poster: "/media/posters/cultural-village-drive.webp", title: "Welcome to Volcanoes National Park", place: "Musanze, Northern Province", duration: 53 },
];

export type TrailPhoto = {
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
};

export const trailPhotos: TrailPhoto[] = [
  { src: "/media/photos/nyungwe-canopy-walk.jpeg", alt: "Suspended canopy walkway over Nyungwe forest", caption: "Nyungwe canopy walk", width: 1440, height: 1440 },
  { src: "/media/photos/volcanoes-trek.jpeg", alt: "Trekkers walking toward the Virunga volcanoes", caption: "On the trail to the gorillas", width: 1215, height: 1215 },
  { src: "/media/photos/kigali-convention-centre-night.jpeg", alt: "Kigali Convention Centre lit in the national colours at night", caption: "Kigali after dark", width: 1440, height: 1440 },
  { src: "/media/photos/volcanoes-summit-mist.jpeg", alt: "A park ranger above the cloud line in the Virunga mountains", caption: "Above the clouds with our rangers", width: 1215, height: 1215 },
  { src: "/media/photos/nyungwe-canopy-walk-2.jpeg", alt: "A traveller crossing the Nyungwe canopy walkway", caption: "Walking among the treetops", width: 1440, height: 1440 },
];
