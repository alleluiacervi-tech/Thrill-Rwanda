"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import {
  addFares,
  bookWithDuffel,
  clearDuffelAttempt,
  refreshDuffelTickets,
  searchFares,
  testDuffelConnection,
  type BookingOutcome,
  type FareSearch,
} from "@/lib/ticketing-duffel";
import { TicketingError } from "@/lib/ticketing-rules";

/**
 * What the desk's "Live fares" panel calls. Each action re-checks who is
 * asking, answers with a result the screen can show, and records anything that
 * changes a file or spends money in the activity log.
 */

export type DuffelResult<T = void> = { ok: true; data: T; message?: string } | { ok: false; error: string };

const head = z.object({ reference: z.string().min(1).max(80), version: z.coerce.number().int().min(0) });
const reference = z.string().min(1).max(80);

function refresh(ref: string) {
  for (const root of ["/staff/ticketing", "/admin/ticketing"]) {
    revalidatePath(root);
    revalidatePath(`${root}/${ref}`);
  }
  revalidatePath(`/account/enquiries/${ref}/trip`);
}

async function guard<T>(work: () => Promise<DuffelResult<T>>): Promise<DuffelResult<T>> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof TicketingError) return { ok: false, error: error.message };
    console.error("[duffel] action failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "That could not be completed. Refresh the file to check where it stands before trying again." };
  }
}

const bad: DuffelResult<never> = { ok: false, error: "That request was not understood." };

export async function checkDuffel() {
  await requireEnquiryStaff();
  return testDuffelConnection();
}

export async function searchLiveFares(ref: string): Promise<DuffelResult<FareSearch>> {
  const actor = await requireEnquiryStaff();
  const parsed = reference.safeParse(ref);
  if (!parsed.success) return bad;
  return guard(async () => ({ ok: true, data: await searchFares(actor.id, parsed.data) }));
}

export async function addLiveFares(input: { reference: string; version: number; offerIds: string[] }): Promise<DuffelResult<{ added: number }>> {
  const actor = await requireEnquiryStaff();
  const parsed = head.extend({ offerIds: z.array(z.string().regex(/^off_[A-Za-z0-9]+$/)).min(1).max(6) }).safeParse(input);
  if (!parsed.success) return bad;
  return guard(async () => {
    const data = await addFares(actor.id, parsed.data);
    await logActivity(actor.id, {
      action: "ticketing.duffel.fares", area: "Enquiries", target: parsed.data.reference,
      summary: `Added ${data.added} live ${data.added === 1 ? "fare" : "fares"} from Duffel to ${parsed.data.reference}.`,
    });
    refresh(parsed.data.reference);
    return { ok: true, data, message: `${data.added} ${data.added === 1 ? "fare" : "fares"} added to the options.` };
  });
}

export async function bookLiveFare(input: { reference: string; version: number }): Promise<DuffelResult<BookingOutcome>> {
  const actor = await requireEnquiryStaff();
  const parsed = head.safeParse(input);
  if (!parsed.success) return bad;
  return guard(async () => {
    const data = await bookWithDuffel(actor.id, parsed.data);
    await logActivity(actor.id, {
      action: "ticketing.duffel.book", area: "Enquiries", target: parsed.data.reference,
      summary: `Booked ${parsed.data.reference} through Duffel (${data.mode}), reference ${data.pnr}.`,
      changes: { orderId: data.orderId, mode: data.mode, issued: data.issued },
    });
    refresh(parsed.data.reference);
    return {
      ok: true, data,
      message: data.issued
        ? `Booked and ticketed. Reference ${data.pnr}.`
        : `Booked. Reference ${data.pnr}. Ticket numbers are not issued yet${data.waitingFor.length ? ` for ${data.waitingFor.join(", ")}` : ""}.`,
    };
  });
}

export async function refreshLiveTickets(ref: string): Promise<DuffelResult<BookingOutcome>> {
  const actor = await requireEnquiryStaff();
  const parsed = reference.safeParse(ref);
  if (!parsed.success) return bad;
  return guard(async () => {
    const data = await refreshDuffelTickets(actor.id, { reference: parsed.data });
    if (data.issued) {
      await logActivity(actor.id, {
        action: "ticketing.duffel.tickets", area: "Enquiries", target: parsed.data,
        summary: `Recorded the tickets for ${parsed.data} from Duffel order ${data.orderId}.`,
      });
    }
    refresh(parsed.data);
    return { ok: true, data, message: data.issued ? "Tickets recorded." : "Duffel has not issued every ticket yet. Try again shortly." };
  });
}

export async function clearLiveAttempt(input: { reference: string; version: number }): Promise<DuffelResult> {
  const actor = await requireEnquiryStaff();
  const parsed = head.safeParse(input);
  if (!parsed.success) return bad;
  return guard(async () => {
    await clearDuffelAttempt(actor.id, parsed.data);
    await logActivity(actor.id, {
      action: "ticketing.duffel.clear", area: "Enquiries", target: parsed.data.reference,
      summary: `Cleared an unconfirmed Duffel booking attempt on ${parsed.data.reference}.`,
    });
    refresh(parsed.data.reference);
    return { ok: true, data: undefined, message: "Cleared. The file can be booked again." };
  });
}
