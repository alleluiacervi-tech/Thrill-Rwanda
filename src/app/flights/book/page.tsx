import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/primitives";
import { FareRow, SearchSummary, ShopNotice, StaffPreview } from "@/components/booking/flight-shop";
import s from "@/components/booking/flight-shop.module.css";
import { airportCity } from "@/lib/flight-geography";
import { todayInRwanda } from "@/lib/flight-enquiry-schema";
import { parseShopSearch, rwfPrice, searchQuery } from "@/lib/flight-shop-rules";
import { formatQuoteMoney } from "@/lib/quote-rules";
import { ShopError, shopAvailability, shopFlights, type ShopResults } from "@/lib/flight-shop";
import { requirePublicService } from "@/lib/publication";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Book a flight",
  description: "Live fares from Kigali and beyond. Choose a flight, add your travellers, pay and receive your e-ticket.",
  robots: { index: false, follow: true },
};

const place = (code: string) => airportCity(code) ?? code;

/** The visitor, for the search limit: the first address the proxy saw. */
async function visitorKey() {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "anonymous";
}

export default async function BookFlightsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePublicService("FLIGHT");
  const [query, viewer] = await Promise.all([searchParams, getCurrentUser()]);
  const shop = await shopAvailability(viewer);

  if (!shop.open) {
    return (
      <PageShell>
        <section className={s.page}>
          <Container>
            <ShopNotice title="Online booking is coming soon" action={<Link href="/flights#flight-request" className={s.secondary}>Ask the desk for fares</Link>}>
              <p>For now, send us your route and the Kigali desk replies with fares in writing. Nothing is charged until you accept one.</p>
            </ShopNotice>
          </Container>
        </section>
      </PageShell>
    );
  }

  const parsed = parseShopSearch(query, todayInRwanda());
  let results: ShopResults | null = null;
  let problem: string | null = parsed.ok ? null : parsed.error;
  if (parsed.ok) {
    try {
      results = await shopFlights(shop.config, parsed.search, await visitorKey());
    } catch (error) {
      if (!(error instanceof ShopError)) throw error;
      problem = error.message;
    }
  }

  return (
    <PageShell>
      <section className={s.page}>
        <Container>
          <div className={s.head}>
            {shop.missing.length ? <StaffPreview missing={shop.missing} /> : null}
            <h1 className={s.title}>Choose your flight</h1>
            {parsed.ok ? <SearchSummary search={parsed.search} place={place} /> : null}
          </div>

          {!parsed.ok && parsed.error === null ? (
            <ShopNotice title="Where are you flying?" action={<Link href="/flights#flight-request" className={s.secondary}>Search flights</Link>}>
              <p>Choose your airports, dates and travellers on the flights page, and the live fares appear here.</p>
            </ShopNotice>
          ) : problem ? (
            <ShopNotice title="We could not search that" action={<Link href="/flights#flight-request" className={s.secondary}>Change search</Link>}>
              <p>{problem}</p>
            </ShopNotice>
          ) : results && parsed.ok && results.results.length === 0 ? (
            <ShopNotice title="No fares for these dates" action={<Link href="/flights#flight-request" className={s.secondary}>Change search</Link>}>
              <p>
                The airlines we book online have nothing for this route and day. Try nearby dates, or{" "}
                <Link href="/flights#flight-request">send the desk a request</Link>: it books many more airlines by hand.
              </p>
            </ShopNotice>
          ) : results && parsed.ok ? (
            <>
              <p className={s.count}>
                {results.total > results.results.length
                  ? `The ${results.results.length} lowest of ${results.total} fares, cheapest first.`
                  : `${results.results.length} ${results.results.length === 1 ? "fare" : "fares"}, cheapest first.`}{" "}
                Prices are for all travellers, with taxes and our service fee included.
              </p>
              <ul className={s.fares}>
                {results.results.map((fare) => {
                  const rwf = shop.pricing ? rwfPrice(fare, parsed.search.adults + parsed.search.children + parsed.search.infants, shop.pricing) : null;
                  return (
                    <FareRow key={fare.id} fare={fare} returning={!!parsed.search.return}
                      price={rwf ? formatQuoteMoney(rwf.totalRwf, "RWF") : formatQuoteMoney(fare.totalMinor, fare.currency)}
                      href={`/flights/book/${fare.id}?${searchQuery(parsed.search)}`} />
                  );
                })}
              </ul>
              <p className={s.foot}>
                Airlines change prices by the minute, so the next step checks your fare with the airline again before you
                enter anything. Want an airline or route not listed here? <Link href="/flights#flight-request">Ask the desk</Link>.
              </p>
            </>
          ) : null}
        </Container>
      </section>
    </PageShell>
  );
}
