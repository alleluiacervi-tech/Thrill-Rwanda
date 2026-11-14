import { RESIDENCY_LABELS, isResidency } from "@/lib/residency";

export type BookingExtra = {
  key: "route" | "pickupTime" | "flight" | "vehicle" | "residency" | "driver" | "traveller" | "phone";
  label: string;
  value: string;
};

const VEHICLE_LABELS: Record<string, string> = {
  sedan: "Executive sedan",
  suv: "SUV",
  van: "Van (6–7 seats)",
  minibus: "Minibus (8+)",
};

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** A zone-priced transfer's lines: the vehicle fare, then any night or terminus fees. Null for older bookings. */
export function transferPriceLines(details: unknown): { label: string; minor: number }[] | null {
  const t = (details as { transfer?: Record<string, unknown> } | null)?.transfer;
  if (!t || typeof t.fareMinor !== "number") return null;
  const extras = Array.isArray(t.extras)
    ? (t.extras as unknown[]).filter(
        (e): e is { label: string; minor: number } =>
          !!e && typeof (e as { label?: unknown }).label === "string" && typeof (e as { minor?: unknown }).minor === "number",
      )
    : [];
  const vehicle = text(t.vehicle) ?? "Vehicle";
  const zone = text(t.zone);
  return [{ label: `${vehicle} fare${zone ? ` (${zone})` : ""}`, minor: t.fareMinor }, ...extras];
}

/** The choices a customer made at booking, read back from `details` for display. */
export function bookingExtras(details: unknown): BookingExtra[] {
  if (!details || typeof details !== "object") return [];
  const d = details as Record<string, unknown>;
  const out: BookingExtra[] = [];

  // Transfers: where from, where to, and when.
  const t = d.transfer && typeof d.transfer === "object" ? (d.transfer as Record<string, unknown>) : null;
  if (t) {
    const from = text(t.pickup);
    const to = text(t.dropoff);
    if (from && to) out.push({ key: "route", label: "Route", value: `${from} → ${to}` });
    const time = text(t.time);
    if (time) out.push({ key: "pickupTime", label: "Pickup time", value: time });
    const flight = text(t.flight);
    if (flight) out.push({ key: "flight", label: "Flight / train", value: flight });
    const vehicle = text(t.vehicle);
    if (vehicle) out.push({ key: "vehicle", label: "Vehicle", value: VEHICLE_LABELS[vehicle] ?? vehicle });
  }

  if (isResidency(d.residency)) {
    out.push({ key: "residency", label: "Residency", value: RESIDENCY_LABELS[d.residency] });
  }
  if (d.withDriver === true) {
    out.push({ key: "driver", label: "Driver", value: "With a driver" });
  }
  const traveller = text(d.leadTraveller);
  if (traveller) out.push({ key: "traveller", label: "Lead traveller", value: traveller });
  const phone = text(d.leadPhone);
  if (phone) out.push({ key: "phone", label: "Phone on the day", value: phone });
  return out;
}
