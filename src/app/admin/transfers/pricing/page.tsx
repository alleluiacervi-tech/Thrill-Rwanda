import { AirportTransferPricingForm } from "@/components/dashboard/airport-transfer-pricing-form";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { airportMapConfig } from "@/lib/airport-transfer-maps";
import {
  AIRPORT_TRANSFER_BANDS,
  AIRPORT_TRANSFER_DIRECTIONS,
  AIRPORT_TRANSFER_KEY,
  airportTransferRateSchema,
  formatTransferRwf,
  priceAirportTransfer,
} from "@/lib/airport-transfer-pricing";
import { db } from "@/lib/db";
import { todayInRwanda } from "@/lib/flight-enquiry-schema";
import { getPublications } from "@/lib/publication";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Airport transfer pricing", robots: { index: false, follow: false } };

export default async function AirportTransferPricingPage() {
  await requireAdmin("/admin/transfers/pricing");
  const [row, publication] = await Promise.all([
    db.airportTransferPricing.findUnique({ where: { key: AIRPORT_TRANSFER_KEY } }),
    getPublications(),
  ]);
  const parsed = airportTransferRateSchema.safeParse(row?.rates);
  const rates = parsed.success ? parsed.data : undefined;
  const status = !rates || !row?.isActive ? "Save and activate a verified rate card to offer estimates."
    : rates.validThrough < todayInRwanda() ? "The rate card expired. The desk handles all requests."
    : publication.TRANSPORT !== "ENQUIRY" ? "Set transport publication to enquiries to show the estimator."
    : !airportMapConfig() ? "Google Maps configuration is pending."
    : "The estimator is enabled on the transfers page.";

  return (
    <>
      <DashboardHead
        title="Airport transfer pricing"
        lede={status}
        action={<Button href="/admin/transfers" variant="outline">Transfer zones</Button>}
      />
      <div className="space-y-6">
        <AirportTransferPricingForm rates={rates} version={row?.version ?? -1} isActive={row?.isActive ?? false} />
        {rates ? (
          <section className="space-y-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-white p-5 sm:p-7">
            <h2 className="text-xl">Estimates from saved rates</h2>
            <p className="text-sm text-[var(--ink-muted)]">
              Supplier and dispatch costs plus any night cost, adjusted for payment fees and target contribution, rounded up to the next 1,000 RWF. Night pricing runs from 21:00 to 05:00 Kigali time.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {AIRPORT_TRANSFER_DIRECTIONS.map((direction) => (
                <div key={direction} className="rounded-lg bg-bone-50 p-4">
                  <h3 className="font-semibold">{direction === "FROM_AIRPORT" ? "From airport" : "To airport"}</h3>
                  <dl className="mt-2 space-y-2 text-sm">
                    {AIRPORT_TRANSFER_BANDS.map(({ maxMeters, label }) => (
                      <div key={maxMeters} className="border-t border-[var(--line)] pt-2">
                        <dt>{label}</dt>
                        <dd>{formatTransferRwf(priceAirportTransfer(rates, { distanceMeters: maxMeters, direction, time: "12:00" })!)} day · {formatTransferRwf(priceAirportTransfer(rates, { distanceMeters: maxMeters, direction, time: "22:00" })!)} night</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
