import { requirePublicService } from "@/lib/publication";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Pagination } from "@/components/ui/pagination";
import { paginateList } from "@/lib/pagination";
import { PageShell, PageHero } from "@/components/layout/page-shell";
import { FilterBar } from "@/components/search/filter-bar";
import { VehicleCard } from "@/components/cards/listing-cards";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { listVehicles, type CatalogueVehicle } from "@/lib/catalogue";
import { vehicleImages } from "@/lib/images";

export const metadata: Metadata = {
  title: "Car Hire in Rwanda — Self-Drive & Chauffeured",
  description:
    "Safari-ready 4x4s, executive sedans and compact SUVs for hire in Kigali and across Rwanda. Self-drive or with a driver, unlimited mileage options.",
  alternates: { canonical: "/cars" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const sorts = [
  { value: "", label: "Recommended" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Best rated" },
  { value: "seats", label: "Most seats" },
];

const filterGroups = [
  {
    key: "category",
    label: "Vehicle type",
    options: [
      { value: "4x4 Safari", label: "4x4 Safari" },
      { value: "Executive Van", label: "Executive Van" },
      { value: "Executive Sedan", label: "Executive Sedan" },
      { value: "Compact SUV", label: "Compact SUV" },
    ],
  },
  {
    key: "seats",
    label: "Seats",
    options: [
      { value: "4", label: "4+ seats" },
      { value: "6", label: "6+ seats" },
      { value: "7", label: "7+ seats" },
    ],
  },
  {
    key: "transmission",
    label: "Transmission",
    options: [
      { value: "Automatic", label: "Automatic" },
      { value: "Manual", label: "Manual" },
    ],
  },
];

function applyFilters(list: CatalogueVehicle[], sp: Record<string, string>) {
  let out = [...list];

  const q = sp.q?.toLowerCase();
  if (q) {
    out = out.filter(
      (v) =>
        `${v.make} ${v.model}`.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q),
    );
  }

  if (sp.category) out = out.filter((v) => v.category === sp.category);
  if (sp.seats) out = out.filter((v) => v.seats >= Number(sp.seats));
  if (sp.transmission)
    out = out.filter((v) => v.transmission === sp.transmission);

  switch (sp.sort) {
    case "price-asc":
      out.sort((a, b) => a.pricePerDay - b.pricePerDay);
      break;
    case "price-desc":
      out.sort((a, b) => b.pricePerDay - a.pricePerDay);
      break;
    case "rating":
      out.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
      break;
    case "seats":
      out.sort((a, b) => b.seats - a.seats);
      break;
  }

  return out;
}

export default async function CarsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePublicService("TRANSPORT");
  const raw = await searchParams;
  const sp = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0]! : v ?? ""]),
  ) as Record<string, string>;

  const all = applyFilters(await listVehicles(), sp);
  const { page, items: results } = paginateList(sp, all, 12);

  return (
    <PageShell overHero>
      <PageHero
        eyebrow="Car Hire"
        title="A vehicle that suits the road"
        lede="Ask about self-drive or chauffeured transport. Vehicle availability, insurance conditions and handover terms are checked for your arrangement."
        crumbs={[{ label: "Car Hire" }]}
        image={vehicleImages["toyota-rav4-2022"]}
        imagePosition="center 70%"
      />

      <Suspense fallback={<div className="h-16" />}>
        <FilterBar
          groups={filterGroups}
          sorts={sorts}
          resultCount={all.length}
          searchLabel="Search vehicles"
        />
      </Suspense>

      <Container wide className="py-14">
        {results.length > 0 ? (
          <>
            <h2 className="sr-only">Results</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((v) => (
                <VehicleCard key={v.slug} vehicle={v} />
              ))}
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-md py-20 text-center">
            <p className="font-display text-6xl text-clay-300">—</p>
            <h2 className="mt-6 text-2xl">No vehicles match</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
              Our fleet partners hold more stock than is listed here,
              especially for longer hires. Tell us the dates and we will check.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Button href="/cars" variant="outline">
                Clear filters
              </Button>
              <Button href="/contact" variant="accent">
                Check availability
              </Button>
            </div>
          </div>
        )}

        <Pagination page={page} pathname="/cars" params={raw} label="vehicles" />
      </Container>
    </PageShell>
  );
}
