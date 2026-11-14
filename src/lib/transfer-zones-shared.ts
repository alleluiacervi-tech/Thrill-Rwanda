import { z } from "zod";

/**
 * Zone pricing for transfers, shared by the booking form (browser) and the
 * server. Nothing here may import the database, or it ships to the client.
 *
 * A trip is a pickup point (Kigali airport, a bus terminal, a lake or
 * volcano town, or "between towns") plus an area from that point's price table. The price is fixed per
 * vehicle, the same in either direction, with two surcharges on top.
 */

export const TRANSFER_ORIGINS = ["KIGALI", "MUSANZE", "RUBAVU", "BETWEEN_TOWNS"] as const;
export type TransferOriginValue = (typeof TRANSFER_ORIGINS)[number];

/** How each price table reads in the admin. */
export const ORIGIN_LABEL: Record<TransferOriginValue, string> = {
  KIGALI: "Kigali — from Kigali Airport / Nyabugogo",
  MUSANZE: "Musanze — from Volcanoes town",
  RUBAVU: "Rubavu — from Lake Kivu",
  BETWEEN_TOWNS: "Between towns",
};

export type Region = "KIGALI" | "HIGHLANDS";
export const REGION_LABEL: Record<Region, string> = { KIGALI: "Kigali", HIGHLANDS: "Volcanoes & Lake Kivu" };

export type PickupPoint = {
  key: string;
  label: string;
  /** Short name for summaries: "Kigali Airport → Kiyovu". */
  short: string;
  region: Region;
  table: TransferOriginValue;
  /** Flat charge when collected here, e.g. terminal parking. */
  pickupFeeMinor?: number;
  pickupFeeLabel?: string;
  /** The "areas" are whole routes, so there is no direction to choose. */
  pointToPoint?: boolean;
};

export const PICKUP_POINTS: PickupPoint[] = [
  { key: "KGL", label: "Kigali International Airport (KGL)", short: "Kigali Airport", region: "KIGALI", table: "KIGALI" },
  {
    key: "NYABUGOGO",
    label: "Nyabugogo Bus Terminal, Kigali",
    short: "Nyabugogo",
    region: "KIGALI",
    table: "KIGALI",
    pickupFeeMinor: 500,
    pickupFeeLabel: "Terminal parking",
  },
  { key: "MUSANZE", label: "Musanze town (Volcanoes National Park)", short: "Musanze", region: "HIGHLANDS", table: "MUSANZE" },
  { key: "RUBAVU", label: "Rubavu / Gisenyi (Lake Kivu)", short: "Rubavu", region: "HIGHLANDS", table: "RUBAVU" },
  { key: "TOWNS", label: "Between towns", short: "Towns", region: "HIGHLANDS", table: "BETWEEN_TOWNS", pointToPoint: true },
];

export const pickupPoint = (key: string) => PICKUP_POINTS.find((p) => p.key === key) ?? null;

export const VEHICLES = [
  { key: "sedan", label: "Sedan", seats: 4, note: "Up to 4 passengers" },
  { key: "van", label: "Van", seats: 7, note: "7-seater" },
  { key: "premium", label: "Prado / Alphard", seats: 4, note: "Premium, up to 4" },
] as const;
export type VehicleKey = (typeof VEHICLES)[number]["key"];
export const vehicle = (key: string) => VEHICLES.find((v) => v.key === key) ?? null;

/** Night fee: 9pm to 5am, 15% on the fare. */
export const NIGHT_FROM_HOUR = 21;
export const NIGHT_TO_HOUR = 5;
export const NIGHT_PERCENT = 15;

export function isNight(time: string) {
  const hour = Number(time.slice(0, 2));
  return hour >= NIGHT_FROM_HOUR || hour < NIGHT_TO_HOUR;
}

/** A zone as the booking form needs it. */
export type PublicZone = {
  id: string;
  origin: TransferOriginValue;
  name: string;
  areas: string[];
  distance: string | null;
  sedanMinor: number;
  vanMinor: number;
  premiumMinor: number;
};

/** "Kiyovu, Kacyiru" → ["Kiyovu", "Kacyiru"]. */
export const splitAreas = (areas: string) =>
  areas
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

