import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { paginate } from "@/lib/pagination";
import { Pagination } from "@/components/ui/pagination";
import { clientQuoteHistory, readClientCase } from "@/lib/client-portal";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { renderQuoteHtml } from "@/lib/quote-render";
import { ClientCaseForm } from "@/components/dashboard/client-case-form";
import { formatQuoteMoney, type QuoteSnapshot } from "@/lib/quote-rules";
import { PlaneTakeoff } from "lucide-react";
import { AirlineLogo } from "@/components/booking/flight-marks";
import { AirportFlag } from "@/components/booking/airport-flag";
import { label } from "@/lib/enquiry-workflow";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/account/enquiries"),
    { reference } = await params,
    e = await readClientCase(user.id, reference);
  if (!e) notFound();
  const latest = e.quoteVersions[0],
    query = await searchParams;
  const quotePage = paginate(query, e._count.quoteVersions, 10, "quotes");
  const quoteHistory = await clientQuoteHistory(
    user.id,
    e.reference,
    quotePage.skip,
    quotePage.take,
  );
  return (
    <>
      <DashboardHead
        title={e.service === "FLIGHT" ? "Your flight request" : e.eventMilestones ? "Thrill Events & Business" : "Your travel request"}
        lede={`${e.reference} · ${e.status.replaceAll("_", " ")}`}
      />
      {e.service === "FLIGHT" && (
        <p className="mb-4">
          <Link href={`/account/enquiries/${e.reference}/trip`} className="inline-flex items-center gap-2 rounded-full bg-sun-500 px-5 py-2 font-semibold text-forest-950 hover:bg-sun-300">
            <PlaneTakeoff className="size-4" aria-hidden /> Fares and tickets
          </Link>
        </p>
      )}
      <p>
        Requests, acceptance, verified funds and supplier confirmation are
        separate steps. Contact the desk if any details need correction.
      </p>
      {e.requestedFlight && <section className="my-5 space-y-2 rounded-xl border p-5">
        <h2 className="text-xl">Requested itinerary</h2>
        {e.requestedFlight.legs.map((leg, i) => <p key={i}>
          <AirportFlag value={leg.origin} /> {leg.origin} → <AirportFlag value={leg.destination} /> {leg.destination} · {leg.departureDate}
        </p>)}
        {e.requestedFlight.preferredAirline && <p className="flex items-center gap-3 text-sm">Preferred airline <AirlineLogo code={e.requestedFlight.preferredAirline} /></p>}
      </section>}
      {e.eventMilestones && (
        <section className="my-6 rounded-xl border p-5">
          <h2 className="text-xl">Event milestones</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {e.eventMilestones.map(({ milestone, status }) => (
              <div key={milestone}>
                <dt>{label(milestone)}</dt>
                <dd>{label(status)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {e.financialCase?.instructions && (
        <section className="my-6 rounded-xl border p-5">
          <h2 className="text-xl">Approved payment instructions</h2>
          <p className="mt-3 whitespace-pre-wrap">
            {e.financialCase.instructions}
          </p>
        </section>
      )}
      <h2 className="mt-8 text-2xl">Issued quotations</h2>
      {quoteHistory.map((q) => {
        const snapshot = q.snapshot as QuoteSnapshot;
        return (
        <section key={q.id} className="my-6">
          <h3 className="text-xl">
            Version {q.number}{" "}
            {q.id === e.quoteAcceptance?.quoteId
              ? " · Accepted"
              : q.id !== latest?.id
                ? " · Historical version"
                : ""}
          </h3>
          {e.service === "FLIGHT" && (
            <div className="mt-3 grid overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0 p-5">
                <PlaneTakeoff size={23} className="mb-3 text-forest-700" aria-hidden />
                <p className="break-words text-xl font-semibold">{snapshot.serviceDescription}</p>
                <p className="mt-1 whitespace-pre-line break-words text-sm">{snapshot.travelSummary}</p>
              </div>
              <div className="flex flex-col justify-center gap-1 border-t border-dashed border-forest-300 bg-forest-100 px-6 py-4 text-forest-950 sm:border-t-0 sm:border-l">
                <span className="text-sm">Quoted total</span>
                <strong className="text-2xl">{formatQuoteMoney(snapshot.totalMinor, snapshot.currency)}</strong>
                <span className="text-xs">Expires {q.expiresAt.toLocaleString("en-GB", { timeZone: "Africa/Kigali", dateStyle: "medium", timeStyle: "short" })} Kigali</span>
              </div>
            </div>
          )}
          <a
            href={`/account/enquiries/${e.reference}/quotes/${q.id}/download`}
            className="my-4 inline-block underline"
          >
            Download this written quotation (PDF)
          </a>
          <details open={e.service !== "FLIGHT" && q.id === latest?.id}>
            <summary>Read quotation and terms</summary>
            <div
              className="overflow-x-auto rounded-xl border bg-white p-4 text-black"
              dangerouslySetInnerHTML={{
                __html: renderQuoteHtml(snapshot)
                  .replace(/^[\s\S]*?<body[^>]*>/, "")
                  .replace(/<\/body>[\s\S]*$/, ""),
              }}
            />
          </details>
        </section>
        );
      })}
      <Pagination
        page={quotePage}
        pathname={`/account/enquiries/${e.reference}`}
        params={query}
        label="quotation versions"
        param="quotes"
      />
      {!e.quoteAcceptance &&
        latest &&
        e.status === "QUOTE_SENT" &&
        e.clientAccess.some((a) => a.canAccept) &&
        latest.expiresAt > new Date() &&
        latest.paymentDeadline > new Date() && (
          <ClientCaseForm
            key={`${e.version}-accept`}
            accept
            hidden={{
              command: "ACCEPT",
              reference: e.reference,
              quoteId: latest.id,
              contentHash: latest.contentHash,
              expectedVersion: e.version,
            }}
          />
        )}
      {e.quoteAcceptance && (
        <p>
          Acceptance recorded{" "}
          {e.quoteAcceptance.acceptedAt.toLocaleString("en-GB", {
            timeZone: "Africa/Kigali",
          })}{" "}
          Kigali time. This is not ticket or supplier confirmation.
        </p>
      )}
      <h2 className="mt-10 text-2xl">Support for this request</h2>
      <ClientCaseForm
        hidden={{
          command: "SUPPORT",
          reference: e.reference,
          intentKey: randomUUID(),
        }}
      />
      <ul>
        {e.supportCases.map((c) => (
          <li key={c.reference} className="my-3">
            {c.reference} · {c.category} · {c.status.replaceAll("_", " ")}
          </li>
        ))}
      </ul>
      <p className="mt-6">
        <Link href="/support" className="underline">
          Staffed hours and urgent help
        </Link>
      </p>
    </>
  );
}
