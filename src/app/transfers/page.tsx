import type { Metadata } from "next";
import { BadgeCheck, PlaneLanding, ReceiptText } from "lucide-react";
import { PageShell, PageHero } from "@/components/layout/page-shell";
import { TransferForm } from "@/components/booking/transfer-form";
import { Button } from "@/components/ui/button";
import { Container, SectionHead } from "@/components/ui/primitives";
import { getSite } from "@/lib/settings";
import { formatMoney } from "@/lib/utils";
import { destinationImages } from "@/lib/images";
import { listActiveZones } from "@/lib/transfers";
import { ORIGIN_LABEL, groupZones, type TransferOriginValue } from "@/lib/transfer-zones-shared";

export const metadata: Metadata = {
  title: "Airport Transfers in Rwanda",
  description:
    "Book your airport transfer in Kigali, Musanze or Rubavu: Kigali International Airport and lake or park pickups at one fixed price per vehicle. Flight tracking, no surge.",
  alternates: { canonical: "/transfers" },
};

const promises = [
  {
    icon: PlaneLanding,
    title: "Flight tracking",
    body: "Your driver tracks your flight or train and waits if it's late. The first 60 minutes are free.",
  },
  {
    icon: ReceiptText,
    title: "One clear price",
    body: "Fixed per vehicle and confirmed up front. No surge, no bargaining, no cash on the day.",
  },
  {
    icon: BadgeCheck,
    title: "Vetted drivers",
    body: "Licensed, insured drivers who meet you inside arrivals with your name on a board.",
  },
];

// Prices are managed in Admin -> Transfer zones; saving there refreshes this at once.
export const revalidate = 300;

const ORDER: TransferOriginValue[] = ["KIGALI", "MUSANZE", "RUBAVU", "BETWEEN_TOWNS"];

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // From the home search bar: the trip already chosen, so the prices open straight away.
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, 200) : undefined);
  const site = await getSite();
  const zones = await listActiveZones();

  return (
    <PageShell overHero>
      <PageHero
        eyebrow="Airport Transfers"
        title="Book your airport transfer"
        lede="Between Kigali International Airport, the volcano and lake towns and your hotel. One fixed price per vehicle, a driver waiting at arrivals."
        crumbs={[{ label: "Airport Transfers" }]}
        image={destinationImages["kigali"]}
        className="pb-36 sm:pb-40"
      />

      {/* The search bar overlaps the banner, the way a booking site leads with it.
          The banner's bottom padding leaves room for it below the lede at every width. */}
      <Container wide className="relative z-10 -mt-20">
        <TransferForm
          zones={zones}
          initial={{ point: one("point"), area: one("area"), date: one("date"), time: one("time"), passengers: one("passengers") }}
        />
      </Container>

      <Container wide className="grid gap-10 py-16 sm:grid-cols-3">
        {promises.map((p) => (
          <div key={p.title} className="flex gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-forest-800 text-bone-50">
              <p.icon className="size-5" />
            </span>
            <div>
              <h3 className="text-lg">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-muted)]">{p.body}</p>
            </div>
          </div>
        ))}
      </Container>

      {/* ------------------------------------------------------- Price list */}
      <section className="border-t border-[var(--line)] bg-[var(--paper-sunken)] py-16">
        <Container wide>
          <SectionHead
            eyebrow="Prices"
            title="Fixed prices by zone"
            lede="Per vehicle, the same in either direction. Night trips (9pm–5am) add 15%."
          />
          <div className="mt-10 space-y-3">
            {ORDER.map((origin) => {
              const groups = groupZones(zones.filter((z) => z.origin === origin));
              if (groups.length === 0) return null;
              return (
                <details
                  key={origin}
                  open={origin === "KIGALI"}
                  className="group overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-medium">
                    {ORIGIN_LABEL[origin]}
                    <span className="text-clay-600 transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  {/* Scrolls sideways on a phone rather than squeezing five columns. */}
                  <div className="overflow-x-auto border-t border-[var(--line)]">
                    <table className="w-full min-w-[40rem] text-left text-sm">
                      <thead className="bg-[var(--paper-sunken)] text-2xs uppercase tracking-[0.12em] text-[var(--ink-muted)]">
                        <tr>
                          <th className="px-5 py-3 font-medium">Zone</th>
                          <th className="px-5 py-3 font-medium">Areas</th>
                          <th className="px-5 py-3 text-right font-medium">Sedan</th>
                          <th className="px-5 py-3 text-right font-medium">Van (7)</th>
                          <th className="px-5 py-3 text-right font-medium">Prado / Alphard</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--line)]">
                        {groups.flatMap((g) =>
                          g.zones.map((z, i) => (
                            <tr key={z.id}>
                              <td className="whitespace-nowrap px-5 py-3 font-medium">{i === 0 ? g.name : ""}</td>
                              <td className="px-5 py-3 text-[var(--ink-muted)]">
                                {z.areas.join(", ")}
                                {z.distance ? <span className="text-[var(--ink-faint)]"> · {z.distance}</span> : null}
                              </td>
                              <td className="tnum whitespace-nowrap px-5 py-3 text-right font-medium">{formatMoney(z.sedanMinor)}</td>
                              <td className="tnum whitespace-nowrap px-5 py-3 text-right">{formatMoney(z.vanMinor)}</td>
                              <td className="tnum whitespace-nowrap px-5 py-3 text-right">{formatMoney(z.premiumMinor)}</td>
                            </tr>
                          )),
                        )}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>

          <div className="mt-10 text-center">
            <Button href={site.contact.whatsapp} variant="outline" size="lg">
              Arrange by WhatsApp instead
            </Button>
          </div>
        </Container>
      </section>
    </PageShell>
  );
}
