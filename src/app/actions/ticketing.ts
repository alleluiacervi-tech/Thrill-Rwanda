"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { requireUser } from "@/lib/session";
import { processNotificationBatch } from "@/lib/notification-worker";
import { toQuoteMinor } from "@/lib/quote-rules";
import {
  advanceTicketing, chooseFareOption, clientChooseFareOption, deliverItinerary, issueTickets, openTicketing, raiseServiceRequest,
  reviseItinerary, saveFareOptions, saveTravellers, shareFareOptions, TicketingError, updateServiceRequest,
} from "@/lib/ticketing";
import {
  clientServiceSchema, issueSchema, optionsSchema, passengersSchema, pnrSchema, segmentSchema, staffServiceSchema, ticketNumberSchema,
} from "@/lib/ticketing-rules";

export type TicketingActionState = { status: "idle" | "ok" | "error"; message?: string };
const fail = (message: string): TicketingActionState => ({ status: "error", message });
const ok = (message: string): TicketingActionState => ({ status: "ok", message });

const base = z.object({ reference: z.string().min(1).max(80), version: z.coerce.number().int().min(0) });
const json = (form: FormData, key: string) => {
  try { return JSON.parse(String(form.get(key) ?? "")); } catch { return undefined; }
};
const issues = (error: z.ZodError) => error.issues.map((i) => `${i.path.length ? `${i.path.join(".")}: ` : ""}${i.message}`).join("; ");

function refresh(reference: string) {
  for (const root of ["/staff/ticketing", "/admin/ticketing"]) { revalidatePath(root); revalidatePath(`${root}/${reference}`); }
  revalidatePath(`/account/enquiries/${reference}/trip`);
}

/** Runs a mutation, turns known errors into messages and records the action. */
async function run(
  summary: string, area: "Enquiries", reference: string, action: string, actorId: string, work: () => Promise<unknown>, success: string,
): Promise<TicketingActionState> {
  try {
    await work();
  } catch (error) {
    if (error instanceof TicketingError) return fail(error.message);
    console.error("[ticketing] action failed", action);
    return fail("The change could not be confirmed. Refresh the file to check its state before retrying.");
  }
  await logActivity(actorId, { action, area, target: reference, summary });
  refresh(reference);
  return ok(success);
}

export async function openTicketingFile(_: TicketingActionState, form: FormData): Promise<TicketingActionState> {
  const actor = await requireEnquiryStaff();
  const reference = String(form.get("reference") ?? "");
  return run(`Opened ticketing for ${reference}`, "Enquiries", reference, "ticketing.open", actor.id, () => openTicketing(actor.id, reference), "Ticketing file opened.");
}

export async function saveOptions(_: TicketingActionState, form: FormData): Promise<TicketingActionState> {
  const actor = await requireEnquiryStaff();
  const head = base.safeParse(Object.fromEntries(form));
  const raw = json(form, "options");
  if (!head.success || !Array.isArray(raw)) return fail("Check the fare options.");
  let options;
  try {
    options = raw.map((o: Record<string, unknown>) => ({
      ...o,
      totalMinor: toQuoteMinor(String(o.total ?? ""), String(o.currency ?? "")),
    }));
  } catch (error) { return fail(error instanceof Error ? error.message : "Check the fare amounts."); }
  const parsed = optionsSchema.safeParse(options);
  if (!parsed.success) return fail(issues(parsed.error));
  return run(`Saved fare options for ${head.data.reference}`, "Enquiries", head.data.reference, "ticketing.options", actor.id,
    () => saveFareOptions(actor.id, { ...head.data, options: parsed.data }), "Fare options saved.");
}

export async function shareOptions(_: TicketingActionState, form: FormData): Promise<TicketingActionState> {
  const actor = await requireEnquiryStaff();
  const head = base.safeParse(Object.fromEntries(form));
  if (!head.success) return fail("Reload the file.");
  return run(`Shared fare options for ${head.data.reference}`, "Enquiries", head.data.reference, "ticketing.share", actor.id,
    () => shareFareOptions(actor.id, head.data.reference, head.data.version), "Fare options are now visible to the client.");
}

