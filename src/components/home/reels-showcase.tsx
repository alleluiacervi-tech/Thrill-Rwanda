"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Reel } from "@/lib/media";
import { useMotionAllowed } from "./hero-reel";

/**
 * Vertical reels in a snap-scrolling rail (a grid on desktop).
 *
 * Like a social feed, each reel starts on its own, silently, once most of it
 * is on screen, and pauses when it leaves. On a phone that means the card in
 * view; on a laptop, every card in the grid. A clip begins buffering just
 * before it arrives, so it is already moving when it appears.
 *
 * Sound is opt-in and belongs to one reel at a time. Tapping a reel pauses or
 * resumes it, and a reel the visitor paused stays paused until it has left
 * the screen. With reduced motion or a data saver on, nothing starts by
 * itself and a tap plays the clip, as before.
 */
export function ReelsShowcase({ reels }: { reels: Reel[] }) {
  const autoplay = useMotionAllowed("all");
  const [soundOn, setSoundOn] = useState<number | null>(null);

  return (
    <ul className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {reels.map((reel, i) => (
        <ReelCard
          key={reel.src}
          reel={reel}
          autoplay={autoplay}
          muted={soundOn !== i}
          onToggleSound={() => setSoundOn((s) => (s === i ? null : i))}
          onLeave={() => setSoundOn((s) => (s === i ? null : s))}
        />
      ))}
    </ul>
  );
}

function ReelCard({
  reel,
  autoplay,
  muted,
  onToggleSound,
  onLeave,
}: {
  reel: Reel;
  autoplay: boolean;
  muted: boolean;
  onToggleSound: () => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  /** Close enough to start buffering. */
  const [near, setNear] = useState(false);
  /** Mostly on screen: the moment it may play. */
  const [inView, setInView] = useState(false);
  /** The visitor's own choice; null until they tap. */
  const [wanted, setWanted] = useState<boolean | null>(null);
  const [playing, setPlaying] = useState(false);

  const onLeaveRef = useRef(onLeave);
  useEffect(() => {
    onLeaveRef.current = onLeave;
  });

  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === "undefined") return;
    const nearIo = new IntersectionObserver(([e]) => e?.isIntersecting && setNear(true), {
      rootMargin: "300px",
    });
    const viewIo = new IntersectionObserver(
      ([e]) => {
        const visible = !!e && e.intersectionRatio >= 0.6;
        setInView(visible);
        if (!visible) {
          // Leaving resets a manual pause and takes the sound with it.
          setWanted(null);
          onLeaveRef.current();
        }
      },
      { threshold: [0, 0.6] },
    );
    nearIo.observe(v);
    viewIo.observe(v);
    return () => {
      nearIo.disconnect();
      viewIo.disconnect();
    };
  }, []);

  const shouldPlay = wanted ?? (autoplay && inView);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (shouldPlay) v.play().catch(() => setWanted(false));
    else v.pause();
  }, [shouldPlay]);

  return (
    <li className="w-[15.5rem] shrink-0 snap-center sm:w-[17rem] lg:w-auto">
      <div className="group relative aspect-[9/16] overflow-hidden rounded-2xl bg-forest-950 ring-1 ring-white/10">
        <video
          ref={ref}
          src={reel.src}
          poster={reel.poster}
          muted={muted}
          loop
          playsInline
          preload={near || wanted ? "auto" : "none"}
          aria-label={reel.title}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="absolute inset-0 size-full object-cover"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgb(8_20_15/0.85)] via-transparent to-[rgb(8_20_15/0.25)]"
        />

        <button
          type="button"
          onClick={() => setWanted(!playing)}
          aria-label={playing ? `Pause: ${reel.title}` : `Play: ${reel.title}`}
          className="absolute inset-0 flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-sun-400"
        >
          <span
            className={cn(
              "grid size-14 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md ring-1 ring-white/40 transition duration-300",
              playing
                ? "scale-90 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                : "group-hover:scale-110",
            )}
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5 translate-x-0.5" />}
          </span>
        </button>

        {playing && (
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={muted ? "Turn sound on" : "Turn sound off"}
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur"
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-bone-50">
          <p className="text-xs font-medium text-sun-300">{reel.place}</p>
          <p className="mt-1 text-[0.95rem] font-semibold leading-snug">{reel.title}</p>
          <p className="mt-1 text-xs text-bone-50/70">0:{String(reel.duration).padStart(2, "0")}</p>
        </div>
      </div>
    </li>
  );
}
