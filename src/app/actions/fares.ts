"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { FARE_SOURCE_LABEL, isFareSource, sourceReadiness } from "@/lib/fare-sources";
import { getFareSource, runFareWatch } from "@/lib/fare-watch";
import { runObservedWorker } from "@/lib/worker-health";

export type FareActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; message: string };

/** Chooses where the public flights board gets its prices. Off hides every price straight away. */
export async function setFareSource(_prev: FareActionState, formData: FormData): Promise<FareActionState> {
  const admin = await requireAdmin();
  const source = formData.get("source");
  if (!isFareSource(source)) return { status: "error", message: "Choose Off, Duffel or Skyscanner." };
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
        : `${FARE_SOURCE_LABEL[source]} is now the price source. The next check runs at 06:15 Kigali time, or run one now.`,
  };
}

/** Runs today's check straight away, against the chosen source. Takes up to a few minutes. */
export async function runFareCheckNow(_prev: FareActionState): Promise<FareActionState> {
  await requireAdmin();
  const source = await getFareSource();
  if (source === "off") return { status: "error", message: "Choose a price source first." };
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
