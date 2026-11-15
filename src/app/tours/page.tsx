import { requirePublicService } from "@/lib/publication";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Pagination } from "@/components/ui/pagination";
import { paginateList } from "@/lib/pagination";
import { PageShell, PageHero } from "@/components/layout/page-shell";
import { FilterBar } from "@/components/search/filter-bar";
import { TourCard } from "@/components/cards/listing-cards";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { listTours, type CatalogueTour } from "@/lib/catalogue";
import { destinations } from "@/lib/content";
import { destinationImages } from "@/lib/images";

export const metadata: Metadata = {
  title: "Tours & Safaris in Rwanda",
  description:
    "Explore Rwanda itineraries and request a checked quote for your dates, group size and interests.",
  alternates: { canonical: "/tours" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const sorts = [
  { value: "", label: "Recommended" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Best rated" },
  { value: "duration", label: "Duration" },
];

const filterGroups = [
  {
    key: "destination",
    label: "Destination",
    options: destinations.map((d) => ({ value: d.name, label: d.name })),
  },
  {
    key: "duration",
    label: "Duration",
    options: [
      { value: "day", label: "Day trip" },
      { value: "short", label: "2–3 days" },
      { value: "long", label: "4+ days" },
    ],
  },
  {
    key: "budget",
    label: "Budget",
    options: [
      { value: "under-500", label: "Under $500" },
      { value: "500-1500", label: "$500 – $1,500" },
      { value: "over-1500", label: "Over $1,500" },
    ],
  },
];

/** Pure filtering so the same rules can move to a Prisma `where` later. */
function applyFilters(list: CatalogueTour[], sp: Record<string, string>) {
  let out = [...list];

  const q = sp.q?.toLowerCase();
  if (q) {
    out = out.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.destination.toLowerCase().includes(q) ||
        t.activities.some((a) => a.toLowerCase().includes(q)),
    );
  }

  if (sp.destination) {
    out = out.filter((t) => t.destination === sp.destination);
  }

  if (sp.duration === "day") out = out.filter((t) => t.durationDays === 1);
  if (sp.duration === "short")
    out = out.filter((t) => t.durationDays >= 2 && t.durationDays <= 3);
  if (sp.duration === "long") out = out.filter((t) => t.durationDays >= 4);

  if (sp.budget === "under-500")
    out = out.filter((t) => t.priceFrom < 50_000);
  if (sp.budget === "500-1500")
    out = out.filter(
      (t) => t.priceFrom >= 50_000 && t.priceFrom <= 150_000,
    );
  if (sp.budget === "over-1500")
    out = out.filter((t) => t.priceFrom > 150_000);

  switch (sp.sort) {
    case "price-asc":
      out.sort((a, b) => a.priceFrom - b.priceFrom);
      break;
    case "price-desc":
      out.sort((a, b) => b.priceFrom - a.priceFrom);
      break;
    case "rating":
      out.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
      break;
    case "duration":
      out.sort((a, b) => a.durationDays - b.durationDays);
      break;
  }

  return out;
}

export default async function ToursPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePublicService("TRIP");
  const raw = await searchParams;
  const sp = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0]! : v ?? ""]),
  ) as Record<string, string>;

  const all = applyFilters(await listTours(), sp);
  const { page, items: results } = paginateList(sp, all, 12);

  return (
    <PageShell overHero>
      <PageHero
        eyebrow="Tours & Safaris"
        title="Guided by people who live there"
        lede="Explore approved itineraries and request a checked quotation for your dates, group and travel preferences."
        crumbs={[{ label: "Tours & Safaris" }]}
        image={destinationImages["volcanoes-national-park"]}
        imagePosition="center 60%"
      />

      <Suspense fallback={<div className="h-16" />}>
        <FilterBar
          groups={filterGroups}
          sorts={sorts}
          resultCount={all.length}
          searchLabel="Search safaris"
        />
      </Suspense>

      <Container wide className="py-14">
        {sp.q ? (
          <p className="mb-8 text-sm text-[var(--ink-muted)]">
            Showing results for{" "}
            <span className="font-medium text-[var(--ink)]">“{sp.q}”</span>
          </p>
        ) : null}

        {results.length > 0 ? (
          <>
            <h2 className="sr-only">Results</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((tour, i) => (
                <TourCard key={tour.slug} tour={tour} priority={i < 3} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState />
        )}

        <Pagination page={page} pathname="/tours" params={raw} label="safaris" />
      </Container>
    </PageShell>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="font-display text-6xl text-clay-300">—</p>
      <h2 className="mt-6 text-2xl">Nothing matches those filters</h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
        Try widening the dates or budget. If you tell us what you had in mind,
        we can usually build it as a private departure.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Button href="/tours" variant="outline">
          Clear filters
        </Button>
        <Button href="/contact" variant="accent">
          Ask us to plan it
        </Button>
      </div>
    </div>
  );
}
