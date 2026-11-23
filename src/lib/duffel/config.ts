/**
 * Duffel flight API credentials.
 *
 * The access token lives only in the host's environment: it never reaches the
 * browser and is never logged. A Duffel token is either a test token (sandbox
 * data, no real tickets, no real money) or a live one. A live token is refused
 * unless DUFFEL_ALLOW_LIVE=true is also set, so a pasted production key cannot
 * quietly start spending a real balance.
 */
export type DuffelMode = "sandbox" | "live";

export type DuffelConfig = {
  token: string;
  baseUrl: string;
  mode: DuffelMode;
};

export type DuffelAvailability =
  | { ok: true; config: DuffelConfig }
  | { ok: false; reason: "missing" | "live-blocked"; message: string };

export function duffelAvailability(env: Record<string, string | undefined> = process.env): DuffelAvailability {
  const token = env.DUFFEL_ACCESS_TOKEN?.trim();
  if (!token) {
    return { ok: false, reason: "missing", message: "Duffel is not connected. Set DUFFEL_ACCESS_TOKEN to a test token." };
  }
  // Duffel's own convention: test tokens start duffel_test_, live ones duffel_live_.
  const mode: DuffelMode = token.startsWith("duffel_test_") ? "sandbox" : "live";
  if (mode === "live" && env.DUFFEL_ALLOW_LIVE !== "true") {
    return {
      ok: false,
      reason: "live-blocked",
      message: "A live Duffel token is set but live booking is not enabled. Use a test token, or set DUFFEL_ALLOW_LIVE=true deliberately.",
    };
  }
  return { ok: true, config: { token, baseUrl: env.DUFFEL_API_URL?.trim() || "https://api.duffel.com", mode } };
}
