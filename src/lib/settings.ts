import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { DEFAULT_DEPOSIT_PERCENT } from "@/lib/deposit";
import { buildSite, type SiteInfo } from "@/lib/site-config";

export type SiteSettings = {
  depositPercent: number;
  /** Car hire damage terms. {amount} is replaced with the vehicle's own figure. */
  damageLiabilityText: string;
};

export const DEFAULT_DAMAGE_LIABILITY_TEXT =
  "I agree that in the event of damage to the hired vehicle, I will be liable for the applicable amount of {amount}, as specified for this vehicle.";

// One row, id 1. Falls back to the defaults rather than failing a page if the row or database is missing.
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const row = await db.siteSettings.findUnique({ where: { id: 1 } });
    return {
      depositPercent: row?.depositPercent ?? DEFAULT_DEPOSIT_PERCENT,
      damageLiabilityText: row?.damageLiabilityText || DEFAULT_DAMAGE_LIABILITY_TEXT,
    };
  } catch (err) {
    console.error("[settings] read failed, using defaults", err);
    return {
      depositPercent: DEFAULT_DEPOSIT_PERCENT,
      damageLiabilityText: DEFAULT_DAMAGE_LIABILITY_TEXT,
    };
  }
});

/** Puts the vehicle's figure into the admin's wording. */
export function damageLiabilityStatement(text: string, amount: string) {
  return text.includes("{amount}") ? text.replaceAll("{amount}", amount) : `${text} ${amount}`;
}

/* ------------------------------------------------- business details */

const SITE_TAG = "site-settings";

async function readSiteUncached(): Promise<SiteInfo> {
  try {
    return buildSite(await db.siteSettings.findUnique({ where: { id: 1 } }));
  } catch (err) {
    console.error("[settings] business details read failed, using defaults", err);
    return buildSite(null);
  }
}

// Cached across requests: every page shows the name and phone, so this mustn't cost a query each time.
const readSiteCached = unstable_cache(readSiteUncached, ["site-info"], {
  tags: [SITE_TAG],
  revalidate: 300,
});

/**
 * The Next data cache exists only inside a request. Seeds, scripts and tests
 * call the booking engine too, and there unstable_cache throws
 * ("incrementalCache missing"); they get a direct read instead.
 */
async function readSite(): Promise<SiteInfo> {
  try {
    return await readSiteCached();
  } catch {
    return readSiteUncached();
  }
}

/** The business name, contacts, rules and payment switches, as the admin set them. */
export const getSite = cache(readSite);

/** After a save: every page picks up the new details straight away. */
export function refreshSite() {
  revalidateTag(SITE_TAG, { expire: 0 });
}

/** Whether this kind of booking is paid online right now: hotels never, the rest as the admin set. */
export async function paysOnline(serviceType: string) {
  if (serviceType === "ROOM") return false;
  const { payOnline } = await getSite();
  return payOnline[serviceType as keyof typeof payOnline] ?? false;
}
