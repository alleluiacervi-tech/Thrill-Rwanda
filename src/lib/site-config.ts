import { defaultPublications, type Publications } from "@/lib/launch-rules";
/**
 * The business details the whole site shows, built from the admin's settings.
 *
 * No database code here, so client components can share the type. Every field
 * falls back to the built-in value when the admin leaves it empty, so a blank
 * settings row looks exactly like the site always did.
 */

export type SocialKey = "facebook" | "instagram" | "tiktok" | "x" | "youtube";

export type SiteInfo = {
  publications: Publications;
  name: string;
  legalName: string;
  tagline: string;
  /** The homepage headline, big line then the smaller orange line. */
  heroTitle: string;
  heroSubtitle: string;
  /** The paragraph under the homepage headline. */
  heroText: string;
  /** Shown when the link is shared, in search results and in the footer. */
  description: string;
  contact: {
    phone: string;
    phoneHref: string;
    phoneAlt: string | null;
    phoneAltHref: string | null;
    /** A wa.me link, ready for ?text=. */
    whatsapp: string;
    /** The WhatsApp number as people read it. */
    whatsappNumber: string;
    email: string;
    address: string;
    hours: string | null;
  };
  socials: { key: SocialKey; label: string; url: string }[];
  rules: { holdMinutes: number; maxPassengers: number; minNoticeDays: number };
  /** Hotels are never paid online; these switch the rest. */
  payOnline: { TOUR: boolean; VEHICLE: boolean; TRANSFER: boolean };
  announcement: string | null;
  /** Whether the homepage hero plays video, or shows still frames only. */
  heroVideo: boolean;
};

/** The values the site shipped with. */
export const SITE_DEFAULTS = {
  name: "Thrill Rwanda",
  legalName: "Thrill Rwanda",
  tagline: "Rwanda's volcanic peaks, forests and savannahs.",
  phone: "+250 786 261 104",
  phoneAlt: null,
  whatsapp: "+250 786 261 104",
  email: "contact@thrillrwanda.com",
  address: "Kigali, Rwanda",
  heroTitle: "Your journey starts",
  heroSubtitle: "with a conversation.",
  holdMinutes: 60,
  maxPassengers: 6,
  minNoticeDays: 0,
} as const;

/** The settings row, or the part of it this needs. */
export type SiteSettingsRow = Partial<{
  brandName: string | null;
  legalName: string | null;
  tagline: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroText: string | null;
  phone: string | null;
  phoneAlt: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  openingHours: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  xUrl: string | null;
  youtubeUrl: string | null;
  holdMinutes: number;
  transferMaxPassengers: number;
  minNoticeDays: number;
  payOnlineTours: boolean;
  payOnlineCars: boolean;
  payOnlineTransfers: boolean;
  announcement: string | null;
  announcementOn: boolean;
  heroVideo: boolean;
}>;

const text = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** What the homepage said before the paragraph was editable: the tagline plus the booking promise. */
export const defaultHeroText = (tagline: string) =>
  `${tagline} Tell us your plans. Prices, availability and confirmation follow staff and supplier checks.`;

/** The client's description, with the registered name the admin set. */
export const describe = (legalName: string) =>
  `Request a checked flight quotation or plan your Rwanda trip with ${legalName}. Stays, transport and group travel start with your brief.`;

/** Digits only, with Rwanda's 250 in front of a local 0… number. */
export function phoneDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `250${digits.slice(1)}` : digits;
}

export const telHref = (phone: string) => `tel:+${phoneDigits(phone)}`;
export const whatsappLink = (phone: string) => `https://wa.me/${phoneDigits(phone)}`;

const SOCIALS: { key: SocialKey; label: string; field: keyof SiteSettingsRow }[] = [
  { key: "facebook", label: "Facebook", field: "facebookUrl" },
  { key: "instagram", label: "Instagram", field: "instagramUrl" },
  { key: "tiktok", label: "TikTok", field: "tiktokUrl" },
  { key: "x", label: "X", field: "xUrl" },
  { key: "youtube", label: "YouTube", field: "youtubeUrl" },
];

export function buildSite(row: SiteSettingsRow | null | undefined): SiteInfo {
  const r = row ?? {};
  const phone = text(r.phone) ?? SITE_DEFAULTS.phone;
  // An admin who changes the main number but leaves the second blank gets no second number.
  const phoneAlt = text(r.phoneAlt) ?? (text(r.phone) ? null : SITE_DEFAULTS.phoneAlt);
  const whatsapp = text(r.whatsapp) ?? text(r.phone) ?? SITE_DEFAULTS.whatsapp;

  return {
    publications: defaultPublications(),
    name: text(r.brandName) ?? SITE_DEFAULTS.name,
    legalName: text(r.legalName) ?? SITE_DEFAULTS.legalName,
    tagline: text(r.tagline) ?? SITE_DEFAULTS.tagline,
    heroTitle: text(r.heroTitle) ?? SITE_DEFAULTS.heroTitle,
    heroSubtitle: text(r.heroSubtitle) ?? SITE_DEFAULTS.heroSubtitle,
    heroText: text(r.heroText) ?? defaultHeroText(text(r.tagline) ?? SITE_DEFAULTS.tagline),
    description: describe(text(r.legalName) ?? SITE_DEFAULTS.legalName),
    contact: {
      phone,
      phoneHref: phone ? telHref(phone) : "",
      phoneAlt,
      phoneAltHref: phoneAlt ? telHref(phoneAlt) : null,
      whatsapp: whatsapp ? whatsappLink(whatsapp) : "",
      whatsappNumber: whatsapp,
      email: text(r.email) ?? SITE_DEFAULTS.email,
      address: text(r.address) ?? SITE_DEFAULTS.address,
      hours: text(r.openingHours),
    },
    socials: SOCIALS.flatMap((s) => {
      const url = text(r[s.field] as string | null | undefined);
      return url ? [{ key: s.key, label: s.label, url }] : [];
    }),
    rules: {
      holdMinutes: r.holdMinutes ?? SITE_DEFAULTS.holdMinutes,
      maxPassengers: r.transferMaxPassengers ?? SITE_DEFAULTS.maxPassengers,
      minNoticeDays: r.minNoticeDays ?? SITE_DEFAULTS.minNoticeDays,
    },
    payOnline: {
      TOUR: r.payOnlineTours ?? true,
      VEHICLE: r.payOnlineCars ?? true,
      TRANSFER: r.payOnlineTransfers ?? true,
    },
    announcement: r.announcementOn ? text(r.announcement) : null,
    heroVideo: r.heroVideo ?? true,
  };
}
