import { requirePublicService } from "@/lib/publication";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Pagination } from "@/components/ui/pagination";
import { paginateList } from "@/lib/pagination";
import { PageShell, PageHero } from "@/components/layout/page-shell";
import { FilterBar } from "@/components/search/filter-bar";
import { HotelCard } from "@/components/cards/listing-cards";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { listHotels, type CatalogueHotel } from "@/lib/catalogue";
import { destinationImages } from "@/lib/images";

export const metadata: Metadata = {
  title: "Hotels, Lodges & Camps in Rwanda",
  description:
    "Explore Rwanda stays and ask the desk to check room options, inclusions and prices for your dates.",
  alternates: { canonical: "/hotels" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const sorts = [
  { value: "", label: "Recommended" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Best rated" },
];

const filterGroups = [
  {
    key: "area",
    label: "Area",
    options: [
      { value: "Musanze", label: "Musanze (Volcanoes)" },
      { value: "Rubavu", label: "Lake Kivu (Rubavu)" },
      { value: "Kigali", label: "Kigali" },
      { value: "Akagera", label: "Akagera" },
    ],
  },
  {
    key: "stars",
    label: "Star rating",
    options: [
      { value: "5", label: "5 star" },
      { value: "4", label: "4 star and up" },
    ],
  },
  {
    key: "board",
    label: "Board",
    options: [
      { value: "All-inclusive", label: "All-inclusive" },
      { value: "Full board", label: "Full board" },
      { value: "Breakfast", label: "Breakfast included" },
    ],
  },
];

function applyFilters(list: CatalogueHotel[], sp: Record<string, string>) {
  let out = [...list];

  const q = sp.q?.toLowerCase();
  if (q) {
    out = out.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.location.toLowerCase().includes(q),
    );
  }

  if (sp.area) out = out.filter((h) => h.location.includes(sp.area));
  if (sp.stars) out = out.filter((h) => (h.stars ?? 0) >= Number(sp.stars));
  if (sp.board)
    out = out.filter((h) =>
      h.amenities.some((a) => a.toLowerCase() === sp.board.toLowerCase()),
    );

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
  }

  return out;
}

export default async function HotelsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePublicService("STAY");
  const raw = await searchParams;
  const sp = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0]! : v ?? ""]),
  ) as Record<string, string>;

  const all = applyFilters(await listHotels(), sp);
  const { page, items: results } = paginateList(sp, all, 12);

  return (
    <PageShell overHero>
      <PageHero
        eyebrow="Hotels & Concierge"
        title="Somewhere good to land"
        lede="Beach lodges, tented camps and serviced city apartments. We visit and verify each one before it goes on the platform."
        crumbs={[{ label: "Hotels" }]}
        image={destinationImages["lake-kivu"]}
      />

      <Suspense fallback={<div className="h-16" />}>
        <FilterBar
          groups={filterGroups}
          sorts={sorts}
          resultCount={all.length}
          searchLabel="Search stays"
        />
      </Suspense>

      <Container wide className="py-14">
        {results.length > 0 ? (
          <>
            <h2 className="sr-only">Results</h2>
            <div className="grid gap-5 lg:grid-cols-2">
              {results.map((hotel) => (
                <HotelCard key={hotel.slug} hotel={hotel} />
              ))}
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-md py-20 text-center">
            <p className="font-display text-6xl text-clay-300">—</p>
            <h2 className="mt-6 text-2xl">No properties match</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
              We work with more properties than are listed here. Tell us the
              area and dates and the concierge desk will come back with
              options.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Button href="/hotels" variant="outline">
                Clear filters
              </Button>
              <Button href="/contact" variant="accent">
                Ask the desk
              </Button>
            </div>
          </div>
        )}

        <Pagination page={page} pathname="/hotels" params={raw} label="stays" />
      </Container>
    </PageShell>
  );
}
