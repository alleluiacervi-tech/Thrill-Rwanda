import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Media
 *
 * The catalogue has no photography yet. Rather than ship grey boxes, this
 * derives a deterministic in-palette duotone from the item's slug and lays
 * the site's contour motif over it, so unphotographed listings still look
 * composed and never repeat the same colour twice in a row.
 *
 * When real photography arrives, pass `src` — the placeholder drops out and
 * next/image takes over. No other change needed at the call site.
 */

/**
 * Weighted toward forest. Orange is the brand accent and loses its force if
 * every other tile is warm, so only one wash in six runs hot.
 */
const washes = [
  ["#1c5c45", "#2f8060"], // forest
  ["#154a38", "#3a9470"], // deep forest
  ["#256e52", "#57a888"], // sage
  ["#4a230a", "#a85c22"], // bark
  ["#154a38", "#2a7a5a"], // pine
  ["#6b330f", "#c07636"], // clay
] as const;

function hash(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function Media({
  seed,
  src,
  alt,
  fill = true,
  sizes,
  priority,
  className,
  children,
}: {
  seed: string;
  src?: string;
  alt: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const [from, to] = washes[hash(seed) % washes.length];
  const angle = 120 + (hash(seed + "a") % 110);

  return (
    <div className={cn("media-zoom relative overflow-hidden", className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill={fill}
          sizes={sizes ?? "(max-width: 768px) 100vw, 33vw"}
          // priority was renamed preload in Next 16; eager stops it waiting for layout.
          preload={priority}
          loading={priority ? "eager" : undefined}
          className="object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={alt}
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(${angle}deg, ${from}, ${to})`,
          }}
        >
          <div
            aria-hidden
            className="contours-light absolute inset-0 opacity-[0.16]"
            style={{
              backgroundPosition: `${hash(seed) % 400}px ${hash(seed + "y") % 300}px`,
            }}
          />
          {/* horizon light, keeps the fill from reading flat */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 80% at 70% 15%, rgb(248 195 0 / 0.22), transparent 60%)",
            }}
          />
        </div>
      )}

      {/* Legibility scrim for overlaid text.
          Tuned against the BRIGHT images, not the dark ones: a beach shot
          under a white sky left the eyebrow and stat line barely readable
          with a lighter gradient. Concentrated in the bottom third, where
          captions sit, so the photograph above it stays open. */}
      <div aria-hidden className="scrim-b absolute inset-0" />
      {children}
    </div>
  );
}
