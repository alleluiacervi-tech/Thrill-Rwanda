import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { primaryNav } from "@/lib/site";
import { getSite } from "@/lib/settings";
import Link from "next/link";

export default async function NotFound() {
  const site = await getSite();
  return (
    <PageShell overHero>
      <section className="on-dark relative -mt-[4.5rem] flex min-h-[80svh] items-center overflow-hidden bg-forest-950 pt-32 lg:-mt-24">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 100% at 70% 10%, #256e52 0%, #154a38 55%, #0f3a2c 100%)",
          }}
        />
        <div
          aria-hidden
          className="contours absolute inset-0 opacity-[0.09] [background-size:700px_700px]"
        />

        <Container className="relative py-20 text-center">
          <p className="font-display text-[clamp(5rem,18vw,12rem)] font-semibold leading-none text-bone-50/10">
            404
          </p>
          <h1 className="-mt-6 text-display-sm text-bone-50">
            This road doesn&rsquo;t go anywhere
          </h1>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-forest-100/80">
            The page you were looking for has moved or never existed. Here is
            where most people are heading:
          </p>

          <nav aria-label="Popular pages" className="mt-9">
            <ul className="flex flex-wrap justify-center gap-2">
              {primaryNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex rounded-full border border-forest-400/35 px-4 py-2 text-sm text-bone-100 transition-colors hover:border-bone-50 hover:bg-bone-50 hover:text-forest-900"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button href="/" variant="accent" size="lg">
              Back to the homepage
            </Button>
            <Button
              href="/contact"
              variant="outline"
              size="lg"
              className="border-forest-400/40 text-bone-50 hover:bg-bone-50 hover:text-forest-900"
            >
              Contact us
            </Button>
          </div>

          <p className="mt-8 text-sm text-forest-300">
            Or call {site.contact.phone} — daily, 7am to 9pm EAT.
          </p>
        </Container>
      </section>
    </PageShell>
  );
}
