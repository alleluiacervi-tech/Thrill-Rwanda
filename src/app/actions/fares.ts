"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { FARE_SOURCE_LABEL, isFareSource, sourceReadiness } from "@/lib/fare-sources";
import { getFareSource, runFareWatch } from "@/lib/fare-watch";
import { runObservedWorker } from "@/lib/worker-health";
import { toMinor } from "@/lib/duffel/mapping";
import { allDestinations, KIGALI } from "@/lib/flight-destinations";

export type FareActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; message: string };

/** Chooses where the public flights board gets its prices. Off hides every price straight away. */
export async function setFareSource(_prev: FareActionState, formData: FormData): Promise<FareActionState> {
  const admin = await requireAdmin();
  const source = formData.get("source");
  if (!isFareSource(source)) return { status: "error", message: "Choose a price source." };
  const ready = sourceReadiness(source);
  if (!ready.ok) return { status: "error", message: `${FARE_SOURCE_LABEL[source]} can't be used yet. ${ready.reason}` };

  const before = await getFareSource();
  if (before === source) return { status: "done", message: `${FARE_SOURCE_LABEL[source]} is already the price source.` };
  await db.siteSettings.upsert({ where: { id: 1 }, update: { fareSource: source }, create: { id: 1, fareSource: source } });
  await logActivity(admin.id, {
    action: "settings.update",
    area: "Settings",
    target: "Flight fares",
    summary: `Changed the flight price source from ${FARE_SOURCE_LABEL[before]} to ${FARE_SOURCE_LABEL[source]}`,
    changes: { fareSource: { from: before, to: source } } as never,
  });
  revalidatePath("/flights");
  revalidatePath("/admin/fares");
  return {
    status: "done",
    message:
      source === "off"
        ? "Fares are off. The flights page no longer shows any price."
        : source === "manual"
          ? "The flights page now shows only the fares your desk adds below."
          : `${FARE_SOURCE_LABEL[source]} is now the price source, beside any desk fares. The next check runs at 06:15 Kigali time, or run one now.`,
  };
}

/** Runs today's check straight away, against the chosen source. Takes up to a few minutes. */
export async function runFareCheckNow(_prev: FareActionState): Promise<FareActionState> {
  await requireAdmin();
  const source = await getFareSource();
  if (source === "off" || source === "manual") return { status: "error", message: "Choose an API source first. Desk fares need no check." };
  try {
    const result = await runObservedWorker("fare-watch", () => runFareWatch(new Date(), source), (value) => value.saved);
    revalidatePath("/flights");
    revalidatePath("/admin/fares");
    if (result.skipped) return { status: "error", message: result.skipped };
    const failed = result.failed ? ` ${result.failed} could not be checked.` : "";
    return {
      status: "done",
      message: `Checked ${result.searched} routes with ${FARE_SOURCE_LABEL[source]}: ${result.saved} new ${result.saved === 1 ? "fare" : "fares"} stored.${failed}`,
    };
  } catch {
    return { status: "error", message: "The check failed. Try again in a few minutes; if it keeps failing, check the key in the server settings." };
  }
}

/* ------------------------------------------------- fares typed in by the desk */

const deskFare = z.object({
  destination: z.enum(allDestinations.map((place) => place.code) as [string, ...string[]], { message: "Choose a destination." }),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the departure date."),
  price: z.coerce.number({ message: "Enter the fare." }).positive("Enter the fare.").max(100_000_000, "That fare looks too high."),
  currency: z.enum(["USD", "RWF", "EUR"]),
  airline: z.string().trim().max(60, "Keep the airline under 60 characters."),
  stops: z.coerce.number().int().min(0).max(3),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose until when the fare shows."),
  dealNote: z.string().trim().max(60, "Keep the deal line under 60 characters.").transform((v) => v || null),
});

