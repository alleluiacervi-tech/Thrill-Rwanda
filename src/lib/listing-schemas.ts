import { z } from "zod";

/**
 * Validation shared by the listing create and edit actions.
 *
 * In a plain module rather than beside the actions because a `"use server"`
 * file may only export async functions — exporting a schema object from one
 * is a build error.
 */

export type ListingState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; id: string; slug: string };

/**
 * Prices are entered in whole shillings and stored as minor units. Doing the
 * ×100 here — once, server-side — keeps the boundary in one place rather
 * than trusting a client to send cents.
 */
export const shillings = z.coerce
  .number({ message: "Enter a price" })
  .positive("Price must be more than zero")
  .max(10_000_000, "That price looks wrong")
  .transform((v) => Math.round(v * 100));

/** Same, but an empty field means "not set" rather than an error. */
export const optionalShillings = z
  .union([z.literal(""), shillings])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

/** Free-text list: one item per line, or comma-separated. */
export function toList(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
}

// Shared with the form's <select> so the options and the validation can't drift.
export const FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "Electric"] as const;

export const VEHICLE_CATEGORIES = [
  "4x4 Safari",
  "Executive Van",
  "Executive Sedan",
  "Compact SUV",
  "Minibus",
  "Pickup",
] as const;

// Suggestions only — the picker still accepts anything typed.
export const VEHICLE_FEATURES = [
  "4WD",
  "Air conditioning",
  "Pop-up roof",
  "Cooler box",
  "Unlimited km",
  "Leather",
  "Captain seats",
  "Wi-Fi",
  "Chauffeur",
  "Self-drive",
  "Airport meet",
  "Bottled water",
] as const;

export const vehicleSchema = z.object({
  make: z.string().trim().min(1, "Make is required").max(60),
  model: z.string().trim().min(1, "Model is required").max(60),
  year: z.coerce
    .number({ message: "Enter a year" })
    .int()
    .min(1990, "Year looks too old")
    .max(new Date().getFullYear() + 1, "Year is in the future"),
  category: z.enum(VEHICLE_CATEGORIES, { message: "Choose a category" }),
  seats: z.coerce.number().int().min(1, "At least one seat").max(60),
  transmission: z.enum(["Automatic", "Manual"]),
  fuelType: z.enum(FUEL_TYPES, { message: "Choose a fuel type" }),
  quantity: z.coerce
    .number({ message: "Enter how many you have" })
    .int()
    .min(1, "At least one vehicle")
    .max(200, "That's a lot of vehicles — contact us instead"),
  pricePerDay: shillings,
  // Blank means self-drive only; blank insurance means no stated liability.
  driverPerDay: optionalShillings,
  insuranceCharge: optionalShillings,
});

export const tourSchema = z.object({
  name: z.string().trim().min(3, "Give the tour a name").max(160),
  destination: z.string().trim().min(2, "Destination is required").max(80),
  durationDays: z.coerce
    .number({ message: "Enter a duration" })
    .int()
    .min(1, "At least one day")
    .max(60, "That's a long trip — contact us instead"),
  maxParticipants: z.coerce
    .number({ message: "Enter a group size" })
    .int()
    .min(1, "At least one seat")
    .max(200, "That's a big group — contact us instead"),
  price: shillings,
  // Blank means that tier pays the citizen rate.
  priceResident: optionalShillings,
  priceNonResident: optionalShillings,
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  pickupInfo: z.string().trim().max(500).optional().or(z.literal("")),
});

export const hotelSchema = z.object({
  name: z.string().trim().min(2, "Property name is required").max(160),
  location: z.string().trim().min(2, "Location is required").max(120),
  stars: z.coerce.number().int().min(1).max(5).optional(),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
});

export const roomSchema = z.object({
  name: z.string().trim().min(2, "Room name is required").max(120),
  capacity: z.coerce.number().int().min(1, "Sleeps at least one").max(30),
  quantity: z.coerce.number().int().min(1, "At least one room").max(500),
  price: shillings,
});


export function imageUrls(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => {
      if (s.startsWith("/api/uploads/")) return !s.includes("..");
      return /^https:\/\/\S+$/i.test(s);
    })
    .slice(0, 12);
}
