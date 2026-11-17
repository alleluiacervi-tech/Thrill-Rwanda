"use client";

import * as React from "react";
import Image from "next/image";
import { MapPin, Pause, Play } from "lucide-react";
import { cropStyle, featherMask, fitFor, visibleSize, type HeroSequenceClip } from "@/lib/media";
import { cn } from "@/lib/utils";
import { useMotionAllowed } from "./hero-reel";

/**
 * The phone and tablet hero: a few seconds of each clip, full-bleed, cut
 * together with a slow cross-fade, plus story-style progress segments and
 * the place name under the type.
 *
 * Framing is decided per screen, per clip. A clip fills the hero only when
 * that crops it lightly (a vertical reel on a phone in portrait). When the
 * shapes disagree, a square clip on a phone, any reel on a tablet or a phone
 * turned sideways, the whole clip is shown over a blurred, darkened copy of
 * itself, the way the big video apps handle it, instead of being blown up.
 *
 * The first poster is the real content and is in the server HTML. Videos
 * mount only below the desktop breakpoint, with motion allowed and no data
 * saver; only the current and next clip preload. A failed clip drops the
 * sequence back to the still, so the hero never shows a broken frame.
 */

const BELOW_DESKTOP = "(max-width: 1023px)";
/** Matches the cross-fade below; the outgoing clip keeps playing until it has faded. */
const FADE_MS = 1000;

type Sequence = {
  clips: HeroSequenceClip[];
  index: number;
  go: (i: number) => void;
  live: boolean;
  paused: boolean;
  togglePaused: () => void;
  register: (i: number, el: HTMLVideoElement | null) => void;
  fillRef: React.RefObject<HTMLSpanElement | null>;
  onError: () => void;
  started: boolean[];
  onPlaying: (i: number) => void;
  backdropRef: React.RefObject<HTMLDivElement | null>;
  box: { w: number; h: number } | null;
};

const SequenceContext = React.createContext<Sequence | null>(null);

function useSequence() {
  const ctx = React.useContext(SequenceContext);
  if (!ctx) throw new Error("Hero sequence parts must sit inside <HeroSequence>.");
  return ctx;
}

