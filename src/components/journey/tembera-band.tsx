import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { JourneyIcon } from "@/components/journey/icons";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { TEMBERA, journeyImages } from "@/lib/journeys";

/** What one Tembera booking covers. Shared by the band and the campaign page. */
export const temberaIncludes = [
  { icon: "bus", label: "Transport", body: "From Kigali and back, together" },
  { icon: "utensils", label: "Meals", body: "Every table along the way" },
  { icon: "bed", label: "Stays", body: "Your nights, already arranged" },
  { icon: "compass", label: "A guide", body: "Someone who knows the road" },
  { icon: "ticket", label: "Entries", body: "Parks and activities on the plan" },
] as const;

/**
 * The campaign, as a band: the name set large, what one booking covers, and
 * three frames of the country pinned like photographs on a wall. Used on the
 * homepage and the experiences hub. `children` is the slot for live editions.
 */
export function TemberaBand({ children }: { children?: React.ReactNode }) {
  return (
    <section className="on-dark relative overflow-hidden bg-forest-950 py-20 sm:py-28">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 80% at 88% 20%, rgb(47 128 96 / 0.55), transparent 70%), radial-gradient(40% 60% at 0% 100%, rgb(8 109 187 / 0.22), transparent 70%)",
        }}
      />
      <div aria-hidden className="contours-light absolute inset-0 opacity-[0.05]" />

      <Container
        wide
        className="relative grid items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-20"
      >
        <div>
          <Eyebrow>All-inclusive editions</Eyebrow>
          <h2
            lang="rw"
            className="mt-4 font-display text-[clamp(3rem,1.6rem+6vw,6.5rem)] leading-[0.92] tracking-[-0.03em] text-white"
          >
            Tembera
            <em className="block text-sun-400">u Rwanda</em>
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-forest-100/85">
            &ldquo;{TEMBERA.meaning}.&rdquo; Join a dated edition and see the
            country the way it is meant to be seen: together, with everything
            already taken care of.
          </p>

          <ul className="mt-9 grid max-w-xl grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
            {temberaIncludes.map((item) => (
              <li key={item.label} className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-sun-400 ring-1 ring-white/15">
                  <JourneyIcon name={item.icon} className="size-[1.125rem]" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">
                    {item.label}
                  </span>
                  <span className="block text-xs leading-snug text-forest-200/75">
                    {item.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button
              href={TEMBERA.href}
              variant="accent"
              size="lg"
              data-service="TRIP"
              data-placement="HOME_SERVICES"
            >
              See the editions
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
          {children}
        </div>

        {/* Three frames, pinned at slight angles. Decorative: the captions live on the campaign page. */}
        <div
          aria-hidden
          className="relative mx-auto h-[24rem] w-full max-w-[34rem] sm:h-[30rem] lg:h-[34rem]"
        >
          <div className="absolute left-0 top-[8%] h-[62%] w-[52%] -rotate-[5deg] overflow-hidden rounded-[1.5rem] shadow-[0_30px_60px_-30px_rgb(4_14_10/0.9)] ring-1 ring-white/20">
            <Image
              src={journeyImages.culture}
              alt=""
              fill
              sizes="(min-width: 1024px) 18vw, 45vw"
              className="object-cover"
            />
          </div>
          <div className="absolute right-0 top-0 h-[58%] w-[54%] rotate-[4deg] overflow-hidden rounded-[1.5rem] shadow-[0_30px_60px_-30px_rgb(4_14_10/0.9)] ring-1 ring-white/20">
            <Image
              src={journeyImages.tembera}
              alt=""
              fill
              sizes="(min-width: 1024px) 18vw, 45vw"
              className="object-cover"
            />
          </div>
          <div className="absolute bottom-0 left-[20%] h-[48%] w-[62%] rotate-[1.5deg] overflow-hidden rounded-[1.5rem] shadow-[0_30px_60px_-30px_rgb(4_14_10/0.9)] ring-1 ring-white/20">
            <Image
              src={journeyImages.honeymoon}
              alt=""
              fill
              sizes="(min-width: 1024px) 22vw, 55vw"
              className="object-cover"
            />
          </div>
          {/* The stub: one booking, everything in it. */}
          <div className="absolute -bottom-3 right-0 w-[13.5rem] rotate-[-3deg] rounded-2xl bg-sun-500 p-4 text-forest-950 shadow-[0_24px_48px_-20px_rgb(4_14_10/0.9)] sm:right-[-4%]">
            <p className="text-2xs font-bold uppercase tracking-[0.18em]">One booking</p>
            <p className="mt-1 font-display text-2xl leading-[1.05]">
              Everything <em>included</em>
            </p>
            <div className="mt-3 border-t border-dashed border-forest-950/40 pt-2 text-2xs font-semibold uppercase tracking-[0.14em] text-forest-950/75">
              Kigali · the hills · home
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
