"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { refreshPublicCatalogue } from "@/lib/catalogue";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { refreshSite } from "@/lib/settings";
import { phoneDigits } from "@/lib/site-config";

export type SettingsState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "saved"; depositPercent: number };

// A blank field means "use the built-in value", so it's stored as null.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters.`)
    .transform((v) => v || null);

const optionalPhone = (label: string) =>
  optionalText(30).refine((v) => !v || phoneDigits(v).length >= 9, {
    message: `${label} doesn't look like a phone number.`,
  });

const optionalUrl = (label: string) =>
  optionalText(300).refine((v) => !v || /^https:\/\/[^\s]+\.[^\s]+$/.test(v), {
    message: `${label} must be a full link starting with https://`,
  });

const checkbox = z.literal("on").optional().transform((v) => v === "on");

const schema = z.object({
  depositPercent: z.coerce
    .number()
    .int("Use a whole number.")
    .min(1, "The deposit must be at least 1%.")
    .max(100, "100% means payment in full; it can't be more."),
  // {amount} is filled in with each vehicle's own liability figure.
  damageLiabilityText: z
    .string()
    .trim()
    .min(20, "Write the full statement customers will agree to.")
    .max(2000, "That is too long for a checkout statement.")
    .refine((v) => v.includes("{amount}"), {
      message: "Include {amount} where the vehicle's figure should appear.",
    }),

  brandName: optionalText(60),
  legalName: optionalText(120),
  tagline: optionalText(160),
  heroTitle: optionalText(40),
  heroSubtitle: optionalText(60),
  heroText: optionalText(400),
  phone: optionalPhone("The main phone"),
  phoneAlt: optionalPhone("The second phone"),
  whatsapp: optionalPhone("The WhatsApp number"),
  email: optionalText(120).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: "The email address doesn't look right.",
  }),
  address: optionalText(200),
  openingHours: optionalText(120),

  facebookUrl: optionalUrl("Facebook"),
  instagramUrl: optionalUrl("Instagram"),
  tiktokUrl: optionalUrl("TikTok"),
  xUrl: optionalUrl("X"),
  youtubeUrl: optionalUrl("YouTube"),

  holdMinutes: z.coerce.number().int().min(15, "Hold dates for at least 15 minutes.").max(1440, "At most 24 hours (1440 minutes)."),
  transferMaxPassengers: z.coerce.number().int().min(1).max(40, "At most 40 passengers."),
  minNoticeDays: z.coerce.number().int().min(0).max(60, "At most 60 days' notice."),

  payOnlineTours: checkbox,
  payOnlineCars: checkbox,
  payOnlineTransfers: checkbox,

  announcement: optionalText(200),
  announcementOn: checkbox,
});

const FIELDS = Object.keys(schema.shape) as (keyof typeof schema.shape)[];

export async function updateSiteSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireAdmin();
  // Unticked boxes are absent from the form, so they read as undefined → false.
  const parsed = schema.safeParse(
    Object.fromEntries(FIELDS.map((k) => [k, formData.get(k) ?? undefined])),
  );
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the values." };

  if (parsed.data.announcementOn && !parsed.data.announcement) {
    return { status: "error", message: "Write the announcement before switching it on." };
  }

  await db.siteSettings.upsert({
    where: { id: 1 },
    update: parsed.data,
    create: { id: 1, ...parsed.data },
  });

  // Every page shows the name, phone and announcement, so all of them refresh.
  refreshSite();
  refreshPublicCatalogue();
  revalidatePath("/", "layout");
  return { status: "saved", depositPercent: parsed.data.depositPercent };
}