/** A fare the desk checked itself. It shows on /flights until its "show until" date, beside any fetched fares. */
export async function addDeskFare(_prev: FareActionState, formData: FormData): Promise<FareActionState> {
  const admin = await requireAdmin();
  const parsed = deskFare.safeParse(Object.fromEntries(["destination", "departureDate", "price", "currency", "airline", "stops", "validUntil", "dealNote"].map((k) => [k, formData.get(k) ?? ""])));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the fare." };
  const fare = parsed.data;
  const today = new Date().toISOString().slice(0, 10);
  if (fare.departureDate <= today) return { status: "error", message: "The departure date must be after today." };
  if (fare.validUntil < today) return { status: "error", message: "\"Show until\" can't be in the past." };
  if (fare.validUntil > fare.departureDate) return { status: "error", message: "\"Show until\" must be on or before the departure date." };

  await db.fareSnapshot.create({
    data: {
      origin: KIGALI.code,
      destination: fare.destination,
      departureDate: new Date(`${fare.departureDate}T00:00:00Z`),
      currency: fare.currency,
      totalMinor: toMinor(fare.price.toFixed(fare.currency === "RWF" ? 0 : 2), fare.currency),
      airline: fare.airline,
      stops: fare.stops,
      source: "manual",
      // Shown through the end of that day in Kigali (UTC+2).
      validUntil: new Date(`${fare.validUntil}T21:59:59Z`),
      dealNote: fare.dealNote,
    },
  });
  const city = allDestinations.find((place) => place.code === fare.destination)?.city ?? fare.destination;
  await logActivity(admin.id, {
    action: "settings.update",
    area: "Settings",
    target: "Flight fares",
    summary: `Added a desk fare: Kigali to ${city}, ${fare.departureDate}, ${fare.currency} ${fare.price}`,
  });
  revalidatePath("/flights");
  revalidatePath("/admin/fares");
  return { status: "done", message: `Added Kigali to ${city}. It shows on the flights page until ${fare.validUntil}.` };
}

/** Takes a desk fare off the board straight away. */
export async function removeDeskFare(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  const removed = await db.fareSnapshot.deleteMany({ where: { id, source: "manual" } });
  if (removed.count) {
    await logActivity(admin.id, { action: "settings.update", area: "Settings", target: "Flight fares", summary: "Removed a desk fare" });
  }
  revalidatePath("/flights");
  revalidatePath("/admin/fares");
}

/* ----------------------------------------------------------- online booking */

const onlineSchema = z.object({
  flightOnline: z.literal("on").optional(),
  usdRwf: z.coerce.number().int("Enter the rate in whole francs").min(500, "That rate looks wrong: francs per one US dollar").max(10_000, "That rate looks wrong: francs per one US dollar"),
  bufferPercent: z.coerce.number().int().min(0).max(15, "Keep the buffer at 15% or less"),
  feeRwf: z.coerce.number().int().min(0).max(1_000_000),
  ownerId: z.string().uuid("Choose who handles online bookings"),
});

/** Online booking terms: the switch, today's rate, the buffer, the fee and the desk owner. */
export async function saveOnlineBooking(_prev: FareActionState, formData: FormData): Promise<FareActionState> {
  const admin = await requireAdmin();
  const parsed = onlineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the values." };
  const { usdRwf, bufferPercent, feeRwf, ownerId } = parsed.data;
  const on = parsed.data.flightOnline === "on";
  const owner = await db.user.findUnique({ where: { id: ownerId }, select: { isActive: true, role: true, staffRole: true, fullName: true } });
  if (!owner?.isActive || !(owner.role === "ADMIN" || ["SALES", "OPERATIONS"].includes(owner.staffRole ?? ""))) {
    return { status: "error", message: "Choose an active administrator, sales or operations member." };
  }
  const before = await db.siteSettings.findUnique({ where: { id: 1 }, select: { flightOnline: true, flightUsdRwf: true, flightFxBufferPercent: true, flightFeeRwf: true, flightOwnerId: true } });
  const data = { flightOnline: on, flightUsdRwf: usdRwf, flightRateSetAt: new Date(), flightFxBufferPercent: bufferPercent, flightFeeRwf: feeRwf, flightOwnerId: ownerId };
  await db.siteSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  await logActivity(admin.id, {
    action: "settings.update",
    area: "Settings",
    target: "Online flight booking",
    summary: `${on ? "Opened" : "Closed"} online flight booking at ${usdRwf} RWF per USD, ${bufferPercent}% buffer, RWF ${feeRwf} fee per traveller, owner ${owner.fullName}`,
    changes: { before, after: data } as never,
  });
  revalidatePath("/admin/fares");
  return {
    status: "done",
    message: on
      ? `Saved. Travellers can book online while the rate is less than 72 hours old; update it each working day.`
      : "Saved. Online booking stays closed to travellers; staff can still try it.",
  };
}