export function HeroSequence({ clips, children }: { clips: HeroSequenceClip[]; children: React.ReactNode }) {
  const allowed = useMotionAllowed(BELOW_DESKTOP);
  const [broken, setBroken] = React.useState(false);
  const live = allowed && !broken && clips.length > 1;

  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [visible, setVisible] = React.useState(true);
  const [started, setStarted] = React.useState<boolean[]>(() => clips.map(() => false));
  const [box, setBox] = React.useState<{ w: number; h: number } | null>(null);

  const videos = React.useRef<(HTMLVideoElement | null)[]>([]);
  const fillRef = React.useRef<HTMLSpanElement>(null);
  const backdropRef = React.useRef<HTMLDivElement>(null);

  const register = React.useCallback((i: number, el: HTMLVideoElement | null) => {
    videos.current[i] = el;
  }, []);

  // Track the hero's shape so each clip can be framed for this screen.
  React.useEffect(() => {
    const el = backdropRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry?.contentRect;
      if (r && r.width && r.height) setBox({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pause the footage once the hero has scrolled off screen.
  React.useEffect(() => {
    const el = backdropRef.current;
    if (!live || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [live]);

  // The current clip plays from its chosen moment; the previous one finishes its fade, then stops.
  const lastIndex = React.useRef(-1);
  React.useEffect(() => {
    if (!live) return;
    const timers: number[] = [];
    videos.current.forEach((v, i) => {
      if (!v) return;
      if (i !== index) {
        timers.push(window.setTimeout(() => v.pause(), FADE_MS));
        return;
      }
      if (lastIndex.current !== index) {
        v.currentTime = clips[i]!.start;
        lastIndex.current = index;
      }
      if (visible && !paused) v.play().catch(() => {});
      else v.pause();
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [live, index, visible, paused, clips]);

  // Drive the active segment from the clip's own clock, and cut when its moment is over.
  React.useEffect(() => {
    if (!live) return;
    const clip = clips[index]!;
    let frame = 0;
    const tick = () => {
      const v = videos.current[index];
      if (v && v.readyState >= 2) {
        // Hand over a fade's length early, so the outgoing clip spends its cross-fade
        // inside its own moment instead of running on into whatever the reel cuts to next.
        const end = Math.min(clip.start + clip.length, v.duration || Infinity) - FADE_MS / 1000;
        const progress = Math.max(0, Math.min(1, (v.currentTime - clip.start) / (end - clip.start)));
        if (fillRef.current) fillRef.current.style.transform = `scaleX(${progress})`;
        if (progress >= 1 || v.ended) {
          setIndex((i) => (i + 1) % clips.length);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [live, index, clips]);

  const value: Sequence = {
    clips,
    index,
    go: (i) => setIndex(((i % clips.length) + clips.length) % clips.length),
    live,
    paused,
    togglePaused: () => setPaused((p) => !p),
    register,
    fillRef,
    onError: () => setBroken(true),
    started,
    onPlaying: (i) => setStarted((s) => (s[i] ? s : s.map((v, j) => (j === i ? true : v)))),
    backdropRef,
    box,
  };

  return <SequenceContext.Provider value={value}>{children}</SequenceContext.Provider>;
}

/** The full-bleed footage. Place it as the first child of the hero section. */
export function HeroSequenceBackdrop({ className }: { className?: string }) {
  const { clips, index, live, register, onError, started, onPlaying, backdropRef, box } = useSequence();
  const next = (index + 1) % clips.length;
  const shown = live ? clips : clips.slice(0, 1);

  return (
    <div ref={backdropRef} className={cn("overflow-hidden bg-forest-950", className)}>
      {shown.map((clip, i) => {
        const active = !live || i === index;
        // A cropped clip's element is taller than the frame by 1 / (1 - cropTop).
        const keep = 1 - (clip.cropTop ?? 0);
        const crop = cropStyle(clip.cropTop);
        const vis = visibleSize(clip);
        const fit = box ? fitFor(box.w, box.h, vis.w, vis.h, clip.maxZoom) : "cover";
        const mask = fit === "contain" && box ? featherMask(box.w, box.h / keep, clip.width, clip.height) : undefined;
        // Stills are all 9:16 frames, whatever shape the clip is, so they are framed on their own.
        const stillFit = box ? fitFor(box.w, box.h, 9, 16 * keep, clip.maxZoom) : "cover";
        const stillMask = stillFit === "contain" && box ? featherMask(box.w, box.h / keep, 9, 16) : undefined;
        const ambient = fit === "contain" || stillFit === "contain";
        const playing = live && started[i];
        return (
          <div
            key={clip.src}
            aria-hidden={!active}
            className={cn(
              "absolute inset-0 transition-opacity ease-out",
              active ? "opacity-100" : "opacity-0",
            )}
            style={{ transitionDuration: `${FADE_MS}ms` }}
          >
            {/* Ambient fill for a clip shown whole: its own still, blurred and dimmed. */}
            {ambient ? (
              <Image
                src={clip.poster}
                alt=""
                fill
                sizes="40vw"
                unoptimized
                className="scale-125 object-cover opacity-80 blur-2xl saturate-125"
              />
            ) : null}
            {/* next/image keeps a fill image at 100% height, so the crop goes on a wrapper. */}
            <div
              style={crop}
              className={cn("absolute inset-0 transition-opacity duration-700", playing ? "opacity-0" : "opacity-100")}
            >
              <Image
                src={clip.poster}
                alt={i === 0 ? clip.alt : ""}
                fill
                sizes="100vw"
                unoptimized
                loading={i === 0 ? "eager" : undefined}
                fetchPriority={i === 0 ? "high" : undefined}
                style={stillMask ? { maskImage: stillMask, WebkitMaskImage: stillMask } : undefined}
                className={stillFit === "cover" ? "object-cover" : "object-contain"}
              />
            </div>
            {live ? (
              <video
                ref={(el) => register(i, el)}
                // The fragment makes the browser fetch from the chosen moment, not from zero.
                src={clip.start ? `${clip.src}#t=${clip.start}` : clip.src}
                muted
                playsInline
                preload={i === index ? "auto" : i === next ? "metadata" : "none"}
                aria-hidden
                tabIndex={-1}
                disablePictureInPicture
                onPlaying={() => onPlaying(i)}
                onError={onError}
                style={{ ...crop, ...(mask ? { maskImage: mask, WebkitMaskImage: mask } : null) }}
                className={cn(
                  "absolute inset-0 size-full transition-opacity duration-700",
                  fit === "cover" ? "object-cover" : "object-contain",
                  playing ? "opacity-100" : "opacity-0",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Progress segments, the current place and a pause control. Renders nothing when the footage is still. */
export function HeroSequenceControls({ className }: { className?: string }) {
  const { clips, index, go, live, paused, togglePaused, fillRef } = useSequence();
  if (!live) return null;
  const clip = clips[index]!;

  return (
    <div className={cn("anim-fade max-w-xs [animation-delay:600ms]", className)}>
      <div className="flex items-center gap-1.5">
        {clips.map((c, i) => (
          <button
            key={c.src}
            type="button"
            onClick={() => go(i)}
            aria-label={`Show ${c.place}`}
            aria-current={i === index ? "true" : undefined}
            className="relative flex-1 py-[1.125rem]"
          >
            <span className="relative block h-[3px] overflow-hidden rounded-full bg-white/30">
              <span
                // Remount when a segment becomes or stops being current, dropping the width the clock wrote directly.
                key={i === index ? "active" : "idle"}
                ref={i === index ? fillRef : undefined}
                className="absolute inset-0 origin-left rounded-full bg-white"
                // Past clips full, future empty; the current one is driven by the clip's clock.
                style={{ transform: `scaleX(${i < index ? 1 : 0})` }}
              />
            </span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p key={clip.src} className="on-media anim-fade flex items-center gap-1.5 text-xs font-semibold text-white">
          <MapPin className="size-3.5 shrink-0 text-sun-400" aria-hidden />
          {clip.place}
        </p>
        <button
          type="button"
          onClick={togglePaused}
          aria-label={paused ? "Play background video" : "Pause background video"}
          className="-mr-2.5 grid size-11 place-items-center rounded-full text-white/85 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white"
        >
          {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}