export const fareFor = (zone: Pick<PublicZone, "sedanMinor" | "vanMinor" | "premiumMinor">, v: VehicleKey) =>
  v === "van" ? zone.vanMinor : v === "premium" ? zone.premiumMinor : zone.sedanMinor;

export type ZoneQuote = {
  fareMinor: number;
  extras: { label: string; minor: number }[];
  totalMinor: number;
};

/**
 * The price of one trip. The fee for collecting at a terminus only applies
 * when the trip starts there; the night fee is rounded up to whole hundreds.
 */
export function quoteZoneTrip(input: {
  zone: Pick<PublicZone, "sedanMinor" | "vanMinor" | "premiumMinor">;
  vehicle: VehicleKey;
  point: PickupPoint;
  /** True when the customer is collected at the pickup point, false when dropped there. */
  fromPoint: boolean;
  time: string;
}): ZoneQuote {
  const fareMinor = fareFor(input.zone, input.vehicle);
  const extras: ZoneQuote["extras"] = [];
  if (input.fromPoint && input.point.pickupFeeMinor) {
    extras.push({ label: input.point.pickupFeeLabel ?? "Pickup fee", minor: input.point.pickupFeeMinor });
  }
  if (isNight(input.time)) {
    const raw = (fareMinor * NIGHT_PERCENT) / 100;
    extras.push({ label: `Night fee (9pm–5am, +${NIGHT_PERCENT}%)`, minor: Math.ceil(raw / 10_000) * 10_000 });
  }
  return { fareMinor, extras, totalMinor: fareMinor + extras.reduce((s, e) => s + e.minor, 0) };
}

/** Who is collected where. Between coast towns the "area" is the whole route ("Nyali ↔ Diani"); "to" runs it backwards. */
export function tripEnds(point: PickupPoint, area: string, fromPoint: boolean): [string, string] {
  if (point.pointToPoint) {
    const [a = area, b = area] = area.split("↔").map((s) => s.trim());
    return fromPoint ? [a, b] : [b, a];
  }
  return fromPoint ? [point.label, area] : [area, point.label];
}

/** Zones sharing a name and table, in order: "Zone A" from Moi is several rows at different prices. */
export function groupZones(zones: PublicZone[]) {
  const groups: { name: string; origin: TransferOriginValue; zones: PublicZone[] }[] = [];
  for (const z of zones) {
    const last = groups.at(-1);
    if (last && last.name === z.name && last.origin === z.origin) last.zones.push(z);
    else groups.push({ name: z.name, origin: z.origin, zones: [z] });
  }
  return groups;
}

/** Vehicles big enough for the group, smallest first. */
export const vehiclesFor = (passengers: number) => VEHICLES.filter((v) => v.seats >= passengers);

/* ------------------------------------------------------------ admin form */

export const transferZoneSchema = z.object({
  origin: z.enum(TRANSFER_ORIGINS),
  name: z.string().trim().min(2, "Name the zone, e.g. Zone 2 · Central Kigali").max(80),
  areas: z
    .string()
    .trim()
    .min(2, "List at least one area")
    .max(2000)
    .refine((a) => splitAreas(a).length > 0, "List at least one area"),
  distance: z.string().trim().max(40).optional().or(z.literal("")),
  // Whole shillings in the form, stored as cents.
  sedan: z.coerce.number().int("Whole shillings only.").min(1, "Enter a price.").max(1_000_000, "That price looks too high."),
  van: z.coerce.number().int("Whole shillings only.").min(1, "Enter a price.").max(1_000_000, "That price looks too high."),
  premium: z.coerce.number().int("Whole shillings only.").min(1, "Enter a price.").max(1_000_000, "That price looks too high."),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean(),
});

export type TransferZoneState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<keyof z.infer<typeof transferZoneSchema>, string>>;
      /** What was submitted. React resets a form after every action, so the form refills from this. */
      values?: Record<string, string>;
      /** Changes on every failed save, so the form remounts and even a <select> refills. */
      attempt?: number;
    }
  | { status: "success" };
