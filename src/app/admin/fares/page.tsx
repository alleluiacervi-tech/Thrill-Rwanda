import Link from "next/link";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { Panel, StatGrid, StatTile, StatusPill } from "@/components/dashboard/dash-ui";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { DeskFareForm, FareSourceForm, RunFareCheck, type SourceOption } from "@/components/dashboard/fare-source-form";
import { removeDeskFare } from "@/app/actions/fares";
import { db } from "@/lib/db";
import { formatFare } from "@/lib/fare-board-rules";
import { aviasalesLinks } from "@/lib/aviasales";
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
    body: "No prices on the flights page, not even desk fares. The board lists popular routes, and travellers ask the desk for a fare.",
  },
  {
    value: "manual",
    title: "Our desk only",
    body: "Only the fares your team adds below. Nothing is fetched.",
  },
  {
    value: "travelpayouts",
    title: "Travelpayouts",
    body: "Aviasales' cached lowest fares from recent traveller searches, checked each morning. Quiet routes may have none. Desk fares show alongside.",
  },
  {
    value: "duffel",
    title: "Duffel",
    body: "A live search each morning for one date per route. Exact fares airlines are selling, with airline and stops. Desk fares show alongside.",
  },
  {
    value: "skyscanner",
    title: "Skyscanner",
    body: "Skyscanner's cached lowest fares for the month, up to 4 days old. Shown as guide prices, with the \"Powered by Skyscanner\" credit they require. Desk fares show alongside.",
  },
];

const city = new Map(allDestinations.map((place) => [place.code, place.city]));
const when = (date: Date) =>
  date.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });

export default async function AdminFaresPage() {
  await requireAdmin("/admin/fares");
  const now = new Date();
  const [source, heartbeat, latest, total, desk] = await Promise.all([
    getFareSource(),
    db.workerHeartbeat.findUnique({ where: { name: "fare-watch" } }),
    db.fareSnapshot.findMany({ orderBy: { checkedAt: "desc" }, take: 24 }),
    db.fareSnapshot.count(),
    db.fareSnapshot.findMany({ where: { source: "manual", validUntil: { gte: now } }, orderBy: { checkedAt: "desc" } }),
  ]);
  const options: SourceOption[] = OPTIONS.map((option) => {
    const ready = sourceReadiness(option.value);
    const body =
      option.value !== "travelpayouts"
        ? option.body
        : `${option.body} ${
            aviasalesLinks()
              ? "Each fare also links to Aviasales, with your partner marker, for travellers who would rather book there."
              : "Add TRAVELPAYOUTS_MARKER to the server settings to also link each fare to Aviasales and earn commission."
          }`;
    return { ...option, body, ready: ready.ok, reason: ready.ok ? undefined : ready.reason };
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

      <Panel
        title="Fares from our desk"
        description={source === "off" ? "Fares are off, so these don't show until you choose a source above." : "Fares your team checked. Each shows on the flights page until its last day, and replaces a fetched fare on the same route."}
        className="mb-6"
      >
        <DeskFareForm today={now.toISOString().slice(0, 10)} />
        {desk.length ? (
          <ul className="mt-6 divide-y divide-[var(--line)] border-t border-[var(--line)]">
            {desk.map((fare) => (
              <li key={fare.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="font-medium">Kigali to {city.get(fare.destination) ?? fare.destination}</span>, {fare.departureDate.toISOString().slice(0, 10)},{" "}
                  <span className="tnum font-medium">{formatFare(fare.totalMinor, fare.currency)}</span>
                  {fare.airline ? `, ${fare.airline}` : ""}
                  {fare.dealNote ? <span className="ml-2"><StatusPill tone="warn">{fare.dealNote}</StatusPill></span> : null}
                  <span className="block text-xs text-[var(--ink-muted)]">Shows until {fare.validUntil ? when(fare.validUntil) : "removed"}</span>
                </span>
                <form action={removeDeskFare}>
                  <input type="hidden" name="id" value={fare.id} />
                  <button type="submit" className="text-xs font-medium text-clay-700 hover:underline">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>

      <Panel title="Check now" description="The check runs every morning at 06:15. Run it now after switching source, or to refresh the board." className="mb-6">
        <RunFareCheck disabled={source === "off" || source === "manual"} />
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
