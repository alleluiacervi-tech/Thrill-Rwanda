import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/ui/primitives";
import { authImage } from "@/lib/images";
import { getSite } from "@/lib/settings";

/**
 * Split layout for the auth screens: form on the left on a light ground,
 * a dark editorial panel on the right. Deliberately without the site header
 * — nothing on these pages should compete with the single task.
 */
export async function AuthShell({
  title,
  lede,
  children,
  footer,
}: {
  title: string;
  lede?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const site = await getSite();
  return (
    /* On desktop the page itself never scrolls: it is exactly one viewport
       tall with overflow clipped, and the form column carries its own
       scrollbar for the rare form that outgrows the screen. That keeps the
       photograph and the whole layout fixed instead of the page sliding
       under it. Mobile keeps normal document flow — a locked viewport with
       an on-screen keyboard is a trap. */
    <main
      id="main"
      className="min-h-svh lg:grid lg:h-svh lg:grid-cols-[1fr_0.9fr] lg:overflow-hidden"
    >
      {/* ------------------------------------------------------------ Form */}
      <div className="flex min-w-0 flex-col px-5 py-6 sm:px-8 lg:h-svh lg:overflow-y-auto lg:px-14 lg:py-7">
        <Link
          href="/"
          aria-label={`${site.name} home`}
          className="shrink-0 text-forest-800"
        >
          <Logo className="h-14" />
        </Link>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          {/* Deliberately smaller than a page headline. These screens are a
              single task, and the form has to clear the fold. */}
          <h1 className="text-3xl sm:text-4xl">{title}</h1>
          {lede ? (
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
              {lede}
            </p>
          ) : null}
          <div className="mt-6">{children}</div>
          {footer ? (
            <div className="mt-6 text-sm text-[var(--ink-muted)]">{footer}</div>
          ) : null}
        </div>

        <p className="shrink-0 text-2xs text-[var(--ink-faint)]">
          © {new Date().getFullYear()} {site.legalName} ·{" "}
          <Link href="/legal/privacy" className="link-draw">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/legal/terms" className="link-draw">
            Terms
          </Link>
        </p>
      </div>

      {/* ----------------------------------------------------------- Panel
          Pinned to the viewport rather than stretched to the form's height.
          As a plain grid item it grew as tall as the tallest column, and
          because its content is bottom-aligned the quote ended up below the
          fold on the longer forms — sign-up opened on a panel of empty sky
          with the quote clipped at the edge. sticky + h-svh keeps it
          composed at any form length. */}
      <aside className="on-dark relative hidden overflow-hidden bg-forest-900 lg:sticky lg:top-0 lg:block lg:h-svh lg:self-start">
     
        <Image
          src={authImage}
          alt=""
          fill
          priority
          sizes="(max-width: 1024px) 0px, 45vw"
          className="object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgb(15 58 44 / 0.95) 0%, rgb(15 58 44 / 0.80) 26%, rgb(21 74 56 / 0.42) 52%, rgb(21 74 56 / 0.14) 100%)",
          }}
        />
        {/* Keeps the frame in the brand's green rather than whatever the
            photograph's own cast happens to be. Kept light — at 30% it
            turned the sunset olive. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-forest-900/18 mix-blend-multiply"
        />
        <div
          aria-hidden
          className="contours absolute inset-0 opacity-[0.09] [background-size:640px_640px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 top-10 size-[28rem] rounded-full bg-ember-500/15 blur-[110px]"
        />

        <Container className="relative flex h-full flex-col justify-end pb-16">
          {/* What the service actually does. No invented testimonial or trip counts. */}
          <p className="max-w-md font-display text-3xl leading-snug text-bone-50">
            Safaris, stays, car hire and airport transfers, on one booking with
            one team in Kigali.
          </p>

          <ul className="mt-12 grid gap-6 border-t border-forest-400/20 pt-8 sm:grid-cols-3">
            {[
              { t: "Verified providers", d: "Licence and insurance checked before a listing goes live." },
              { t: "Mobile money or card", d: "Paid securely through Pesapal." },
              { t: "Real availability", d: "Dates are held the moment you book." },
            ].map((s) => (
              <li key={s.t}>
                <span className="block text-sm font-semibold text-bone-50">{s.t}</span>
                <span className="mt-1 block text-2xs leading-relaxed text-forest-300">{s.d}</span>
              </li>
            ))}
          </ul>
        </Container>
      </aside>
    </main>
  );
}
