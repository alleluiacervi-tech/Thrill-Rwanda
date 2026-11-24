import Link from "next/link";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { Panel, StatGrid, StatTile, StatusPill } from "@/components/dashboard/dash-ui";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { FareSourceForm, RunFareCheck, type SourceOption } from "@/components/dashboard/fare-source-form";
import { db } from "@/lib/db";
import { formatFare } from "@/lib/fare-board-rules";
import { FARE_SOURCE_LABEL, sourceReadiness } from "@/lib/fare-sources";
import { getFareSource, WATCHED } from "@/lib/fare-watch";
import { allDestinations } from "@/lib/flight-destinations";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Flight fares", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const OPTIONS: Omit<SourceOption, "ready" | "reason">[] = [
  {
    value: "off",
    title: "Off",
    body: "No prices on the flights page. The board lists popular routes, and travellers ask the desk for a fare.",
  },
  {
    value: "duffel",
    title: "Duffel",
    body: "A live search each morning for one date per route. Exact fares airlines are selling, with airline and stops.",
  },
  {
    value: "skyscanner",
    title: "Skyscanner",
    body: "Skyscanner's cached lowest fares for the month, up to 4 days old. Shown as guide prices, with the \"Powered by Skyscanner\" credit they require.",
  },
];

const city = new Map(allDestinations.map((place) => [place.code, place.city]));
const when = (date: Date) =>
  date.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });

export default async function AdminFaresPage() {
  await requireAdmin("/admin/fares");
  const [source, heartbeat, latest, total] = await Promise.all([
    getFareSource(),
    db.workerHeartbeat.findUnique({ where: { name: "fare-watch" } }),
    db.fareSnapshot.findMany({ orderBy: { checkedAt: "desc" }, take: 24 }),
    db.fareSnapshot.count(),
  ]);
  const options: SourceOption[] = OPTIONS.map((option) => {
    const ready = sourceReadiness(option.value);
    return { ...option, ready: ready.ok, reason: ready.ok ? undefined : ready.reason };
  });
  const failed = heartbeat?.errorCode != null;

  return (
    <>
      <DashboardHead
        title="Flight fares"
        lede="Where the prices on the public flights board come from. Keys stay in the server settings; the choice is made here."
      />
      <StatGrid>
        <StatTile label="Price source" value={FARE_SOURCE_LABEL[source]} tone={source === "off" ? "default" : "good"} />
        <StatTile
          label="Last check"
          value={heartbeat?.succeededAt ? when(heartbeat.succeededAt) : "Never"}
          note={failed ? "the last run failed" : heartbeat?.succeededAt ? `${heartbeat.processed} fares stored` : "daily at 06:15 Kigali"}
          tone={failed ? "alert" : "default"}
        />
        <StatTile label="Routes watched" value={WATCHED.length} note="one way from Kigali" />
        <StatTile label="Fares stored" value={total} note="kept for 120 days" />
      </StatGrid>

      <Panel
        title="Price source"
        description="Switching changes the flights page straight away: it shows only prices from the source in use, and none when off."
        className="mb-6"
      >
        <FareSourceForm current={source} options={options} />
      </Panel>

      <Panel title="Check now" description="The check runs every morning at 06:15. Run it now after switching source, or to refresh the board." className="mb-6">
        <RunFareCheck disabled={source === "off"} />
      </Panel>

      <Panel
        title="Latest fares found"
        description="The newest 24, from every source. The public board uses the cheapest recent fare per route from the source in use."
        aside={<Link href="/flights" className="text-xs font-medium text-lake-700 hover:underline">View the flights page</Link>}
        flush
      >
        {latest.length === 0 ? (
          <p className="p-5 text-sm text-[var(--ink-muted)]">No fares yet. Choose a source above and run a check.</p>
        ) : (
          <TableShell className="rounded-none border-0" dense>
            <thead>
              <tr>
                <Th>Route</Th>
                <Th>Departs</Th>
                <Th>Fare</Th>
                <Th>Airline</Th>
                <Th>Source</Th>
                <Th>Found</Th>
              </tr>
            </thead>
            <tbody>
              {latest.map((fare) => (
                <Tr key={fare.id}>
                  <Td>Kigali to {city.get(fare.destination) ?? fare.destination}</Td>
                  <Td className="tnum whitespace-nowrap">{fare.departureDate.toISOString().slice(0, 10)}</Td>
                  <Td className="tnum whitespace-nowrap font-medium">{formatFare(fare.totalMinor, fare.currency)}</Td>
                  <Td>
                    {fare.airline || "Not given"}
                    <span className="block text-xs text-[var(--ink-muted)]">
                      {fare.stops === 0 ? "Nonstop" : fare.stops < 0 ? "Connecting" : `${fare.stops} ${fare.stops === 1 ? "stop" : "stops"}`}
                    </span>
                  </Td>
                  <Td>
                    <StatusPill tone={fare.source === source ? "good" : "neutral"}>
                      {FARE_SOURCE_LABEL[fare.source as keyof typeof FARE_SOURCE_LABEL] ?? fare.source}
                    </StatusPill>
                  </Td>
                  <Td className="tnum whitespace-nowrap">{when(fare.checkedAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>
    </>
  );
}
