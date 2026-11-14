"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Reel } from "@/lib/media";

/**
 * Vertical reels in a snap-scrolling rail. Nothing downloads beyond its poster image (until the visitor hovers, focuses or taps)
 * until a visitor taps a card; only one plays at a time; playback pauses when
 * a card scrolls out of view. Sound is opt-in per tap.
 */
export function ReelsShowcase({ reels }: { reels: Reel[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [muted, setMuted] = useState(true);

  return (
    <ul className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {reels.map((reel, i) => (
        <ReelCard
          key={reel.src}
          reel={reel}
          playing={active === i}
          muted={muted}
          onPlay={() => setActive(i)}
          onStop={() => setActive((a) => (a === i ? null : a))}
          onToggleMute={() => setMuted((m) => !m)}
        />
      ))}
    </ul>
  );
}

function ReelCard({
  reel,
  playing,
  muted,
  onPlay,
  onStop,
  onToggleMute,
}: {
  reel: Reel;
  playing: boolean;
  muted: boolean;
  onPlay: () => void;
  onStop: () => void;
  onToggleMute: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  // Warm the clip when someone shows intent (hover, focus, touch) so a tap
  // starts at once; nothing downloads before that.
  const [warm, setWarm] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playing) v.play().catch(onStop);
    else v.pause();
  }, [playing, onStop]);

  // Pause when scrolled mostly out of view.
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) onStop();
      },
      { threshold: 0.35 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [onStop]);

  return (
    <li className="w-[15.5rem] shrink-0 snap-center sm:w-[17rem] lg:w-auto">
      <div
        onPointerEnter={() => setWarm(true)}
        onFocusCapture={() => setWarm(true)}
        className="group relative aspect-[9/16] overflow-hidden rounded-2xl bg-forest-950 ring-1 ring-white/10">
        <video
          ref={ref}
          src={reel.src}
          poster={reel.poster}
          muted={muted}
          loop
          playsInline
          preload={warm ? "auto" : "none"}
          aria-label={reel.title}
          className="absolute inset-0 size-full object-cover"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-forest-950/90 via-forest-950/10 to-forest-950/30"
        />

        <button
          type="button"
          onClick={() => (playing ? onStop() : onPlay())}
          aria-label={playing ? `Pause: ${reel.title}` : `Play: ${reel.title}`}
          className="absolute inset-0 flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-ember-400"
        >
          <span
            className={cn(
              "grid size-14 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md ring-1 ring-white/40 transition duration-300",
              playing ? "scale-90 opacity-0 group-hover:opacity-100" : "group-hover:scale-110",
            )}
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5 translate-x-0.5" />}
          </span>
        </button>

        {playing && (
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? "Turn sound on" : "Turn sound off"}
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur"
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-bone-50">
          <p className="text-xs font-medium text-ember-300">{reel.place}</p>
          <p className="mt-1 text-[0.95rem] font-semibold leading-snug">{reel.title}</p>
          <p className="mt-1 text-xs text-bone-50/70">0:{String(reel.duration).padStart(2, "0")}</p>
        </div>
      </div>
    </li>
  );
}
