import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { ArrowLeft } from "lucide-react";
import airports from "@/data/flight-airports.json";
import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/primitives";
import { AirlineMark, ShopNotice, StaffPreview } from "@/components/booking/flight-shop";
import { TravellerForm } from "@/components/booking/flight-traveller-form";
import s from "@/components/booking/flight-shop.module.css";
import { airportCity } from "@/lib/flight-geography";
import { todayInRwanda } from "@/lib/flight-enquiry-schema";
import { kindOf, parseShopSearch, rwfPrice, searchQuery } from "@/lib/flight-shop-rules";
import { priceFare, ShopError, shopAvailability, type PricedFare } from "@/lib/flight-shop";
import { requirePublicService } from "@/lib/publication";
import { formatQuoteMoney } from "@/lib/quote-rules";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your flight", robots: { index: false, follow: false } };

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const countries = [...new Set(airports.map((row) => row[2] as string))]
  .map((code) => ({ code, name: regionNames.of(code) ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name));
const city = (code: string) => airportCity(code) ?? code;
const when = (local: string) =>
  new Date(`${local}:00Z`).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

export default async function FarePage({ params, searchParams }: {
  params: Promise<{ offer: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePublicService("FLIGHT");
  const [{ offer: offerId }, query, viewer] = await Promise.all([params, searchParams, getCurrentUser()]);
  const shop = await shopAvailability(viewer);
  const today = todayInRwanda();
  const search = parseShopSearch(query, today);
  const back = search.ok ? `/flights/book?${searchQuery(search.search)}` : "/flights#flight-request";

  if (!shop.open) {
    return (
      <PageShell>
        <section className={s.page}><Container>
          <ShopNotice title="Online booking is coming soon" action={<Link href="/flights#flight-request" className={s.secondary}>Ask the desk for fares</Link>}>
            <p>For now, send us your route and the Kigali desk replies with fares in writing.</p>
          </ShopNotice>
        </Container></section>
      </PageShell>
    );
  }

  let fare: PricedFare | null = null;
  let problem: string | null = null;
  try {
    fare = await priceFare(shop.config, offerId);
  } catch (error) {
    if (!(error instanceof ShopError)) throw error;
    problem = error.message;
  }

  const travellers = fare?.passengers.length ?? 0;
  const price = fare && shop.pricing ? rwfPrice(fare, travellers, shop.pricing) : null;

  return (
    <PageShell>
      <section className={s.page}>
        <Container>
          <div className={s.head}>
            <Link href={back} className={s.secondary} style={{ justifySelf: "start" }}><ArrowLeft size={15} aria-hidden /> Back to results</Link>
            {shop.missing.length ? <StaffPreview missing={shop.missing} /> : null}
            <h1 className={s.title}>Your flight</h1>
          </div>

          {problem ? (
            <ShopNotice title="We could not check this fare" action={<Link href={back} className={s.secondary}>Back to results</Link>}><p>{problem}</p></ShopNotice>
          ) : !fare ? (
            <ShopNotice title="This fare has gone" action={<Link href={back} className={s.secondary}>See current fares</Link>}>
              <p>Airlines release seats at each price for a short time, and this one is no longer on sale. The results page has the fares available now.</p>
            </ShopNotice>
          ) : (
            <>
              <div className={s.chosen} style={{ marginBottom: "1.5rem" }}>
                <div className={s.panel}>
                  <AirlineMark airline={fare.airline} />
                  {fare.slices.map((slice, i) => (
                    <div key={i} className={s.flights}>
                      <p className={s.panelTitle}>
                        {fare.slices.length > 1 ? (i === 0 ? "Outbound: " : "Return: ") : ""}{city(slice.from)} to {city(slice.to)}
                        <small style={{ display: "block", fontFamily: "inherit", fontSize: "0.85rem", color: "var(--color-bone-600)" }}>
                          {slice.duration}, {slice.stops === 0 ? "nonstop" : `${slice.stops} stop${slice.stops > 1 ? "s" : ""}`}
                        </small>
                      </p>
                      {slice.segments.map((seg) => (
                        <div key={`${seg.flight}-${seg.departLocal}`} className={s.flight}>
                          <b>{seg.flight}</b>
                          <span>
                            {city(seg.from)} ({seg.from}) {when(seg.departLocal)}
                            <small>to {city(seg.to)} ({seg.to}), arrives {when(seg.arriveLocal)}, local times</small>
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className={s.panel}>
                  <p className={s.panelTitle}>Fare rules</p>
                  <dl className={s.rules}>
                    {fare.fareBrand ? <><dt>Fare</dt><dd>{fare.fareBrand}</dd></> : null}
                    <dt>Baggage</dt><dd>{fare.baggage}</dd>
                    <dt>Changes</dt><dd>{fare.changeRule}</dd>
                    <dt>Refunds</dt><dd>{fare.refundRule}</dd>
                  </dl>
                  <p className={s.payNote}>
                    {fare.holdable
                      ? "The airline keeps these seats while you pay, so the price holds."
                      : "This airline sells only for immediate payment: pay soon after you continue, while the price is current."}
                  </p>
                </div>
              </div>

              {price ? (
                <TravellerForm
                  offerId={fare.id}
                  seats={fare.passengers.map((p) => ({ id: p.id, kind: kindOf(p.type) }))}
                  totalRwf={price.totalRwf}
                  breakdown={[
                    { label: `Air fare, ${travellers} ${travellers === 1 ? "traveller" : "travellers"}, taxes included`, amount: formatQuoteMoney(price.fareRwf, "RWF") },
                    ...(price.feeRwf ? [{ label: "Booking and ticketing service", amount: formatQuoteMoney(price.feeRwf, "RWF") }] : []),
                  ]}
                  countries={countries}
                  submissionKey={randomUUID()}
                  today={today}
                />
              ) : (
                <ShopNotice title="Booking paused" action={<Link href="/flights#flight-request" className={s.secondary}>Ask the desk</Link>}>
                  <p>Online booking is paused while the desk updates today&apos;s exchange rate. The airline&apos;s price is {formatQuoteMoney(fare.totalMinor, fare.currency)}.</p>
                </ShopNotice>
              )}
            </>
          )}
        </Container>
      </section>
    </PageShell>
  );
}
