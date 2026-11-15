/**
 * Thrill Rwanda's own footage and photographs, served from /public/media.
 * Replace or add files there and list them here — pages read through this module.
 *
 * Videos are vertical reels at 720p, never autoplayed with sound.
 */

import type { CSSProperties } from "react";

export type Reel = {
  src: string;
  /** Still frame shown until the clip is played. */
  poster: string;
  title: string;
  place: string;
  /** Seconds, shown on the card. */
  duration: number;
  /** The clip's real pixel size, so a frame of another shape can show it whole instead of zooming. */
  width: number;
  height: number;
} & Crop;

/**
 * Some reels carry a title burned into the footage. `cropTop` hides that
 * share of the frame (0.21 = the top 21%) wherever the clip is shown, and
 * `maxZoom` lets such a clip still fill its frame after losing that band.
 */
export type Crop = { cropTop?: number; maxZoom?: number };

/** The part of a clip that is actually shown, after `cropTop`. */
export function visibleSize(c: { width: number; height: number } & Crop) {
  return { w: c.width, h: c.height * (1 - (c.cropTop ?? 0)) };
}

/**
 * Inline style that pushes the cropped band above the frame: the media
 * element is made taller than its (overflow-hidden) frame and shifted up,
 * so the bottom `1 - cropTop` of the picture fills it.
 */
export function cropStyle(cropTop?: number): CSSProperties | undefined {
  if (!cropTop) return undefined;
  return {
    top: `${(-cropTop / (1 - cropTop)) * 100}%`,
    bottom: "auto",
    height: `${100 / (1 - cropTop)}%`,
  };
}

/** "This is RWANDA" sits in the top ~11-19% of the gorilla reel for its whole length. */
const GORILLA_CROP: Crop = { cropTop: 0.21, maxZoom: 1.6 };

export const reels: Reel[] = [
  { src: "/media/videos/mountain-gorilla.m4v", poster: "/media/posters/mountain-gorilla.webp", title: "Face to face with a mountain gorilla", place: "Volcanoes National Park", duration: 18, width: 720, height: 1280, ...GORILLA_CROP },
  { src: "/media/videos/lake-kivu-aerial.m4v", poster: "/media/posters/lake-kivu-aerial.webp", title: "Lake Kivu from above", place: "Western Province", duration: 27, width: 720, height: 1280 },
  { src: "/media/videos/crater-lake.m4v", poster: "/media/posters/crater-lake.webp", title: "The crater lake above the clouds", place: "Virunga volcanoes", duration: 14, width: 720, height: 720 },
  { src: "/media/videos/cultural-village-drive.m4v", poster: "/media/posters/cultural-village-drive.webp", title: "Welcome to Volcanoes National Park", place: "Musanze, Northern Province", duration: 53, width: 720, height: 1280 },
];

export type Fit = "cover" | "contain";

/**
 * Whether footage of `w`x`h` may fill a box of `boxW`x`boxH`, or should be
 * shown whole. Filling is allowed while it enlarges the clip at most
 * `maxZoom` times past "fits whole" (1.25: at most a fifth cropped away);
 * beyond that the clip is shown whole, over a blurred copy of itself.
 */
export function fitFor(boxW: number, boxH: number, w: number, h: number, maxZoom = 1.25): Fit {
  if (!boxW || !boxH || !w || !h) return "cover";
  const sx = boxW / w;
  const sy = boxH / h;
  return Math.max(sx, sy) / Math.min(sx, sy) <= maxZoom ? "cover" : "contain";
}

/**
 * For footage shown whole (`object-fit: contain`): a mask that feathers the
 * clip's own edges into the blurred surround, so it reads as part of the
 * frame rather than a box pasted on top. Apply as `maskImage` on the element.
 */
export function featherMask(boxW: number, boxH: number, w: number, h: number, feather = 7): string | undefined {
  if (!boxW || !boxH || !w || !h) return undefined;
  const sideBars = boxW / boxH > w / h;
  // Share of the box (in %) left empty on each side of the clip.
  const gap = sideBars ? ((1 - (boxH * w) / h / boxW) / 2) * 100 : ((1 - (boxW * h) / w / boxH) / 2) * 100;
  const a = Math.max(0, gap);
  const b = Math.min(50, a + feather);
  const dir = sideBars ? "to right" : "to bottom";
  return `linear-gradient(${dir}, transparent ${a}%, #000 ${b}%, #000 ${100 - b}%, transparent ${100 - a}%)`;
}

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
} & Crop;

export const phoneHeroSequence: HeroSequenceClip[] = [
  // The gorilla is on screen for the reel's first ~4.8 s; after that it cuts to a montage.
  // (`length` includes the one-second cross-fade into the next clip.)
  { src: "/media/videos/mountain-gorilla.m4v", poster: "/media/posters/mountain-gorilla.webp", place: "Volcanoes National Park", alt: "A mountain gorilla in the bamboo of Volcanoes National Park", width: 720, height: 1280, start: 0, length: 4.7, ...GORILLA_CROP },
  // 18 s in, the drone clears the ridge and the peninsulas open up; the poster is that frame.
  { src: "/media/videos/lake-kivu-aerial.m4v", poster: "/media/hero/kivu-phone.webp", place: "Lake Kivu", alt: "Lake Kivu's wooded peninsulas seen from the air", width: 720, height: 1280, start: 18, length: 6 },
  { src: "/media/videos/crater-lake.m4v", poster: "/media/posters/crater-lake.webp", place: "Virunga volcanoes", alt: "A crater lake high in the Virunga volcanoes", width: 720, height: 720, start: 0, length: 6 },
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
