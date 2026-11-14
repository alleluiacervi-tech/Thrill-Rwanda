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

/**
 * Short silent loops cut from the reels above for the homepage hero: 5 to 8
 * seconds, 600px wide, cross-faded at the seam, about 1.4 MB for all three.
 * Re-cut with ffmpeg from /media/videos when the footage changes.
 */
export type HeroClip = { src: string; poster: string; place: string; alt: string };

export const heroClips = {
  gorilla: { src: "/media/hero/gorilla.mp4", poster: "/media/hero/gorilla.webp", place: "Volcanoes National Park", alt: "A mountain gorilla in the bamboo of Volcanoes National Park" },
  kivu: { src: "/media/hero/kivu.mp4", poster: "/media/hero/kivu.webp", place: "Lake Kivu", alt: "Lake Kivu's wooded peninsulas seen from the air" },
  crater: { src: "/media/hero/crater.mp4", poster: "/media/hero/crater.webp", place: "Virunga volcanoes", alt: "A crater lake high in the Virunga volcanoes" },
} satisfies Record<string, HeroClip>;

/**
 * The phone hero plays these in order, full-screen, a few seconds of each.
 * They point at the 720p reels rather than the 600px desktop cuts: a phone
 * screen is 1000px+ wide in device pixels, and the desktop cuts are cropped
 * to 5:7, which a tall phone has to zoom ~1.5x to fill.
 *
 * `width`/`height` are the clip's real pixel size; the hero uses them to
 * decide, per screen, whether a clip can fill it without heavy cropping or
 * should be shown whole over a blurred copy of itself. `start`/`length` (in
 * seconds) pick the moment shown. Re-cut to short 720x1280 files when the
 * footage changes, and data use drops further.
 */
export type HeroSequenceClip = HeroClip & {
  width: number;
  height: number;
  start: number;
  length: number;
};

export const phoneHeroSequence: HeroSequenceClip[] = [
  { src: "/media/videos/mountain-gorilla.m4v", poster: "/media/posters/mountain-gorilla.webp", place: "Volcanoes National Park", alt: "A mountain gorilla in the bamboo of Volcanoes National Park", width: 720, height: 1280, start: 0, length: 5 },
  { src: "/media/videos/lake-kivu-aerial.m4v", poster: "/media/posters/lake-kivu-aerial.webp", place: "Lake Kivu", alt: "Lake Kivu's wooded peninsulas seen from the air", width: 720, height: 1280, start: 0, length: 5 },
  { src: "/media/videos/crater-lake.m4v", poster: "/media/posters/crater-lake.webp", place: "Virunga volcanoes", alt: "A crater lake high in the Virunga volcanoes", width: 720, height: 720, start: 0, length: 5 },
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
