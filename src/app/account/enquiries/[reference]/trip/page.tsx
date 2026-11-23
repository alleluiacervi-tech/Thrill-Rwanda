import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { ClientChooseButton, ClientRequestForm } from "@/components/ticketing/ticketing-forms";
import { DeadlineChip, FlightCard, Panel, StageTracker } from "@/components/ticketing/ticketing-ui";
import { Badge } from "@/components/ui/primitives";
import { label } from "@/lib/enquiry-workflow";
import { requireUser } from "@/lib/session";
import { readClientTrip } from "@/lib/ticketing";
import { isServiceOpen, money2, SERVICE_KIND_LABEL, type ServiceKind, type TicketingStatus } from "@/lib/ticketing-rules";

export const metadata: Metadata = { title: "Your trip", robots: { index: false, follow: false } };

const name = (p: { title: string; givenNames: string; surname: string }) => `${p.title ? `${p.title} ` : ""}${p.givenNames} ${p.surname}`.toUpperCase();

export default async function Page({ params }: { params: Promise<{ reference: string }> }) {
  const user = await requireUser("/account/enquiries");
  const { reference } = await params;
  const trip = await readClientTrip(user.id, reference);
  if (!trip) notFound();
  const { enquiry, file } = trip;
  const back = { href: `/account/enquiries/${enquiry.reference}`, label: "Your request" };
  if (!file) {
    return (
      <>
        <DashboardHead title="Your trip" lede={enquiry.reference} back={back} />
        <Panel title="We are preparing your flights" lede="Your travel desk will add fare options and tickets here as soon as they are ready. Quote your reference when you contact us about this request.">{null}</Panel>
      </>
    );
  }
  const status = file.status as TicketingStatus;
  const issued = status === "ISSUED" || status === "CLOSED";
  const chosen = file.options.find((o) => o.selected);
  const canChoose = status === "OPTIONS" && !!file.optionsSharedAt && (enquiry.clientAccess.length === 0 || enquiry.clientAccess[0]!.canAccept);
  const active = file.passengers.filter((p) => p.status === "ACTIVE").map((p) => ({ id: p.id, name: name(p) }));
  const now = new Date();
  return (
    <>
      <DashboardHead
        title="Your trip"
        lede={`${enquiry.reference}${file.pnr ? ` · Booking reference ${file.pnr}` : ""}`}
        back={back}
        action={issued ? (
          <a href={`/account/enquiries/${enquiry.reference}/trip/itinerary`} className="inline-flex items-center gap-2 rounded-full bg-sun-500 px-5 py-2.5 font-semibold text-forest-950 hover:bg-sun-300">
            <Download className="size-4" aria-hidden />Download itinerary
          </a>
        ) : undefined}
      />
      <StageTracker status={status} />

      {status === "OPTIONS" && file.options.length > 0 && (
        <Panel title="Choose your fare" lede="These prices were checked for you and are held until the time shown. Choosing a fare does not take any payment; we confirm the price and send payment instructions next.">
          <div className="space-y-8">
            {file.options.map((o) => (
              <section key={o.id} className="space-y-3" aria-labelledby={`opt-${o.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 id={`opt-${o.id}`} className="text-xl">{o.label}{o.selected && <Badge tone="forest" className="ml-3 align-middle">Your choice</Badge>}</h3>
                    <p className="mt-1 text-sm text-[var(--ink-muted)]">Price held <DeadlineChip deadline={o.validUntil} now={now} /></p>
                  </div>
                  <p className="font-display text-3xl tabular-nums">{money2(o.totalMinor, o.currency)}</p>
                </div>
                {o.segments.map((s) => <FlightCard key={s.id} segment={s} />)}
                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  {([["Baggage", o.baggage], ["Changes", o.changeRule], ["Refunds", o.refundRule]] as const).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="font-semibold">{k}</dt><dd className="text-[var(--ink-muted)]">{v}</dd></div>)}
                </dl>
                {canChoose && o.validUntil > now && <ClientChooseButton reference={enquiry.reference} optionId={o.id} chosen={o.selected} />}
                {canChoose && o.validUntil <= now && <p className="text-sm text-[#9b2c1f]">This price has expired. Ask us for a refreshed price.</p>}
              </section>
            ))}
          </div>
        </Panel>
      )}
      {status === "OPTIONS" && file.options.length === 0 && (
        <Panel title="Fare options are on their way" lede="We are checking live prices. You will be told when they are ready to compare.">{null}</Panel>
      )}

      {status !== "OPTIONS" && chosen && (
        <Panel
          title={issued ? "Your flights" : "Your chosen fare"}
          lede={issued ? "Times are local to each airport."
            : status === "AWAITING_PAYMENT" ? `${chosen.label} · ${money2(chosen.totalMinor, chosen.currency)}. Complete payment from your request page so we can issue your tickets.`
            : `${chosen.label} · ${money2(chosen.totalMinor, chosen.currency)}. Your payment is verified and we are preparing your tickets.`}>
          <div className="space-y-4">{chosen.segments.map((s) => <FlightCard key={s.id} segment={s} />)}</div>
          {!issued && <p className="mt-4"><Link href={`/account/enquiries/${enquiry.reference}`} className="underline">Go to your request and payment</Link></p>}
        </Panel>
      )}

      {issued && (
        <Panel title="Travellers and e-tickets" lede="Check each name against the passport before you travel. If anything is wrong, tell us straight away.">
          <ul className="divide-y divide-[var(--line)]">
            {file.passengers.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="font-medium">{name(p)} <span className="text-sm font-normal text-[var(--ink-muted)]">· {label(p.kind)}</span></span>
                <span className="flex items-center gap-3 tabular-nums">
                  {p.ticketNumber ? `${p.ticketNumber.slice(0, 3)} ${p.ticketNumber.slice(3)}` : "Pending"}
                  {p.status !== "ACTIVE" && <Badge tone="outline">{label(p.status)}</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {status === "ISSUED" && (
        <Panel title="Need a change, a correction or a refund?" lede="Send us a request. Airlines set the fees and rules, so we confirm the cost with you before we do anything.">
          <ClientRequestForm reference={enquiry.reference} passengers={active} />
        </Panel>
      )}
      {file.requests.length > 0 && (
        <Panel title="Your requests">
          <ul className="space-y-3">
            {file.requests.map((r) => (
              <li key={r.id} className="rounded-xl border border-[var(--line)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{SERVICE_KIND_LABEL[r.kind as ServiceKind] ?? label(r.kind)}</p>
                  <Badge tone={isServiceOpen(r.status) ? "sun" : "neutral"}>{label(r.status)}</Badge>
                </div>
                <p className="mt-1 text-sm">{r.description}</p>
                {r.resolution && <p className="mt-2 text-sm"><strong>From us: </strong>{r.resolution}</p>}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
