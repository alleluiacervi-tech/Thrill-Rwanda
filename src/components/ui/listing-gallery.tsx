"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { Media } from "@/components/ui/media";
import { cn } from "@/lib/utils";

/**
 * The hero of a listing page: every uploaded photo, not just the cover.
 *
 * A scroll-snap track rather than a JS carousel — swiping on a phone is then
 * the browser's own gesture, and it still works before hydration.
 */
export function ListingGallery({
  seed,
  images,
  alt,
  className,
  layout = "hero",
  children,
}: {
  seed: string;
  images: string[];
  alt: string;
  /** Height of the hero. */
  className?: string;
  /** "framed" is a rectangle in the page with thumbnails — right for cars, whose photos crop badly full-bleed. */
  layout?: "hero" | "framed";
  /** Overlay layers drawn above the photo, e.g. the top gradient. */
  children?: React.ReactNode;
}) {
  const [index, setIndex] = React.useState(0);
  const [zoomed, setZoomed] = React.useState<number | null>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);

  // Slides are measured in pixels, so a rotate or window resize would leave the track between two photos.
  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const realign = () => track.scrollTo({ left: index * track.clientWidth, behavior: "instant" });
    window.addEventListener("resize", realign);
    return () => window.removeEventListener("resize", realign);
  }, [index]);

  const framed = layout === "framed";

  // One photo (or none): nothing to page through, so keep the plain frame.
  if (images.length < 2) {
    return (
      <Media
        seed={seed}
        src={images[0]}
        alt={alt}
        priority
        sizes={framed ? "(max-width: 1024px) 100vw, 60vw" : "100vw"}
        className={cn(className, framed && "rounded-[var(--radius-card)] border border-[var(--line)]")}
      >
        {children}
      </Media>
    );
  }

  const go = (to: number) => {
    const track = trackRef.current;
    if (!track) return;
    const next = (to + images.length) % images.length;
    track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
    setIndex(next);
  };

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden",
          framed && "rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-sunken)]",
          className,
        )}
        role="group"
        aria-roledescription="carousel"
        aria-label={`${alt}, ${images.length} photos`}
      >
        <div
          ref={trackRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(index + 1);
            if (e.key === "ArrowLeft") go(index - 1);
          }}
          tabIndex={0}
          className="flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((src, i) => (
            <div key={src + i} className="relative h-full w-full shrink-0 snap-center">
              <Image
                src={src}
                alt={i === 0 ? alt : `${alt}, photo ${i + 1} of ${images.length}`}
                fill
                sizes={framed ? "(max-width: 1024px) 100vw, 60vw" : "100vw"}
                // Only the first is above the fold on arrival; the rest load as they are reached.
                // preload, not the deprecated priority: Next 16 renamed it.
                preload={i === 0}
                loading={i === 0 ? "eager" : "lazy"}
                className="object-cover"
              />
            </div>
          ))}
        </div>

        {children}

        {/* Bottom-right, clear of the title and breadcrumbs on the left. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-end p-4 sm:p-6">
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoomed(index)}
              className="hidden h-9 items-center gap-2 rounded-full bg-forest-950/55 px-4 text-2xs font-semibold text-bone-50 backdrop-blur transition-colors hover:bg-forest-950/80 sm:inline-flex"
            >
              <Expand className="size-3.5" />
              View all {images.length} photos
            </button>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous photo"
              className="grid size-9 place-items-center rounded-full bg-forest-950/55 text-bone-50 backdrop-blur transition-colors hover:bg-forest-950/80"
            >
              <ChevronLeft className="size-4.5" />
            </button>
            {/* Doubles as the way into the full-screen view on phones, where the labelled button is hidden. */}
            <button
              type="button"
              onClick={() => setZoomed(index)}
              aria-label={`View all ${images.length} photos`}
              className="tnum rounded-full bg-forest-950/55 px-3 py-1.5 text-2xs font-semibold text-bone-50 backdrop-blur transition-colors hover:bg-forest-950/80"
            >
              {index + 1} / {images.length}
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next photo"
              className="grid size-9 place-items-center rounded-full bg-forest-950/55 text-bone-50 backdrop-blur transition-colors hover:bg-forest-950/80"
            >
              <ChevronRight className="size-4.5" />
            </button>
          </div>
        </div>
      </div>

      {framed ? (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => go(i)}
              aria-label={`Photo ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "relative h-16 w-24 shrink-0 overflow-hidden rounded-[var(--radius-inset)] border-2 transition-opacity sm:h-20 sm:w-28",
                i === index ? "border-forest-800" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <Image src={src} alt="" fill sizes="112px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      {zoomed !== null ? (
        <Lightbox
          images={images}
          alt={alt}
          start={zoomed}
          onClose={(last) => {
            setZoomed(null);
            go(last);
          }}
        />
      ) : null}
    </>
  );
}

function Lightbox({
  images,
  alt,
  start,
  onClose,
}: {
  images: string[];
  alt: string;
  start: number;
  onClose: (index: number) => void;
}) {
  const [i, setI] = React.useState(start);
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    ref.current?.showModal();
    // The page behind must not scroll while a full-screen photo is open.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const step = (delta: number) => setI((n) => (n + delta + images.length) % images.length);

  return (
    <dialog
      ref={ref}
      onClose={() => onClose(i)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") step(1);
        if (e.key === "ArrowLeft") step(-1);
      }}
      aria-label={`${alt}, photo ${i + 1} of ${images.length}`}
      className="h-full max-h-none w-full max-w-none bg-forest-950/95 p-0 backdrop:bg-forest-950/80"
    >
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-3 text-bone-50 sm:px-6">
          <p className="tnum text-sm">
            {i + 1} / {images.length}
          </p>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close photos"
            className="grid size-9 place-items-center rounded-full bg-bone-50/10 text-bone-50 transition-colors hover:bg-bone-50/20"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          <Image
            src={images[i]!}
            alt={`${alt}, photo ${i + 1} of ${images.length}`}
            fill
            sizes="100vw"
            className="object-contain"
          />
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-forest-950/60 text-bone-50 transition-colors hover:bg-forest-950/90"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-forest-950/60 text-bone-50 transition-colors hover:bg-forest-950/90"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto p-4 sm:px-6">
          {images.map((src, n) => (
            <button
              key={src + n}
              type="button"
              onClick={() => setI(n)}
              aria-label={`Photo ${n + 1}`}
              aria-current={n === i}
              className={cn(
                "relative h-14 w-20 shrink-0 overflow-hidden rounded-[var(--radius-inset)] ring-2 transition-opacity",
                n === i ? "ring-ember-500" : "opacity-60 ring-transparent hover:opacity-100",
              )}
            >
              <Image src={src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      </div>
    </dialog>
  );
}
