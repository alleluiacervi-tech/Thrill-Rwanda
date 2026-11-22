"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import {
  AIRPORT_TRANSFER_BANDS,
  AIRPORT_TRANSFER_DIRECTIONS,
  AIRPORT_TRANSFER_KEY,
  airportTransferRateSchema,
} from "@/lib/airport-transfer-pricing";
import { db } from "@/lib/db";
import { todayInRwanda } from "@/lib/flight-enquiry-schema";
import { requireAdmin } from "@/lib/session";

type PricingState = { status: "idle" | "saved" | "error"; message?: string };

export async function saveAirportTransferPricing(_previous: PricingState, form: FormData): Promise<PricingState> {
  const admin = await requireAdmin("/admin/transfers/pricing");
  const field = (name: string) => String(form.get(name) ?? "").trim();
  const integer = (name: string) => /^\d+$/.test(field(name)) ? Number(field(name)) : NaN;
  const percentToBps = (name: string) => /^\d{1,2}(\.\d{1,2})?$/.test(field(name))
    ? Math.round(Number(field(name)) * 100)
    : NaN;
  const version = Number(field("version"));
  const isActive = form.get("isActive") === "on";
  const parsed = airportTransferRateSchema.safeParse({
    supplierRwf: Object.fromEntries(AIRPORT_TRANSFER_DIRECTIONS.map((direction) => [
      direction, AIRPORT_TRANSFER_BANDS.map(({ maxMeters }) => integer(`${direction}_${maxMeters}`)),
    ])),
    dispatchRwf: integer("dispatchRwf"),
    nightRwf: integer("nightRwf"),
    paymentBps: percentToBps("paymentPercent"),
    contributionBps: percentToBps("contributionPercent"),
    validThrough: field("validThrough"),
    evidence: field("evidence"),
  });
  if (!parsed.success || !Number.isSafeInteger(version) || version < -1 || version >= 2_147_483_647) {
    return {
      status: "error",
      message: "Enter all six supplier rates in ascending order, whole-franc costs, payment cost up to 15%, contribution up to 50%, and a dated supplier agreement reference.",
    };
  }
  if (isActive && parsed.data.validThrough < todayInRwanda()) {
    return { status: "error", message: "Enter a current contract expiry before enabling estimates." };
  }
  try {
    const data = { rates: parsed.data, isActive, version: version + 1 };
    const result = version === -1
      ? await db.airportTransferPricing.createMany({ data: { key: AIRPORT_TRANSFER_KEY, ...data }, skipDuplicates: true })
      : await db.airportTransferPricing.updateMany({ where: { key: AIRPORT_TRANSFER_KEY, version }, data });
    if (!result.count) return { status: "error", message: "Someone updated this rate card. Reload to review the current rates." };
    await logActivity(admin.id, {
      action: "airport_transfer_pricing.save",
      area: "Transfers",
      target: AIRPORT_TRANSFER_KEY,
      summary: `Saved airport sedan rates and ${isActive ? "enabled" : "paused"} estimates`,
      changes: data,
    });
    revalidatePath("/admin/transfers/pricing");
    revalidatePath("/transfers");
    return { status: "saved", message: "Airport sedan rates saved." };
  } catch {
    return { status: "error", message: "Rates could not be saved. Try again." };
  }
}
