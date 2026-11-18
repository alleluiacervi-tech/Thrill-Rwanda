import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, SectionHead } from "@/components/ui/primitives";
import { reels, trailPhotos } from "@/lib/media";
import { ReelsShowcase } from "@/components/home/reels-showcase";

/* ============================================================== InMotion */

export function InMotion({ preload = true }: { preload?: boolean }) {
  return (
    <section id="in-motion" className="on-dark relative overflow-hidden bg-forest-950 py-24 sm:py-32">
      <div aria-hidden className="contours absolute inset-0 opacity-[0.06]" />
      <Container wide className="relative">
        <SectionHead
          eyebrow="Rwanda in motion"
          title="See the Land of a Thousand Hills before you go"
          lede="Real footage from our own trips: gorilla families, crater lakes and the shores of Lake Kivu. Tap any clip to watch it full screen, with sound."
          action={
            <Button
              href="https://www.instagram.com/thrillrwanda"
              variant="outline"
              className="border-forest-400/40 text-bone-50 hover:bg-bone-50 hover:text-forest-900"
            >
              Follow @thrillrwanda
              <ArrowRight className="size-4" />
            </Button>
          }
        />
        <div className="mt-14">
          <ReelsShowcase reels={reels} preload={preload} />
        </div>
      </Container>
    </section>
  );
}

/* =========================================================== TrailPhotos */

export function TrailPhotos() {
  const [lead, ...rest] = trailPhotos;
  return (
    <section id="trail" className="py-24 sm:py-32">
      <Container wide>
        <SectionHead
          eyebrow="From the trail"
          title="Moments from our journeys"
          lede="Canopy bridges, misty volcano slopes and Kigali at night, photographed on Thrill Rwanda trips."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <figure className="group relative min-h-[20rem] overflow-hidden rounded-[var(--radius-card)] sm:col-span-2 sm:row-span-2 lg:min-h-[34rem]">
            <Image src={lead.src} alt={lead.alt} fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
            <Caption>{lead.caption}</Caption>
          </figure>
          {rest.map((p) => (
            <figure key={p.src} className="group relative aspect-square overflow-hidden rounded-[var(--radius-card)]">
              <Image src={p.src} alt={p.alt} fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover transition duration-700 group-hover:scale-105" />
              <Caption>{p.caption}</Caption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <figcaption className="absolute inset-x-0 bottom-0 scrim-b p-4 pt-16 text-sm font-semibold text-white sm:p-5">
      {children}
    </figcaption>
  );
}

