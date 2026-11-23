import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, TriangleAlert } from "lucide-react";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { label } from "@/lib/enquiry-workflow";
import { passengerProblems, isServiceOpen, money2, SERVICE_KIND_LABEL, type PassengerInput, type ServiceKind, type TicketingStatus } from "@/lib/ticketing-rules";
import { fileDeadline, lastFlightDate, readTicketingFile, selectedOption } from "@/lib/ticketing";
import { Badge } from "@/components/ui/primitives";
import {
  DeliverActions, IssueForm, MovePanel, OpenTicketingForm, OptionsEditor, RequestHandler, ReviseFlightsForm, ShareAndChoose,
  StaffRequestForm, TravellerEditor,
} from "./ticketing-forms";
import { optionDraftFromRow } from "./ticketing-drafts";
import { DeadlineChip, FlightCard, Panel, StageTracker, StatusPill, shortDate } from "./ticketing-ui";

const fullName = (p: { title: string; givenNames: string; surname: string }) => `${p.title ? `${p.title} ` : ""}${p.givenNames} ${p.surname}`.toUpperCase();

/** The one thing to do next, stated plainly, with what is still blocking it. */
function nextStep(status: TicketingStatus, input: { hasOptions: boolean; chosen: boolean; funded: boolean; travellers: number; blockers: string[] }) {
  switch (status) {
    case "OPTIONS":
      return !input.hasOptions ? "Add the checked fare options, then share them with the client."
        : !input.chosen ? "Share the options and record which fare the client chooses."
        : "A fare is chosen. Move the file to awaiting payment and send the quote.";
    case "AWAITING_PAYMENT":
      return input.funded ? "Funds are verified. List every traveller, then mark the file ready to ticket." : "Waiting for verified funds. Payment must cover the accepted quote in full.";
    case "READY_TO_TICKET":
      return input.blockers.length ? "Resolve the issues below before sending to the partner." : "Reconfirm the fare with the partner, hold the booking and send it to them with the ticketing time limit.";
    case "TICKETING":
      return "Ask the partner to issue. When they confirm, record each e-ticket number and the evidence.";
    case "ISSUED":
      return "Tickets are issued. Deliver the itinerary to the client and watch for after-sales requests.";
    case "CLOSED": return "This file is closed. Travel documents are cleared 30 days after the last flight.";
    default: return "This file was cancelled.";
  }
}

