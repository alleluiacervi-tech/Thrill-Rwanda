"use client";
import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  chooseOption, clientChooseFare, clientRaiseRequest, deliverTrip, handleRequest, moveTicketing, openTicketingFile, raiseStaffRequest,
  recordIssuedTickets, reviseFlights, saveOptions, saveTravellerList, shareOptions, type TicketingActionState,
} from "@/app/actions/ticketing";
import { ActionButton } from "@/components/dashboard/action-button";
import { Button } from "@/components/ui/button";
import { airlines } from "@/lib/flight-airlines";
import { label } from "@/lib/enquiry-workflow";
import { nextServiceStatuses, nextTicketingStatuses, SERVICE_KINDS, SERVICE_KIND_LABEL, type ServiceStatus, type TicketingStatus } from "@/lib/ticketing-rules";
import { cn } from "@/lib/utils";

const idle: TicketingActionState = { status: "idle" };
const input = "mt-1 w-full rounded-lg border border-[var(--line-strong)] bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1";
const small = "text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]";

function Notice({ state }: { state: TicketingActionState }) {
  if (!state.message) return null;
  return (
    <p role={state.status === "error" ? "alert" : "status"}
      className={cn("rounded-lg border px-3 py-2 text-sm", state.status === "error" ? "border-[#9b2c1f] bg-[#fdf0ee] text-[#7d2217]" : "border-forest-800/30 bg-forest-50 text-forest-900")}>
      {state.message}
    </p>
  );
}
const Field = ({ name, children }: { name: string; children: React.ReactNode }) => <label className="block"><span className={small}>{name}</span>{children}</label>;

/* Kigali is UTC+2 all year, so a typed local time maps to a fixed offset. */
const kigaliToIso = (value: string) => (value ? new Date(`${value}:00+02:00`).toISOString() : "");

/* ------------------------------------------------------------------ open */

export function OpenTicketingForm({ reference }: { reference: string }) {
  const [state, action, pending] = useActionState(openTicketingFile, idle);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="reference" value={reference} />
      <Button type="submit" variant="accent" disabled={pending}>{pending ? "Opening…" : "Open ticketing file"}</Button>
      <Notice state={state} />
    </form>
  );
}

/* ------------------------------------------------------------------ fare options */

export type SegmentDraft = {
  airline: string; flightNumber: string; origin: string; destination: string; departLocal: string; arriveLocal: string;
  cabin: string; bookingClass: string; terminal: string;
};
export type OptionDraft = {
  label: string; currency: string; total: string; fareBasis: string; baggage: string; changeRule: string; refundRule: string;
  validUntil: string; segments: SegmentDraft[];
};
const blankSegment = (): SegmentDraft => ({ airline: "WB", flightNumber: "", origin: "", destination: "", departLocal: "", arriveLocal: "", cabin: "ECONOMY", bookingClass: "", terminal: "" });
const blankOption = (currency: string): OptionDraft => ({ label: "", currency, total: "", fareBasis: "", baggage: "", changeRule: "", refundRule: "", validUntil: "", segments: [blankSegment()] });

