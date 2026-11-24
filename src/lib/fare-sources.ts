/**
 * Where the public flights board gets its prices. The admin picks one in
 * Admin → Fares; the keys stay in the server environment. Pure: safe to use
 * from the admin page and the tests.
 */
import { duffelAvailability } from "@/lib/duffel/config";

export const FARE_SOURCES = ["off", "duffel", "skyscanner"] as const;
export type FareSource = (typeof FARE_SOURCES)[number];

export const isFareSource = (value: unknown): value is FareSource => FARE_SOURCES.includes(value as FareSource);

export const FARE_SOURCE_LABEL: Record<FareSource, string> = {
  off: "Off",
  duffel: "Duffel",
  skyscanner: "Skyscanner",
};

export type SourceReadiness = { ok: true } | { ok: false; reason: string };

/** Whether a source can run on this server, and if not, what is missing, in words the admin can act on. */
export function sourceReadiness(source: FareSource, env: Record<string, string | undefined> = process.env): SourceReadiness {
  if (source === "off") return { ok: true };
  if (source === "skyscanner") {
    return env.SKYSCANNER_API_KEY?.trim()
      ? { ok: true }
      : { ok: false, reason: "Needs SKYSCANNER_API_KEY in the server settings, from the Skyscanner partner programme." };
  }
  const duffel = duffelAvailability(env);
  if (!duffel.ok) {
    return duffel.reason === "missing"
      ? { ok: false, reason: "Needs a live DUFFEL_ACCESS_TOKEN in the server settings." }
      : { ok: false, reason: "A live Duffel token is set; it also needs DUFFEL_ALLOW_LIVE=true." };
  }
  // Duffel's sandbox invents its fares: never on a public page.
  if (duffel.config.mode !== "live") return { ok: false, reason: "The Duffel token is a test token. Test fares are never shown publicly." };
  return { ok: true };
}
