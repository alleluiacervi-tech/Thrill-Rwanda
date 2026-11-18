"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * A silent, looping clip for the homepage hero.
 *
 * The poster is the real content: it is in the server HTML and paints at
 * once. The clip is an enhancement mounted only when the visitor's screen
 * matches `media`, they have not asked for reduced motion and they are not on
 * a data saver. So a phone never downloads the desktop-only panels, and a
 * failed or blocked video simply leaves the still in place.
 */
function subscribeTo(query: string) {
  return (onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
}

export function useMotionAllowed(media: string) {
  const query = `${media} and (prefers-reduced-motion: no-preference)`;
  const subscribe = React.useMemo(() => subscribeTo(query), [query]);
  return React.useSyncExternalStore(
    subscribe,
    () => {
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      return window.matchMedia(query).matches && !connection?.saveData;
    },
    () => false,
  );
}

export function HeroReel({
  src,
  poster,
  alt,
  media = "all",
  sizes,
  eager = false,
  video = true,
  className,
  children,
}: {
  src: string;
  poster: string;
  alt: string;
  /** Media query the clip is allowed to load under, e.g. "(min-width: 1024px)". */
  media?: string;
  sizes: string;
  /** Load the poster ahead of the queue; for the frame that is the largest paint. */
  eager?: boolean;
  /** Off (Admin → Settings) shows the still only, and never loads the clip. */
  video?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const allowed = useMotionAllowed(media) && video;
  const [playing, setPlaying] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Stop decoding once the hero has scrolled away.
  React.useEffect(() => {
    const video = videoRef.current;
    if (!allowed || !video || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) video.play().catch(() => {});
      else video.pause();
    });
    io.observe(video);
    return () => io.disconnect();
  }, [allowed]);

  return (
    <div className={cn("relative overflow-hidden bg-forest-950", className)}>
      <Image
        src={poster}
        alt={alt}
        fill
        sizes={sizes}
        unoptimized
        loading={eager ? "eager" : undefined}
        fetchPriority={eager ? "high" : undefined}
        className="object-cover"
      />
      {allowed ? (
        <video
          ref={videoRef}
          src={src}
          muted
          loop
          autoPlay
          playsInline
          preload="auto"
          aria-hidden
          tabIndex={-1}
          disablePictureInPicture
          onPlaying={() => setPlaying(true)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-700",
            playing ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
      {children}
    </div>
  );
}
