"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, MapPin, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { cropStyle, featherMask, fitFor, visibleSize, type Reel } from "@/lib/media";

/**
 * "Rwanda in motion": vertical reels as still, editorial cards that open a
 * full-screen, story-style viewer with sound.
 *
 * Loading is the point. The clips buffer quietly, one at a time and in
 * order, while the visitor is still reading the sections above: shortly
 * after the page settles (in idle time), or as soon as the section comes
 * within a couple of screens, whichever is first. By the time anyone taps,
 * the bytes are in the browser cache (/media is served immutable), so the
 * viewer starts at once. On a data saver or a 2G connection nothing is
 * fetched ahead; a tap loads just that clip.
 *
 * Cards stay still on their own. On a mouse, hovering one plays a silent
 * preview of the clip that has already buffered.
 */

/** Wait this long after load before warming, so the page's own assets go first. */
const WARM_AFTER_LOAD_MS = 2500;
/** Move on to the next clip even if one is slow to report it can play through. */
const WARM_STEP_TIMEOUT_MS = 12000;

function canPreload() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!c) return true;
  return !c.saveData && c.effectiveType !== "2g" && c.effectiveType !== "slow-2g";
}

function formatDuration(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

export function ReelsShowcase({
  reels,
  preload = true,
}: {
  reels: Reel[];
  /** Off (Admin → Settings, hero video) downloads nothing until a clip is opened. */
  preload?: boolean;
}) {
  /** Clips with index below this may buffer; it advances one clip at a time. */
  const [warmUpTo, setWarmUpTo] = React.useState(0);
  const [open, setOpen] = React.useState<number | null>(null);
  const railRef = React.useRef<HTMLUListElement>(null);
  const thumbRef = React.useRef<HTMLSpanElement>(null);

  // Start the background warm-up: in idle time after load, or when the section draws near.
  React.useEffect(() => {
    if (!preload || !canPreload()) return;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      setWarmUpTo((w) => Math.max(w, 1));
    };

    let timer = 0;
    let idle = 0;
    const scheduleIdle = () => {
      timer = window.setTimeout(() => {
        if ("requestIdleCallback" in window) idle = window.requestIdleCallback(start, { timeout: 4000 });
        else start();
      }, WARM_AFTER_LOAD_MS);
    };
    if (document.readyState === "complete") scheduleIdle();
    else window.addEventListener("load", scheduleIdle, { once: true });

    const el = railRef.current;
    const io =
      el && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([e]) => e?.isIntersecting && start(), { rootMargin: "250% 0px" })
        : null;
    if (el && io) io.observe(el);

    return () => {
      window.removeEventListener("load", scheduleIdle);
      window.clearTimeout(timer);
      if (idle && "cancelIdleCallback" in window) window.cancelIdleCallback(idle);
      io?.disconnect();
    };
  }, [preload]);

  const warmed = React.useCallback(
    (i: number) => setWarmUpTo((w) => (w === i + 1 ? Math.min(reels.length, i + 2) : w)),
    [reels.length],
  );

  // The phone rail's position indicator, written straight to the thumb.
  const onRailScroll = React.useCallback(() => {
    const rail = railRef.current;
    const thumb = thumbRef.current;
    if (!rail || !thumb) return;
    const max = rail.scrollWidth - rail.clientWidth;
    const ratio = rail.clientWidth / rail.scrollWidth;
    thumb.style.width = `${ratio * 100}%`;
    thumb.style.transform = `translateX(${max > 0 ? (rail.scrollLeft / max) * ((1 - ratio) / ratio) * 100 : 0}%)`;
  }, []);
  React.useEffect(() => {
    onRailScroll();
    window.addEventListener("resize", onRailScroll);
    return () => window.removeEventListener("resize", onRailScroll);
  }, [onRailScroll]);

  return (
    <>
      <ul
        ref={railRef}
        onScroll={onRailScroll}
        className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-14 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reels.map((reel, i) => (
          <ReelCard
            key={reel.src}
            reel={reel}
            number={i + 1}
            warm={i < warmUpTo}
            onWarmed={() => warmed(i)}
            onOpen={() => setOpen(i)}
          />
        ))}
      </ul>

      {/* Where you are in the rail: phones and tablets only. */}
      <div aria-hidden className="mt-6 h-0.5 overflow-hidden rounded-full bg-white/10 lg:hidden">
        <span ref={thumbRef} className="block h-full w-1/4 rounded-full bg-sun-400 transition-transform duration-150" />
      </div>

      {open !== null ? (
        <ReelViewer reels={reels} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}

/** Behind a clip shown whole: its own still, enlarged, blurred and dimmed, so the frame never shows bars. */
function AmbientFill({ poster }: { poster: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a 40 KB decorative blur; optimising it buys nothing.
    <img
      src={poster}
      alt=""
      aria-hidden
      decoding="async"
      className="pointer-events-none absolute inset-0 size-full scale-125 object-cover opacity-55 blur-2xl"
    />
  );
}

/* --------------------------------------------------------------- The card */

function ReelCard({
  reel,
  number,
  warm,
  onWarmed,
  onOpen,
}: {
  reel: Reel;
  number: number;
  warm: boolean;
  onWarmed: () => void;
  onOpen: () => void;
}) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [previewing, setPreviewing] = React.useState(false);
  // Cards are always 9:16.
  const keep = 1 - (reel.cropTop ?? 0);
  const vis = visibleSize(reel);
  const fit = fitFor(9, 16, vis.w, vis.h, reel.maxZoom);
  const mask = fit === "contain" ? featherMask(9, 16 / keep, reel.width, reel.height, 10) : undefined;

  const onWarmedRef = React.useRef(onWarmed);
  React.useEffect(() => {
    onWarmedRef.current = onWarmed;
  });

  // Once it is this clip's turn, buffer it, then hand over to the next one.
  React.useEffect(() => {
    const v = ref.current;
    if (!warm || !v) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onWarmedRef.current();
    };
    if (v.readyState >= 4) {
      finish();
      return;
    }
    v.addEventListener("canplaythrough", finish, { once: true });
    v.addEventListener("error", finish, { once: true });
    const timer = window.setTimeout(finish, WARM_STEP_TIMEOUT_MS);
    if (v.networkState === v.NETWORK_EMPTY || v.networkState === v.NETWORK_IDLE) v.load();
    return () => {
      v.removeEventListener("canplaythrough", finish);
      v.removeEventListener("error", finish);
      window.clearTimeout(timer);
    };
  }, [warm]);

  const startPreview = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const v = ref.current;
    if (!v) return;
    v.play().then(() => setPreviewing(true), () => {});
  };
  const stopPreview = () => {
    ref.current?.pause();
    setPreviewing(false);
  };

  return (
    <li
      className={cn(
        "w-[min(72vw,18rem)] shrink-0 snap-start sm:w-[17rem] lg:w-auto",
        // Desktop: every other card sits lower, like frames pinned to a wall.
        number % 2 === 0 && "lg:translate-y-14",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        onPointerEnter={startPreview}
        onPointerLeave={stopPreview}
        aria-label={`Watch: ${reel.title}, ${reel.place}, ${formatDuration(reel.duration)}`}
        className="group relative block aspect-[9/16] w-full overflow-hidden rounded-[1.25rem] bg-forest-900 text-left shadow-[0_30px_60px_-32px_rgb(4_14_10/0.9)] ring-1 ring-white/10 transition-[box-shadow,transform] duration-500 ease-out hover:-translate-y-1 hover:ring-white/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sun-400"
      >
        {fit === "contain" ? <AmbientFill poster={reel.poster} /> : null}
        <video
          ref={ref}
          src={reel.src}
          poster={reel.poster}
          muted
          loop
          playsInline
          preload={warm ? "auto" : "none"}
          aria-hidden
          tabIndex={-1}
          disablePictureInPicture
          // Feather only while playing: the still is a 9:16 frame and fills the card.
          style={{
            ...cropStyle(reel.cropTop),
            ...(mask && previewing ? { maskImage: mask, WebkitMaskImage: mask } : null),
          }}
          className={cn(
            "absolute inset-0 size-full transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]",
            fit === "cover" ? "object-cover" : "object-contain",
          )}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgb(8_20_15/0.92)] via-[rgb(8_20_15/0.15)_45%] to-[rgb(8_20_15/0.35)]"
        />

        {/* Top: running number and length. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <span className="font-display text-sm italic text-white/75 tabular-nums">
            {String(number).padStart(2, "0")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[0.6875rem] font-semibold text-white tabular-nums ring-1 ring-white/15 backdrop-blur-md">
            <Play className="size-2.5 fill-current" aria-hidden />
            {formatDuration(reel.duration)}
          </span>
        </div>

        {/* Centre: the play affordance, quiet until hovered. */}
        <span
          aria-hidden
          className={cn(
            "absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/40 backdrop-blur-md transition duration-500 ease-out",
            previewing ? "scale-75 opacity-0" : "group-hover:scale-110 group-hover:bg-white/25",
          )}
        >
          <Play className="size-5 translate-x-0.5 fill-current" />
        </span>

        {/* Bottom: place and title. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <p className="on-media flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-sun-300">
            <MapPin className="size-3 shrink-0" aria-hidden />
            {reel.place}
          </p>
          <p className="on-media mt-2 font-display text-[1.3rem] leading-[1.15] text-white">{reel.title}</p>
        </div>
      </button>
    </li>
  );
}

/* ------------------------------------------------------------- The viewer */

function ReelViewer({
  reels,
  index,
  onIndex,
  onClose,
}: {
  reels: Reel[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const fillRef = React.useRef<HTMLSpanElement>(null);
  // Opened by a tap, so sound is allowed; the browser may still refuse, see play() below.
  const [muted, setMuted] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const reel = reels[index]!;
  const last = index === reels.length - 1;

  // The frame is the whole screen on a phone and 9:16 elsewhere; frame each clip for it.
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [stage, setStage] = React.useState({ w: 9, h: 16 });
  React.useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => {
      const r = e?.contentRect;
      if (r && r.width && r.height) setStage({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const keep = 1 - (reel.cropTop ?? 0);
  const vis = visibleSize(reel);
  const fit = fitFor(stage.w, stage.h, vis.w, vis.h, reel.maxZoom);
  const mask = fit === "contain" ? featherMask(stage.w, stage.h / keep, reel.width, reel.height) : undefined;

  const prev = React.useCallback(() => onIndex(Math.max(0, index - 1)), [index, onIndex]);
  const next = React.useCallback(() => (last ? onClose() : onIndex(index + 1)), [index, last, onIndex, onClose]);

  // A real modal: focus is held inside, Escape closes, the page behind stops scrolling.
  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    // Start on Close: a visible, labelled control, rather than whatever comes first in the DOM.
    dialog.querySelector<HTMLButtonElement>("button[data-close]")?.focus();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = overflow;
      opener?.focus();
    };
  }, []);

  // Each clip starts from the top, with sound if the browser allows it.
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    setPaused(false);
    v.play().catch(() => {
      v.muted = true;
      setMuted(true);
      v.play().catch(() => setPaused(true));
    });
  }, [index]);

  // The current segment follows the clip's clock.
  React.useEffect(() => {
    let frame = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && v.duration && fillRef.current) {
        fillRef.current.style.transform = `scaleX(${Math.min(1, v.currentTime / v.duration)})`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [index]);

  const togglePaused = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") prev();
    else if (e.key === " " || e.key === "k") {
      e.preventDefault();
      togglePaused();
    } else if (e.key === "m") setMuted((m) => !m);
    else return;
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label={`${reel.title}, ${reel.place}`}
      onClose={onClose}
      onKeyDown={onKeyDown}
      // A click on the dimmed area around the video closes it.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-0 h-[100dvh] max-h-none w-screen max-w-none bg-transparent p-0 text-white backdrop:bg-[rgb(6_14_11/0.9)] backdrop:backdrop-blur-md open:flex open:items-center open:justify-center"
    >
      {/* Desktop: step buttons either side of the frame. */}
      <button
        type="button"
        onClick={prev}
        disabled={index === 0}
        aria-label="Previous clip"
        className="mr-6 hidden size-12 place-items-center rounded-full bg-white/10 ring-1 ring-white/20 transition hover:bg-white/20 disabled:opacity-0 sm:grid"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>

      <div ref={stageRef} className="anim-fade relative h-full w-full overflow-hidden bg-black sm:aspect-[9/16] sm:h-[min(90dvh,54rem)] sm:w-auto sm:rounded-[1.5rem] sm:shadow-[0_40px_120px_-40px_rgb(0_0_0/0.9)] sm:ring-1 sm:ring-white/10">
        {fit === "contain" ? <AmbientFill key={`fill-${reel.src}`} poster={reel.poster} /> : null}
        <video
          key={reel.src}
          ref={videoRef}
          src={reel.src}
          poster={reel.poster}
          muted={muted}
          playsInline
          preload="auto"
          disablePictureInPicture
          onEnded={next}
          style={{ ...cropStyle(reel.cropTop), ...(mask ? { maskImage: mask, WebkitMaskImage: mask } : null) }}
          className={cn("absolute inset-0 size-full", fit === "cover" ? "object-cover" : "object-contain")}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/60 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        {/* Tap zones, as in stories: left third back, right third forward, middle pauses. */}
        {/* Pointer-only: keyboard and screen-reader users have the labelled controls and the arrow keys. */}
        <div aria-hidden className="absolute inset-0 grid grid-cols-[1fr_1fr_1fr]">
          <button type="button" tabIndex={-1} onClick={prev} className="cursor-w-resize outline-none" />
          <button type="button" tabIndex={-1} onClick={togglePaused} className="cursor-pointer outline-none" />
          <button type="button" tabIndex={-1} onClick={next} className="cursor-e-resize outline-none" />
        </div>

        {paused ? (
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/40 ring-1 ring-white/30 backdrop-blur-md"
          >
            <Play className="size-6 translate-x-0.5 fill-current" />
          </span>
        ) : null}

        {/* Top: one segment per clip, then sound and close. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4 [&_button]:pointer-events-auto">
          <div className="flex gap-1">
            {reels.map((r, i) => (
              <span key={r.src} className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                <span
                  key={i === index ? "active" : "idle"}
                  ref={i === index ? fillRef : undefined}
                  className="absolute inset-0 origin-left rounded-full bg-white"
                  style={{ transform: `scaleX(${i < index ? 1 : 0})` }}
                />
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-white/80 tabular-nums">
              {index + 1} / {reels.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={togglePaused}
                aria-label={paused ? "Play" : "Pause"}
                className="grid size-10 place-items-center rounded-full transition hover:bg-white/15"
              >
                {paused ? <Play className="size-[1.1rem]" aria-hidden /> : <Pause className="size-[1.1rem]" aria-hidden />}
              </button>
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "Turn sound on" : "Turn sound off"}
                className="grid size-10 place-items-center rounded-full transition hover:bg-white/15"
              >
                {muted ? <VolumeX className="size-[1.1rem]" aria-hidden /> : <Volume2 className="size-[1.1rem]" aria-hidden />}
              </button>
              <button
                type="button"
                data-close
                onClick={onClose}
                aria-label="Close"
                className="grid size-10 place-items-center rounded-full transition hover:bg-white/15"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom: what you are watching, and where it leads. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
          <p key={reel.src} className="anim-fade flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-sun-300">
            <MapPin className="size-3 shrink-0" aria-hidden />
            {reel.place}
          </p>
          <p className="mt-2 font-display text-2xl leading-tight">{reel.title}</p>
          <Link
            href="/tours"
            className="pointer-events-auto relative mt-4 inline-flex items-center gap-2 rounded-full bg-sun-500 px-4 py-2.5 text-sm font-semibold text-forest-950 transition hover:bg-sun-400"
          >
            Plan a trip like this
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>

      <button
        type="button"
        onClick={next}
        aria-label={last ? "Close" : "Next clip"}
        className="ml-6 hidden size-12 place-items-center rounded-full bg-white/10 ring-1 ring-white/20 transition hover:bg-white/20 sm:grid"
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>
    </dialog>
  );
}