export async function TicketingCase({ reference, base }: { reference: string; base: "/staff/ticketing" | "/admin/ticketing" }) {
  const actor = await requireEnquiryStaff();
  const data = await readTicketingFile(actor.id, reference);
  if (!data) notFound();
  const { enquiry, file, funding, party, canEdit, canSeeDocuments } = data;
  const enquiriesBase = base.replace("ticketing", "enquiries");
  const head = (
    <DashboardHead
      title={`Flight ticketing · ${enquiry.name}`}
      lede={`${enquiry.reference} · enquiry ${label(enquiry.status)}`}
      back={{ href: base, label: "Ticketing desk" }}
      action={<Link href={`${enquiriesBase}/${enquiry.reference}`} className="underline">Open the enquiry</Link>}
    />
  );
  if (!file) {
    return (
      <>
        {head}
        <Panel title="No ticketing file yet" lede="Open a file when you are ready to prepare fare options. Everything done on it is recorded against this enquiry.">
          {canEdit ? <OpenTicketingForm reference={enquiry.reference} /> : <p className="text-sm text-[var(--ink-muted)]">Only the case owner or an administrator can open ticketing.</p>}
        </Panel>
      </>
    );
  }

  const status = file.status as TicketingStatus;
  const chosen = selectedOption(file);
  const deadline = fileDeadline(file);
  const editable = canEdit && ["OPTIONS", "AWAITING_PAYMENT", "READY_TO_TICKET", "TICKETING"].includes(status);
  const travellers: PassengerInput[] = file.passengers.map((p) => ({
    kind: p.kind as PassengerInput["kind"], title: p.title as PassengerInput["title"], givenNames: p.givenNames, surname: p.surname,
    dateOfBirth: p.dateOfBirth ?? "", nationality: p.nationality ?? "", documentNumber: p.documentNumber ?? "", documentExpiry: p.documentExpiry ?? "",
  }));
  const blockers = file.passengers.length ? passengerProblems(travellers, lastFlightDate(file), party ?? undefined) : [];
  if (status === "READY_TO_TICKET" || status === "AWAITING_PAYMENT") {
    if (!funding.funded) blockers.unshift("Funds are not yet verified for the full quote.");
    if (file.passengers.some((p) => !p.documentNumber || !p.dateOfBirth) && canSeeDocuments) blockers.push("Some travellers are missing a passport number or date of birth.");
  }
  const quoteTotal = enquiry.financialCase;
  const fareMismatch = chosen && quoteTotal && (quoteTotal.currency !== chosen.currency || quoteTotal.customerChargeMinor < chosen.totalMinor);
  const passengerOptions = file.passengers.filter((p) => p.status === "ACTIVE").map((p) => ({ id: p.id, name: fullName(p) }));
  const allPassengers = file.passengers.map((p) => ({ id: p.id, name: fullName(p) }));
  const approvedChange = file.requests.find((r) => r.status === "APPROVED" && ["CHANGE", "REISSUE"].includes(r.kind));
  const refundsToSettle = file.requests.filter((r) => r.kind === "REFUND" && r.status === "COMPLETED" && r.refundMinor > 0);

  return (
    <>
      {head}
      {status === "CANCELLED" ? (
        <p role="status" className="rounded-xl border border-[var(--line-strong)] bg-[var(--paper-raised)] p-4">This file was cancelled. No further changes are possible.</p>
      ) : <StageTracker status={status} />}

      <section aria-label="File summary" className="my-6 grid gap-x-8 gap-y-4 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]">Status</p><div className="mt-1.5"><StatusPill status={status} /></div></div>
        <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]">Deadline</p><div className="mt-1.5"><DeadlineChip deadline={deadline} /></div>
          {deadline && <p className="mt-1 text-xs text-[var(--ink-muted)]">{status === "TICKETING" ? "Ticketing time limit" : "Fare validity"} · {deadline.toLocaleString("en-GB", { timeZone: "Africa/Kigali", dateStyle: "medium", timeStyle: "short" })}</p>}</div>
        <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]">Funds verified</p>
          <p className="mt-1.5 font-semibold tabular-nums">{funding.currency ? `${money2(funding.paidMinor, funding.currency)} of ${money2(funding.requiredMinor ?? 0, funding.currency)}` : "No payment case yet"}</p>
          <p className="text-xs text-[var(--ink-muted)]">{funding.funded ? "Covers the accepted quote" : "Ticketing needs the full amount"}</p></div>
        <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]">Booking</p>
          <p className="mt-1.5 font-semibold">{file.pnr ? `PNR ${file.pnr}` : "No PNR yet"}</p>
          <p className="text-xs text-[var(--ink-muted)]">{file.partner || "Partner not set"} · {enquiry.phone}</p></div>
      </section>

      <p className="rounded-xl border-l-4 border-sun-500 bg-sun-100 px-4 py-3 text-sm text-forest-950" role="note">
        <strong>Next: </strong>{nextStep(status, { hasOptions: file.options.length > 0, chosen: !!chosen, funded: funding.funded, travellers: file.passengers.length, blockers })}
      </p>
      {blockers.length > 0 && status !== "ISSUED" && status !== "CLOSED" && status !== "CANCELLED" && (
        <ul className="mt-3 space-y-1 rounded-xl border border-[#9b2c1f]/40 bg-[#fdf0ee] p-4 text-sm text-[#7d2217]" aria-label="Issues to resolve">
          {blockers.map((b) => <li key={b} className="flex gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{b}</li>)}
        </ul>
      )}
      {fareMismatch && (
        <p role="alert" className="mt-3 rounded-xl border border-[#9b2c1f]/40 bg-[#fdf0ee] p-4 text-sm text-[#7d2217]">
          The chosen fare ({money2(chosen!.totalMinor, chosen!.currency)}) is not covered by the accepted quote ({money2(quoteTotal!.customerChargeMinor, quoteTotal!.currency)}). Check the quote before ticketing.
        </p>
      )}

      {/* ------------------------------------------------------------ fares */}
      <Panel title={status === "OPTIONS" ? "Fare options" : "Fare and flights"} lede={status === "OPTIONS" ? "Checked prices from the ticketing partner. Each option carries a time after which the price is no longer guaranteed." : "The fare this file is ticketed on."}>
        {status === "OPTIONS" && editable ? (
          <div className="space-y-8">
            <OptionsEditor reference={enquiry.reference} version={file.version} currency={enquiry.financialCase?.currency ?? "USD"}
              initial={file.options.map((o) => optionDraftFromRow(o))} />
            {file.options.length > 0 && (
              <div className="border-t border-[var(--line)] pt-6">
                <h3 className="mb-3 text-lg">Share and record the choice</h3>
                <ShareAndChoose reference={enquiry.reference} version={file.version} shared={!!file.optionsSharedAt}
                  options={file.options.map((o) => ({ id: o.id, label: `${o.label} · ${money2(o.totalMinor, o.currency)}` }))} selectedId={chosen?.id ?? null} />
                {file.optionsSharedAt && <p className="mt-2 text-sm text-[var(--ink-muted)]">Shared with the client on {file.optionsSharedAt.toLocaleDateString("en-GB", { timeZone: "Africa/Kigali" })}. They can choose online from their trip page.</p>}
              </div>
            )}
          </div>
        ) : (chosen ?? file.options[0]) ? (
          <div className="space-y-4">
            {[chosen ?? file.options[0]!].map((o) => (
              <div key={o.id} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg">{o.label}</h3>
                  <Badge tone="forest">{money2(o.totalMinor, o.currency)}</Badge>
                </div>
                {o.segments.map((s) => <FlightCard key={s.id} segment={s} />)}
                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  {([["Baggage", o.baggage], ["Changes", o.changeRule], ["Refunds", o.refundRule]] as const).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="font-semibold">{k}</dt><dd className="text-[var(--ink-muted)]">{v}</dd></div>)}
                </dl>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-[var(--ink-muted)]">No fare options were recorded.</p>}
      </Panel>

      {/* ------------------------------------------------------- travellers */}
      <Panel title="Travellers" lede={party ? `The request was for ${party.adults} adult${party.adults === 1 ? "" : "s"}${party.children ? `, ${party.children} child${party.children === 1 ? "" : "ren"}` : ""}${party.infants ? `, ${party.infants} infant${party.infants === 1 ? "" : "s"}` : ""}.` : undefined}>
        {!canSeeDocuments ? (
          <p className="text-sm text-[var(--ink-muted)]">{file.passengers.length} traveller{file.passengers.length === 1 ? "" : "s"}. Passport details are visible to the case team only.</p>
        ) : status === "ISSUED" || status === "CLOSED" || !editable ? (
          <ul className="divide-y divide-[var(--line)]">
            {file.passengers.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="font-medium">{fullName(p)} <span className="text-sm font-normal text-[var(--ink-muted)]">· {label(p.kind)}</span></span>
                <span className="flex items-center gap-3 text-sm tabular-nums">
                  {p.ticketNumber ?? "No ticket"}
                  {p.status !== "ACTIVE" && <Badge tone="outline">{label(p.status)}</Badge>}
                </span>
              </li>
            ))}
            {file.passengers.length === 0 && <li className="py-2 text-sm text-[var(--ink-muted)]">No travellers were recorded.</li>}
          </ul>
        ) : (
          <TravellerEditor reference={enquiry.reference} version={file.version} key={file.version}
            initial={file.passengers.map((p) => ({ kind: p.kind, title: p.title, givenNames: p.givenNames, surname: p.surname, dateOfBirth: p.dateOfBirth ?? "", nationality: p.nationality ?? "", documentNumber: p.documentNumber ?? "", documentExpiry: p.documentExpiry ?? "" }))} />
        )}
      </Panel>

      {/* ----------------------------------------------------------- actions */}
      {canEdit && !["CLOSED", "CANCELLED"].includes(status) && (
        <Panel title={status === "TICKETING" ? "Record issued tickets" : status === "ISSUED" ? "Itinerary delivery" : "Move this file on"}
          lede={status === "TICKETING" ? "Only after the partner confirms issue. Ticket numbers cannot be reused on another file." : undefined}>
          {status === "TICKETING" && (
            <div className="space-y-8">
              <IssueForm reference={enquiry.reference} version={file.version} pnr={file.pnr ?? ""} partner={file.partner} passengers={passengerOptions} />
              <div className="border-t border-[var(--line)] pt-6"><h3 className="mb-3 text-lg">Other moves</h3><MovePanel reference={enquiry.reference} version={file.version} status={status} partner={file.partner} /></div>
            </div>
          )}
          {status === "ISSUED" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <a href={`${base}/${enquiry.reference}/itinerary`} className="inline-flex items-center gap-2 font-semibold underline"><Download className="size-4" aria-hidden />Download itinerary PDF</a>
                <span className="text-sm text-[var(--ink-muted)]">{file.deliveredAt ? `Delivered ${file.deliveredAt.toLocaleDateString("en-GB", { timeZone: "Africa/Kigali" })}` : "Not delivered yet"}</span>
              </div>
              <DeliverActions reference={enquiry.reference} version={file.version} canEmail={!!enquiry.email && enquiry.replyChannel === "EMAIL"} deliveredAt={file.deliveredAt?.toISOString() ?? null} />
              <MovePanel reference={enquiry.reference} version={file.version} status={status} partner={file.partner} />
            </div>
          ) : status !== "TICKETING" && <MovePanel reference={enquiry.reference} version={file.version} status={status} partner={file.partner} />}
        </Panel>
      )}
      {status === "ISSUED" && !canEdit && (
        <p className="text-sm"><a href={`${base}/${enquiry.reference}/itinerary`} className="inline-flex items-center gap-2 font-semibold underline"><Download className="size-4" aria-hidden />Download itinerary PDF</a></p>
      )}

      {/* ------------------------------------------------------- after-sales */}
      {(status === "ISSUED" || status === "CLOSED" || file.requests.length > 0) && (
        <Panel title="After-sales" lede="Changes, reissues, voids and refunds follow the airline's rules. Record what the partner confirmed before completing each one.">
          {refundsToSettle.length > 0 && (
            <p role="note" className="mb-4 rounded-xl border-l-4 border-sun-500 bg-sun-100 px-4 py-3 text-sm text-forest-950">
              {refundsToSettle.length} refund{refundsToSettle.length > 1 ? "s" : ""} confirmed by the partner must be settled to the client by Finance in{" "}
              <Link href="/staff/finance" className="underline">Off-site finance</Link>.
            </p>
          )}
          <ul className="space-y-4">
            {file.requests.map((r) => (
              <li key={r.id} className="rounded-xl border border-[var(--line)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">#{r.number} · {SERVICE_KIND_LABEL[r.kind as ServiceKind] ?? label(r.kind)}</p>
                  <Badge tone={isServiceOpen(r.status) ? "sun" : "neutral"}>{label(r.status)}</Badge>
                </div>
                <p className="mt-1 text-sm">{r.description}</p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">{label(r.origin)} · {r.createdAt.toLocaleDateString("en-GB", { timeZone: "Africa/Kigali" })}{r.feeMinor > 0 && r.currency ? ` · fee ${money2(r.feeMinor, r.currency)}` : ""}{r.refundMinor > 0 && r.currency ? ` · refund ${money2(r.refundMinor, r.currency)}` : ""}</p>
                {r.resolution && <p className="mt-1 text-sm text-[var(--ink-muted)]">Reply: {r.resolution}</p>}
                {canEdit && <RequestHandler reference={enquiry.reference} version={file.version} currency={r.currency ?? chosen?.currency ?? "RWF"} request={r} passengers={allPassengers} />}
              </li>
            ))}
            {file.requests.length === 0 && <li className="text-sm text-[var(--ink-muted)]">No requests on this file.</li>}
          </ul>
          {canEdit && approvedChange && chosen && (
            <div className="mt-6 border-t border-[var(--line)] pt-6">
              <h3 className="mb-3 text-lg">Revise flights for request #{approvedChange.number}</h3>
              <ReviseFlightsForm key={file.version} reference={enquiry.reference} version={file.version} requestId={approvedChange.id}
                initial={chosen.segments.map((s) => ({ airline: s.airline, flightNumber: s.flightNumber, origin: s.origin, destination: s.destination, departLocal: s.departLocal, arriveLocal: s.arriveLocal, cabin: s.cabin, bookingClass: s.bookingClass, terminal: s.terminal }))} />
            </div>
          )}
          {canEdit && status === "ISSUED" && (
            <div className="mt-6 border-t border-[var(--line)] pt-6"><h3 className="mb-3 text-lg">Log a request received by phone or message</h3><StaffRequestForm reference={enquiry.reference} passengers={passengerOptions} /></div>
          )}
        </Panel>
      )}

      {/* --------------------------------------------------------- timeline */}
      <Panel title="History" lede="Every change to this file, newest first.">
        <ol className="space-y-3">
          {enquiry.activities.map((a) => (
            <li key={a.id} className="grid gap-1 border-l-2 border-[var(--line-strong)] pl-4">
              <p className="text-sm font-semibold">{label(a.kind.replace("TICKETING_", ""))}</p>
              {a.body && <p className="text-sm">{a.body}</p>}
              <p className="text-xs text-[var(--ink-muted)]">{a.actor.fullName} · {a.createdAt.toLocaleString("en-GB", { timeZone: "Africa/Kigali", dateStyle: "medium", timeStyle: "short" })}</p>
            </li>
          ))}
          {enquiry.activities.length === 0 && <li className="text-sm text-[var(--ink-muted)]">No activity yet.</li>}
        </ol>
        {file.redactedAt && <p className="mt-4 text-sm text-[var(--ink-muted)]">Travel documents were cleared on {shortDate(file.redactedAt.toISOString())}.</p>}
      </Panel>
    </>
  );
}
