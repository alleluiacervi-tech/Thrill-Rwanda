import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Container, Rating, SectionHead } from "@/components/ui/primitives";
import { platformRating, recentReviews } from "@/lib/reviews";

export const metadata: Metadata = {
  title: "Reviews",
  description:
    "What travellers say about booking safaris, hotels, car hire and airport transfers through us. Every review comes from a completed booking.",
  alternates: { canonical: "/reviews" },
};

// Reviews change as customers leave them and admins approve them.
export const revalidate = 300;

export default async function ReviewsPage() {
  const [summary, reviews] = await Promise.all([
    platformRating(),
    recentReviews(30),
  ]);

  const hasReviews = summary.count > 0 && summary.value !== null;

  return (
    <PageShell overHero>
      <PageHero
        eyebrow="Reviews"
        title={
          hasReviews
            ? `${summary.value!.toFixed(1)} average, from ${summary.count} ${summary.count === 1 ? "trip" : "trips"}`
            : "What travellers say"
        }
        lede="Every review here comes from a completed booking made on this platform. We publish the poor ones too."
        crumbs={[{ label: "Reviews" }]}
      />

      <Container wide className="grid gap-14 py-16 lg:grid-cols-[20rem_1fr] lg:gap-20">
        <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-7">
            {hasReviews ? (
              <>
                <p className="tnum font-display text-6xl font-semibold">
                  {summary.value!.toFixed(1)}
                </p>
                <Rating value={summary.value!} count={summary.count} className="mt-3" />

                <ul className="mt-7 space-y-2.5">
                  {summary.distribution.map((row) => (
                    <li key={row.stars} className="flex items-center gap-3">
                      <span className="tnum w-3 text-2xs text-[var(--ink-faint)]">
                        {row.stars}
                      </span>
                      <span
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--paper-sunken)]"
                        role="img"
                        aria-label={`${row.share}% gave ${row.stars} stars`}
                      >
                        <span
                          className="block h-full rounded-full bg-ember-500"
                          style={{ width: `${row.share}%` }}
                        />
                      </span>
                      <span className="tnum w-8 text-right text-2xs text-[var(--ink-faint)]">
                        {row.share}%
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
                No published reviews yet. They appear here as trips complete
                and our team approves them.
              </p>
            )}

            <p className="mt-7 border-t border-[var(--line)] pt-5 text-2xs leading-relaxed text-[var(--ink-faint)]">
              Reviews can only be left by customers whose booking is marked
              completed, so every rating is tied to a real trip.
            </p>
          </div>
        </aside>

        <div className="min-w-0">
          {reviews.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--line-strong)] p-10 text-center">
              <p className="font-display text-5xl text-clay-300">—</p>
              <h2 className="mt-5 text-xl">Nothing published yet</h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[var(--ink-muted)]">
                We&rsquo;d rather show you nothing than show you reviews we
                wrote ourselves.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <figure
                  key={r.id}
                  className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-7"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Rating value={r.rating} />
                    <span className="text-2xs text-[var(--ink-faint)]">
                      {r.subject}
                    </span>
                  </div>
                  {r.comment ? (
                    <blockquote className="mt-4 text-base leading-relaxed">
                      {r.comment}
                    </blockquote>
                  ) : null}
                  <figcaption className="mt-5 border-t border-[var(--line)] pt-4">
                    <span className="block font-medium">{r.authorName}</span>
                    <span className="tnum mt-0.5 block text-2xs uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                      {new Intl.DateTimeFormat("en-GB", {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      }).format(r.createdAt)}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </Container>

      <section className="border-t border-[var(--line)] py-20">
        <Container wide>
          <SectionHead
            eyebrow="Travelled with us?"
            title="Leave a review"
            align="center"
            lede="Open your booking once the trip is marked complete and the review form is right there."
            action={
              <Button href="/account/bookings" variant="accent" size="lg">
                My bookings
              </Button>
            }
          />
        </Container>
      </section>
    </PageShell>
  );
}
