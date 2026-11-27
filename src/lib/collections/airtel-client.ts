import { z } from "zod";

// Airtel Africa Open API, which Airtel Rwanda uses: https://developers.airtel.co.rw/
// OAuth 2.0 client credentials; every call names the market with X-Country / X-Currency.
const tokenSchema = z.object({
  access_token: z.string().min(1),
  // Airtel returns the lifetime in seconds, as a string ("180") or a number.
  expires_in: z.coerce.number().int().positive(),
});

export type AirtelClientConfig = {
  /** API root without a trailing slash: https://openapi.airtel.africa (live) or https://openapiuat.airtel.africa (UAT). */
  base: string;
  clientId: string;
  clientSecret: string;
};

export const AIRTEL_COUNTRY = "RW";
export const AIRTEL_CURRENCY = "RWF";

/** Authenticated Airtel Open API requests with a cached, single-flight access token and one retry on 401. */
export function airtelClient(config: AirtelClientConfig) {
  let token: { value: string; expiry: number } | undefined;
  let renewal: Promise<string> | undefined;

  async function accessToken() {
    if (token && token.expiry > Date.now()) return token.value;
    if (!renewal) renewal = (async () => {
      const reply = await fetch(`${config.base}/auth/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, grant_type: "client_credentials" }),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(7_000),
      });
      if (!reply.ok) throw new Error("Airtel access token unavailable");
      const item = tokenSchema.parse(await reply.json());
      // Renew a little early: Airtel tokens are short-lived (minutes, not hours).
      token = { value: item.access_token, expiry: Date.now() + Math.max(1, item.expires_in - 15) * 1000 };
      return token.value;
    })().finally(() => { renewal = undefined; });
    return renewal;
  }

  return async function request(path: string, body?: object) {
    const call = async () => fetch(config.base + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        Accept: "*/*",
        "X-Country": AIRTEL_COUNTRY,
        "X-Currency": AIRTEL_CURRENCY,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    const first = await call();
    if (first.status !== 401) return first;
    token = undefined;
    return call();
  };
}