export async function chooseOption(_: TicketingActionState, form: FormData): Promise<TicketingActionState> {
  const actor = await requireEnquiryStaff();
  const parsed = base.extend({ optionId: z.string().uuid() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("Choose a fare option.");
  return run(`Recorded the chosen fare for ${parsed.data.reference}`, "Enquiries", parsed.data.reference, "ticketing.choose", actor.id,
    () => chooseFareOption(actor.id, parsed.data), "Fare recorded as chosen.");
}

export async function saveTravellerList(_: TicketingActionState, form: FormData): Promise<TicketingActionState> {
  const actor = await requireEnquiryStaff();
  const head = base.safeParse(Object.fromEntries(form));
  const parsed = passengersSchema.safeParse(json(form, "passengers"));
  if (!head.success || !parsed.success) return fail(parsed.success ? "Reload the file." : issues(parsed.error));
  return run(`Updated travellers for ${head.data.reference}`, "Enquiries", head.data.reference, "ticketing.travellers", actor.id,
    () => saveTravellers(actor.id, { ...head.data, passengers: parsed.data }), "Travellers saved.");
}

const moveSchema = base.extend({
  to: z.enum(["AWAITING_PAYMENT", "OPTIONS", "READY_TO_TICKET", "TICKETING", "CANCELLED", "CLOSED"]),
  pnr: z.string().optional(), partner: z.string().trim().max(120).optional(), ticketTimeLimit: z.string().optional(), reason: z.string().trim().max(500).optional(),
});
export async function moveTicketing(_: TicketingActionState, form: FormData): Promise<TicketingActionState> {
  const actor = await requireEnquiryStaff();
  const parsed = moveSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("Check the details and try again.");
  const { reference, version, to } = parsed.data;
  let move;
  if (to === "TICKETING") {
    const pnr = pnrSchema.safeParse(parsed.data.pnr);
    // The form sends a Kigali wall-clock time; Kigali is UTC+2 all year.
    const limit = new Date(`${String(parsed.data.ticketTimeLimit ?? "")}:00+02:00`);
    if (!pnr.success) return fail(pnr.error.issues[0]!.message);
    if (!parsed.data.partner || parsed.data.partner.length < 2) return fail("Name the ticketing partner.");
    if (Number.isNaN(limit.getTime())) return fail("Enter the ticketing time limit the partner gave you.");
    move = { to, pnr: pnr.data, partner: parsed.data.partner, ticketTimeLimit: limit } as const;
  } else if (to === "CANCELLED") {
    if ((parsed.data.reason ?? "").length < 10) return fail("Explain why the file is being cancelled (at least 10 characters).");
    move = { to, reason: parsed.data.reason! } as const;
  } else move = { to } as const;
  return run(`Moved ticketing for ${reference} to ${to}`, "Enquiries", reference, "ticketing.move", actor.id,
    () => advanceTicketing(actor.id, { reference, version, move }), "Ticketing status updated.");
}

export async function recordIssuedTickets(_: TicketingActionState, form: FormData): Promise<TicketingActionState> {
  const actor = await requireEnquiryStaff();
  const head = base.safeParse(Object.fromEntries(form));
  const parsed = issueSchema.safeParse({ ...Object.fromEntries(form), tickets: json(form, "tickets") });
  if (!head.success || !parsed.success) return fail(parsed.success ? "Reload the file." : issues(parsed.error));
  return run(`Recorded issued tickets for ${head.data.reference}`, "Enquiries", head.data.reference, "ticketing.issue", actor.id,
    () => issueTickets(actor.id, { ...head.data, issue: parsed.data }), "Tickets recorded. The itinerary is ready to deliver.");
}

export async function deliverTrip(_: TicketingActionState, form: FormData): Promise<TicketingActionState> {
  const actor = await requireEnquiryStaff();
  const parsed = base.extend({ channel: z.enum(["EMAIL", "MANUAL"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("Reload the file.");
  let job: string | null = null;
  const result = await run(`Delivered the itinerary for ${parsed.data.reference}`, "Enquiries", parsed.data.reference, "ticketing.deliver", actor.id, async () => {
    job = await deliverItinerary(actor.id, parsed.data);
  }, parsed.data.channel === "EMAIL" ? "Itinerary email queued. Track it under notification delivery." : "Marked as delivered.");
  if (job) after(async () => { await processNotificationBatch({ ids: [job!], limit: 1 }); });
  return result;
}

export async function raiseStaffRequest(_: TicketingActionState, form: FormData): Promise<TicketingActionState> {
  const actor = await requireEnquiryStaff();
  const parsed = clientServiceSchema.safeParse({ ...Object.fromEntries(form), passengerIds: form.getAll("passengerIds").map(String) });
  if (!parsed.success) return fail(issues(parsed.error));
  return run(`Raised an after-sales request on ${parsed.data.reference}`, "Enquiries", parsed.data.reference, "ticketing.request", actor.id,
    () => raiseServiceRequest(actor.id, parsed.data, "STAFF"), "Request recorded.");
}

export async function handleRequest(_: TicketingActionState, form: FormData): Promise<TicketingActionState> {
  const actor = await requireEnquiryStaff();
  const head = base.safeParse(Object.fromEntries(form));
  const parsed = staffServiceSchema.safeParse({ ...Object.fromEntries(form), feeMinor: 0, refundMinor: 0 });
  if (!head.success || !parsed.success) return fail("Check the details and try again.");
  const tickets = (json(form, "tickets") ?? []) as { passengerId: string; ticketNumber: string }[];
  const checked = z.array(z.object({ passengerId: z.string().uuid(), ticketNumber: ticketNumberSchema })).safeParse(tickets);
  if (!checked.success) return fail(issues(checked.error));
  const currency = String(form.get("currency") || "RWF");
  let feeMinor: number, refundMinor: number;
  try {
    feeMinor = toQuoteMinor(String(form.get("fee") || "0"), currency);
    refundMinor = toQuoteMinor(String(form.get("refund") || "0"), currency);
  } catch (error) { return fail(error instanceof Error ? error.message : "Check the amounts."); }
  return run(`Updated an after-sales request on ${head.data.reference}`, "Enquiries", head.data.reference, "ticketing.request.update", actor.id,
    () => updateServiceRequest(actor.id, { ...head.data, requestId: parsed.data.requestId, status: parsed.data.status, evidence: parsed.data.evidence, resolution: parsed.data.resolution, feeMinor, refundMinor, tickets: checked.data }),
    "Request updated.");
}

export async function reviseFlights(_: TicketingActionState, form: FormData): Promise<TicketingActionState> {
  const actor = await requireEnquiryStaff();
  const head = base.extend({ requestId: z.string().uuid() }).safeParse(Object.fromEntries(form));
  const segments = z.array(segmentSchema).min(1).max(12).safeParse(json(form, "segments"));
  if (!head.success || !segments.success) return fail(segments.success ? "Reload the file." : issues(segments.error));
  return run(`Revised the itinerary for ${head.data.reference}`, "Enquiries", head.data.reference, "ticketing.revise", actor.id,
    () => reviseItinerary(actor.id, { ...head.data, segments: segments.data }), "Itinerary revised. Deliver the new itinerary to the client.");
}

/* ---------------------------------------------------------------- clients */

export async function clientChooseFare(_: TicketingActionState, form: FormData): Promise<TicketingActionState> {
  const user = await requireUser("/account/enquiries");
  const parsed = z.object({ reference: z.string().min(1).max(80), optionId: z.string().uuid() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("Choose a fare.");
  try {
    await clientChooseFareOption(user.id, parsed.data);
  } catch (error) {
    return fail(error instanceof TicketingError ? error.message : "Your choice could not be confirmed. Reload the page and try again.");
  }
  refresh(parsed.data.reference);
  return ok("Fare chosen. Our team will confirm the price and send payment instructions.");
}

export async function clientRaiseRequest(_: TicketingActionState, form: FormData): Promise<TicketingActionState> {
  const user = await requireUser("/account/enquiries");
  const parsed = clientServiceSchema.safeParse({ ...Object.fromEntries(form), passengerIds: form.getAll("passengerIds").map(String) });
  if (!parsed.success) return fail(issues(parsed.error));
  try {
    await raiseServiceRequest(user.id, parsed.data, "CLIENT");
  } catch (error) {
    return fail(error instanceof TicketingError ? error.message : "Your request could not be confirmed. Reload the page before retrying.");
  }
  refresh(parsed.data.reference);
  return ok("Request sent. The desk will contact you with options and any airline fees.");
}
