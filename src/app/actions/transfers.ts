"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { refreshPublicCatalogue } from "@/lib/catalogue";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { splitAreas, transferZoneSchema, type TransferZoneState } from "@/lib/transfer-zones-shared";

// Admin-only management of the transfer zone prices.

const FIELDS = ["origin", "name", "areas", "distance", "sedan", "van", "premium", "sortOrder", "isActive"] as const;

function parse(formData: FormData) {
  return transferZoneSchema.safeParse({
    origin: formData.get("origin"),
    name: formData.get("name"),
    areas: formData.get("areas"),
    distance: formData.get("distance") ?? "",
    sedan: formData.get("sedan"),
    van: formData.get("van"),
    premium: formData.get("premium"),
    sortOrder: formData.get("sortOrder") || 0,
    isActive: formData.get("isActive") === "on",
  });
}

function submitted(formData: FormData) {
  return Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
}

function invalid(error: z.ZodError, formData: FormData): TransferZoneState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { status: "error", message: "Please check the highlighted fields.", fieldErrors, values: submitted(formData), attempt: Date.now() };
}

// Shillings in the form, cents in the table; areas tidied to "A, B, C".
function toRow(data: z.infer<typeof transferZoneSchema>) {
  const { sedan, van, premium, areas, distance, ...rest } = data;
  return {
    ...rest,
    areas: splitAreas(areas).join(", "),
    distance: distance || null,
    sedanMinor: sedan * 100,
    vanMinor: van * 100,
    premiumMinor: premium * 100,
  };
}

function refresh() {
  revalidatePath("/admin/transfers");
  // The homepage and /transfers both show these prices.
  refreshPublicCatalogue();
}

export async function createTransferZone(_prev: TransferZoneState, formData: FormData): Promise<TransferZoneState> {
  await requireAdmin();
  const parsed = parse(formData);
  if (!parsed.success) return invalid(parsed.error, formData);

  try {
    await db.transferZone.create({ data: toRow(parsed.data) });
  } catch (err) {
    console.error("[transfers] create failed", err);
    return { status: "error", message: "We couldn't save that zone. Please try again.", values: submitted(formData), attempt: Date.now() };
  }
  refresh();
  return { status: "success" };
}

export async function updateTransferZone(_prev: TransferZoneState, formData: FormData): Promise<TransferZoneState> {
  await requireAdmin();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: "That zone reference isn't valid." };
  const parsed = parse(formData);
  if (!parsed.success) return invalid(parsed.error, formData);

  try {
    await db.transferZone.update({ where: { id: id.data }, data: toRow(parsed.data) });
  } catch (err) {
    if (typeof err === "object" && err && "code" in err && err.code === "P2025") {
      return { status: "error", message: "That zone no longer exists. It may have been deleted." };
    }
    console.error("[transfers] update failed", err);
    return { status: "error", message: "We couldn't save that zone. Please try again." };
  }
  refresh();
  return { status: "success" };
}

type SimpleState = { status: "idle" | "error" | "ok"; message?: string };

export async function setTransferZoneActive(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  await requireAdmin();
  const parsed = z
    .object({ id: z.string().uuid(), active: z.enum(["true", "false"]) })
    .safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!parsed.success) return { status: "error", message: "That zone reference isn't valid." };

  await db.transferZone.updateMany({ where: { id: parsed.data.id }, data: { isActive: parsed.data.active === "true" } });
  refresh();
  return { status: "idle" };
}

// Bookings keep their own copy of the price and areas, so a delete is clean.
export async function deleteTransferZone(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  await requireAdmin();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: "That zone reference isn't valid." };

  const { count } = await db.transferZone.deleteMany({ where: { id: id.data } });
  if (count === 0) return { status: "error", message: "That zone was already deleted." };
  refresh();
  return { status: "ok", message: "Zone deleted." };
}