function SegmentRows({ segments, onChange }: { segments: SegmentDraft[]; onChange: (next: SegmentDraft[]) => void }) {
  const set = (i: number, patch: Partial<SegmentDraft>) => onChange(segments.map((s, n) => (n === i ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-3">
      {segments.map((s, i) => (
        <fieldset key={i} className="rounded-xl border border-[var(--line)] p-3">
          <legend className="px-1 text-sm font-semibold">Flight {i + 1}</legend>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Field name="Airline">
              <select className={input} value={s.airline} onChange={(e) => set(i, { airline: e.target.value })}>
                {Object.entries(airlines).map(([code, name]) => <option key={code} value={code}>{code} · {name}</option>)}
              </select>
            </Field>
            <Field name="Flight no."><input className={input} value={s.flightNumber} onChange={(e) => set(i, { flightNumber: e.target.value })} placeholder="700" inputMode="numeric" /></Field>
            <Field name="From"><input className={input} value={s.origin} onChange={(e) => set(i, { origin: e.target.value.toUpperCase() })} placeholder="KGL" maxLength={3} /></Field>
            <Field name="To"><input className={input} value={s.destination} onChange={(e) => set(i, { destination: e.target.value.toUpperCase() })} placeholder="NBO" maxLength={3} /></Field>
            <Field name="Departs (local)"><input type="datetime-local" className={input} value={s.departLocal} onChange={(e) => set(i, { departLocal: e.target.value })} /></Field>
            <Field name="Arrives (local)"><input type="datetime-local" className={input} value={s.arriveLocal} onChange={(e) => set(i, { arriveLocal: e.target.value })} /></Field>
            <Field name="Cabin">
              <select className={input} value={s.cabin} onChange={(e) => set(i, { cabin: e.target.value })}>
                {["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"].map((c) => <option key={c} value={c}>{label(c)}</option>)}
              </select>
            </Field>
            <Field name="Class"><input className={input} value={s.bookingClass} onChange={(e) => set(i, { bookingClass: e.target.value.toUpperCase() })} maxLength={1} placeholder="Y" /></Field>
            <Field name="Terminal"><input className={input} value={s.terminal} onChange={(e) => set(i, { terminal: e.target.value })} maxLength={20} /></Field>
          </div>
          {segments.length > 1 && (
            <button type="button" onClick={() => onChange(segments.filter((_, n) => n !== i))} className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#9b2c1f] underline">
              <Trash2 className="size-4" aria-hidden /> Remove flight {i + 1}
            </button>
          )}
        </fieldset>
      ))}
      <Button type="button" variant="quiet" size="sm" onClick={() => onChange([...segments, blankSegment()])} disabled={segments.length >= 12}>
        <Plus className="size-4" aria-hidden /> Add flight
      </Button>
    </div>
  );
}

export function OptionsEditor({ reference, version, initial, currency }: { reference: string; version: number; initial: OptionDraft[]; currency: string }) {
  const [options, setOptions] = useState<OptionDraft[]>(initial.length ? initial : [blankOption(currency)]);
  const [state, action, pending] = useActionState(saveOptions, idle);
  const set = (i: number, patch: Partial<OptionDraft>) => setOptions(options.map((o, n) => (n === i ? { ...o, ...patch } : o)));
  const payload = JSON.stringify(options.map((o) => ({ ...o, validUntil: kigaliToIso(o.validUntil) })));
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="options" value={payload} />
      {options.map((o, i) => (
        <section key={i} className="rounded-2xl border border-[var(--line-strong)] p-4">
          <h3 className="mb-3 text-lg">Option {i + 1}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field name="Name"><input className={input} value={o.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Best value, Fastest…" maxLength={80} /></Field>
            <Field name="Currency"><input className={input} value={o.currency} onChange={(e) => set(i, { currency: e.target.value.toUpperCase() })} maxLength={3} /></Field>
            <Field name="All-in total for the party"><input className={input} inputMode="decimal" value={o.total} onChange={(e) => set(i, { total: e.target.value })} placeholder="1250.00" /></Field>
            <Field name="Price valid until (Kigali)"><input type="datetime-local" className={input} value={o.validUntil} onChange={(e) => set(i, { validUntil: e.target.value })} /></Field>
            <Field name="Fare basis"><input className={input} value={o.fareBasis} onChange={(e) => set(i, { fareBasis: e.target.value })} maxLength={40} /></Field>
            <Field name="Baggage"><input className={input} value={o.baggage} onChange={(e) => set(i, { baggage: e.target.value })} maxLength={300} placeholder="1 × 23 kg + 7 kg cabin" /></Field>
            <Field name="Change rule"><input className={input} value={o.changeRule} onChange={(e) => set(i, { changeRule: e.target.value })} maxLength={500} /></Field>
            <Field name="Refund rule"><input className={input} value={o.refundRule} onChange={(e) => set(i, { refundRule: e.target.value })} maxLength={500} /></Field>
          </div>
          <div className="mt-4"><SegmentRows segments={o.segments} onChange={(segments) => set(i, { segments })} /></div>
          {options.length > 1 && <button type="button" onClick={() => setOptions(options.filter((_, n) => n !== i))} className="mt-3 text-sm text-[#9b2c1f] underline">Remove option {i + 1}</button>}
        </section>
      ))}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="quiet" onClick={() => setOptions([...options, blankOption(currency)])} disabled={options.length >= 6}><Plus className="size-4" aria-hidden /> Add option</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save fare options"}</Button>
      </div>
      <Notice state={state} />
    </form>
  );
}
export function ShareAndChoose({ reference, version, shared, options, selectedId }: {
  reference: string; version: number; shared: boolean; options: { id: string; label: string }[]; selectedId: string | null;
}) {
  const [state, action, pending] = useActionState(chooseOption, idle);
  return (
    <div className="space-y-4">
      {!shared && <ActionButton action={shareOptions} fields={{ reference, version: String(version) }} variant="quiet">Share options with the client</ActionButton>}
      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="reference" value={reference} />
        <input type="hidden" name="version" value={version} />
        <Field name="Fare the client chose">
          <select name="optionId" className={input} defaultValue={selectedId ?? ""} required>
            <option value="" disabled>Select an option</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Record choice"}</Button>
      </form>
      <Notice state={state} />
    </div>
  );
}

/* ------------------------------------------------------------------ travellers */

export type TravellerDraft = { kind: string; title: string; givenNames: string; surname: string; dateOfBirth: string; nationality: string; documentNumber: string; documentExpiry: string };
const blankTraveller = (kind = "ADULT"): TravellerDraft => ({ kind, title: "", givenNames: "", surname: "", dateOfBirth: "", nationality: "", documentNumber: "", documentExpiry: "" });

export function TravellerEditor({ reference, version, initial, readOnly }: { reference: string; version: number; initial: TravellerDraft[]; readOnly?: boolean }) {
  const [list, setList] = useState<TravellerDraft[]>(initial.length ? initial : [blankTraveller()]);
  const [state, action, pending] = useActionState(saveTravellerList, idle);
  const set = (i: number, patch: Partial<TravellerDraft>) => setList(list.map((p, n) => (n === i ? { ...p, ...patch } : p)));
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="passengers" value={JSON.stringify(list)} />
      <p className="text-sm text-[var(--ink-muted)]">Type each name exactly as printed in the passport. Passport details are visible only to the case team and are cleared 30 days after the last flight.</p>
      {list.map((p, i) => (
        <fieldset key={i} disabled={readOnly || pending} className="rounded-xl border border-[var(--line)] p-3">
          <legend className="px-1 text-sm font-semibold">Traveller {i + 1}</legend>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Field name="Type"><select className={input} value={p.kind} onChange={(e) => set(i, { kind: e.target.value })}>{["ADULT", "CHILD", "INFANT"].map((k) => <option key={k} value={k}>{label(k)}</option>)}</select></Field>
            <Field name="Title"><select className={input} value={p.title} onChange={(e) => set(i, { title: e.target.value })}>{["", "MR", "MS", "MRS", "MISS", "MSTR", "DR"].map((t) => <option key={t} value={t}>{t || "—"}</option>)}</select></Field>
            <Field name="Given names"><input className={input} value={p.givenNames} onChange={(e) => set(i, { givenNames: e.target.value })} autoComplete="off" /></Field>
            <Field name="Surname"><input className={input} value={p.surname} onChange={(e) => set(i, { surname: e.target.value })} autoComplete="off" /></Field>
            <Field name="Date of birth"><input type="date" className={input} value={p.dateOfBirth} onChange={(e) => set(i, { dateOfBirth: e.target.value })} /></Field>
            <Field name="Nationality (2 letters)"><input className={input} value={p.nationality} onChange={(e) => set(i, { nationality: e.target.value.toUpperCase() })} maxLength={2} placeholder="RW" /></Field>
            <Field name="Passport number"><input className={input} value={p.documentNumber} onChange={(e) => set(i, { documentNumber: e.target.value.toUpperCase() })} autoComplete="off" /></Field>
            <Field name="Passport expiry"><input type="date" className={input} value={p.documentExpiry} onChange={(e) => set(i, { documentExpiry: e.target.value })} /></Field>
          </div>
          {!readOnly && list.length > 1 && <button type="button" onClick={() => setList(list.filter((_, n) => n !== i))} className="mt-3 text-sm text-[#9b2c1f] underline">Remove traveller {i + 1}</button>}
        </fieldset>
      ))}
      {!readOnly && (
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="quiet" size="sm" onClick={() => setList([...list, blankTraveller()])} disabled={list.length >= 20}><Plus className="size-4" aria-hidden /> Add traveller</Button>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save travellers"}</Button>
        </div>
      )}
      <Notice state={state} />
    </form>
  );
}

/* ------------------------------------------------------------------ status */

export function MovePanel({ reference, version, status, partner }: { reference: string; version: number; status: TicketingStatus; partner: string }) {
  const [state, action, pending] = useActionState(moveTicketing, idle);
  const options = nextTicketingStatuses(status);
  const wording: Record<string, string> = {
    AWAITING_PAYMENT: "Move to awaiting payment", OPTIONS: "Reopen fare options", READY_TO_TICKET: status === "TICKETING" ? "Release the partner hold" : "Mark ready to ticket",
    CLOSED: "Close file", CANCELLED: "Cancel file", TICKETING: "Send to partner",
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {options.filter((to) => !["TICKETING", "CANCELLED", "ISSUED"].includes(to)).map((to) => (
          <ActionButton key={to} action={moveTicketing} fields={{ reference, version: String(version), to }} variant={to === "READY_TO_TICKET" && status !== "TICKETING" ? "accent" : "quiet"} size="md">{wording[to]}</ActionButton>
        ))}
      </div>
      {options.includes("TICKETING") && (
        <form action={action} className="grid gap-3 rounded-xl border border-[var(--line)] p-4 sm:grid-cols-4">
          <input type="hidden" name="reference" value={reference} /><input type="hidden" name="version" value={version} /><input type="hidden" name="to" value="TICKETING" />
          <Field name="Booking reference (PNR)"><input name="pnr" className={input} required minLength={5} maxLength={8} autoCapitalize="characters" /></Field>
          <Field name="Ticketing partner"><input name="partner" className={input} required defaultValue={partner} maxLength={120} /></Field>
          <Field name="Ticketing time limit (Kigali)"><input name="ticketTimeLimit" type="datetime-local" className={input} required /></Field>
          <div className="flex items-end"><Button type="submit" disabled={pending}>{pending ? "Saving…" : wording.TICKETING}</Button></div>
        </form>
      )}
      {options.includes("CANCELLED") && (
        <form action={action} className="grid gap-3 rounded-xl border border-dashed border-[#9b2c1f]/50 p-4 sm:grid-cols-[1fr_auto]">
          <input type="hidden" name="reference" value={reference} /><input type="hidden" name="version" value={version} /><input type="hidden" name="to" value="CANCELLED" />
          <Field name="Reason for cancelling"><input name="reason" className={input} required minLength={10} maxLength={500} /></Field>
          <div className="flex items-end"><Button type="submit" variant="outline" disabled={pending}>Cancel file</Button></div>
        </form>
      )}
      <Notice state={state} />
    </div>
  );
}

/* ------------------------------------------------------------------ issue + deliver */

export function IssueForm({ reference, version, passengers, pnr, partner }: {
  reference: string; version: number; pnr: string; partner: string; passengers: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(recordIssuedTickets, idle);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const tickets = JSON.stringify(passengers.map((p) => ({ passengerId: p.id, ticketNumber: numbers[p.id] ?? "" })));
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="reference" value={reference} /><input type="hidden" name="version" value={version} /><input type="hidden" name="tickets" value={tickets} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field name="Booking reference (PNR)"><input name="pnr" className={input} defaultValue={pnr} required maxLength={8} /></Field>
        <Field name="Ticketing partner"><input name="partner" className={input} defaultValue={partner} required maxLength={120} /></Field>
        <Field name="Partner's own reference (optional)"><input name="partnerReference" className={input} maxLength={80} /></Field>
      </div>
      <div className="space-y-2">
        <p className={small}>E-ticket number for each traveller (13 digits)</p>
        {passengers.map((p) => (
          <label key={p.id} className="grid items-center gap-2 sm:grid-cols-[1fr_16rem]">
            <span className="font-medium">{p.name}</span>
            <input className={cn(input, "mt-0 tabular-nums")} inputMode="numeric" placeholder="176 2345678901" value={numbers[p.id] ?? ""} onChange={(e) => setNumbers({ ...numbers, [p.id]: e.target.value })} required />
          </label>
        ))}
      </div>
      <Field name="Evidence: what did the partner confirm, and where did you see it?">
        <textarea name="evidence" rows={3} className={input} required minLength={10} maxLength={1000} placeholder="Partner portal shows all tickets as OK, screenshot saved in the case folder, 14:05." />
      </Field>
      <Button type="submit" variant="accent" disabled={pending}>{pending ? "Recording…" : "Record issued tickets"}</Button>
      <Notice state={state} />
    </form>
  );
}

export function DeliverActions({ reference, version, canEmail, deliveredAt }: { reference: string; version: number; canEmail: boolean; deliveredAt: string | null }) {
  const fields = { reference, version: String(version) };
  return (
    <div className="flex flex-wrap items-center gap-3">
      {canEmail && <ActionButton action={deliverTrip} fields={{ ...fields, channel: "EMAIL" }} variant="accent" size="md">{deliveredAt ? "Email itinerary again" : "Email itinerary to client"}</ActionButton>}
      <ActionButton action={deliverTrip} fields={{ ...fields, channel: "MANUAL" }} variant="quiet" size="md">Mark as sent another way</ActionButton>
      {!canEmail && <span className="text-sm text-[var(--ink-muted)]">This client did not choose email; download the PDF and send it on their channel.</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ after-sales */

export function StaffRequestForm({ reference, passengers }: { reference: string; passengers: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(raiseStaffRequest, idle);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="reference" value={reference} />
      <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
        <Field name="Request"><select name="kind" className={input}>{SERVICE_KINDS.map((k) => <option key={k} value={k}>{SERVICE_KIND_LABEL[k]}</option>)}</select></Field>
        <Field name="What was asked"><input name="description" className={input} required minLength={10} maxLength={1500} /></Field>
      </div>
      <fieldset className="flex flex-wrap gap-4"><legend className={small}>Travellers (none ticked means everyone)</legend>
        {passengers.map((p) => <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="passengerIds" value={p.id} />{p.name}</label>)}
      </fieldset>
      <Button type="submit" variant="quiet" disabled={pending}>{pending ? "Saving…" : "Log request"}</Button>
      <Notice state={state} />
    </form>
  );
}

export function RequestHandler({ reference, version, request, currency, passengers }: {
  reference: string; version: number; currency: string;
  request: { id: string; number: number; kind: string; status: string; passengerIds: string[] };
  passengers: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(handleRequest, idle);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const next = nextServiceStatuses(request.status as ServiceStatus);
  if (!next.length) return null;
  const targets = passengers.filter((p) => request.passengerIds.includes(p.id));
  const tickets = JSON.stringify(request.kind === "REISSUE" ? targets.map((p) => ({ passengerId: p.id, ticketNumber: numbers[p.id] ?? "" })).filter((t) => t.ticketNumber) : []);
  return (
    <form action={action} className="mt-3 space-y-3 rounded-xl border border-dashed border-[var(--line-strong)] p-3">
      <input type="hidden" name="reference" value={reference} /><input type="hidden" name="version" value={version} />
      <input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="currency" value={currency} /><input type="hidden" name="tickets" value={tickets} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Field name="Move to"><select name="status" className={input}>{next.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></Field>
        <Field name={`Airline fee (${currency})`}><input name="fee" className={input} inputMode="decimal" defaultValue="0" /></Field>
        <Field name={`Refund to client (${currency})`}><input name="refund" className={input} inputMode="decimal" defaultValue="0" /></Field>
        <Field name="Partner confirmation"><input name="evidence" className={input} maxLength={1000} /></Field>
      </div>
      <Field name="Note for the client"><input name="resolution" className={input} maxLength={1000} /></Field>
      {request.kind === "REISSUE" && next.includes("COMPLETED") && (
        <div className="space-y-2"><p className={small}>New ticket numbers (needed to complete a reissue)</p>
          {targets.map((p) => <label key={p.id} className="grid items-center gap-2 sm:grid-cols-[1fr_16rem]"><span>{p.name}</span><input className={cn(input, "mt-0")} inputMode="numeric" value={numbers[p.id] ?? ""} onChange={(e) => setNumbers({ ...numbers, [p.id]: e.target.value })} /></label>)}
        </div>
      )}
      <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Update request"}</Button>
      <Notice state={state} />
    </form>
  );
}

export function ReviseFlightsForm({ reference, version, requestId, initial }: { reference: string; version: number; requestId: string; initial: SegmentDraft[] }) {
  const [segments, setSegments] = useState(initial);
  const [state, action, pending] = useActionState(reviseFlights, idle);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="reference" value={reference} /><input type="hidden" name="version" value={version} /><input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="segments" value={JSON.stringify(segments)} />
      <SegmentRows segments={segments} onChange={setSegments} />
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save revised flights"}</Button>
      <Notice state={state} />
    </form>
  );
}

/* ------------------------------------------------------------------ client */

export function ClientChooseButton({ reference, optionId, chosen }: { reference: string; optionId: string; chosen: boolean }) {
  const [state, action, pending] = useActionState(clientChooseFare, idle);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="reference" value={reference} /><input type="hidden" name="optionId" value={optionId} />
      <Button type="submit" variant={chosen ? "primary" : "accent"} disabled={pending}>{pending ? "Saving…" : chosen ? "Chosen · change" : "Choose this fare"}</Button>
      <Notice state={state} />
    </form>
  );
}

export function ClientRequestForm({ reference, passengers }: { reference: string; passengers: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(clientRaiseRequest, idle);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="reference" value={reference} />
      <Field name="What do you need?"><select name="kind" className={input}>{SERVICE_KINDS.map((k) => <option key={k} value={k}>{SERVICE_KIND_LABEL[k]}</option>)}</select></Field>
      <Field name="Tell us the details"><textarea name="description" rows={3} className={input} required minLength={10} maxLength={1500} placeholder="For example: move the return flight to 12 March, or refund Ms Uwase's ticket." /></Field>
      <fieldset className="flex flex-wrap gap-4"><legend className={small}>Which travellers (none ticked means everyone)</legend>
        {passengers.map((p) => <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="passengerIds" value={p.id} />{p.name}</label>)}
      </fieldset>
      <p className="text-sm text-[var(--ink-muted)]">Airlines set the fees and rules for changes and refunds. We will confirm the cost with you before anything is done.</p>
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send request"}</Button>
      <Notice state={state} />
    </form>
  );
}
