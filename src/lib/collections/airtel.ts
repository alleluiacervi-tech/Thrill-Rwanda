import { z } from "zod";
import { airtelClient, AIRTEL_COUNTRY, AIRTEL_CURRENCY } from "./airtel-client";
import { paymentOrigin } from "./urubuto";
import type { Gateway } from "./registry";
import type { CollectionProvider, ProviderPayment } from "./provider";
import { payerPhone, rwfInteger } from "./rules";

type Environment = Record<string, string | undefined>;

export const AIRTEL_LIVE_BASE = "https://openapi.airtel.africa";
export const AIRTEL_UAT_BASE = "https://openapiuat.airtel.africa";

/** Airtel Rwanda numbers only (072 and 073 prefixes); MTN numbers must not be sent to Airtel. */
export function airtelWallet(raw: string) {
  const phone = payerPhone(raw, "AIRTEL_MONEY");
  return phone && /^2507[23]/.test(phone) ? phone : null;
}

/**
 * The id Airtel stores for a collection: the attempt's UUID without dashes, so it stays
 * unique and within Airtel's partner id length, and maps back to the attempt exactly.
 */
export const airtelTransactionId = (reference: string) => reference.replaceAll("-", "").toLowerCase();
export function referenceFromAirtelId(id: string) {
  const hex = id.trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const accepted = z.object({
  status: z.object({ success: z.boolean(), response_code: z.string().optional(), message: z.string().optional() }),
});
const enquiry = z.object({
  data: z.object({
    transaction: z.object({
      id: z.union([z.string(), z.number()]).transform(String),
      // TS success · TF failed · TE expired · TIP in progress · TA ambiguous (keep checking)
      status: z.string(),
      airtel_money_id: z.union([z.string(), z.number()]).transform(String).optional().nullable(),
      message: z.string().optional().nullable(),
    }).nullable().optional(),
  }).nullable().optional(),
  status: z.object({ success: z.boolean().optional(), response_code: z.string().optional() }).optional(),
});

type AirtelConfig = { base: string; clientId: string; clientSecret: string; environment: "live" | "staging" };

function adapter(config: AirtelConfig): CollectionProvider {
  const request = airtelClient(config);
  function validate(input: ProviderPayment) {
    if (!z.uuid().safeParse(input.reference).success || input.method !== "AIRTEL_MONEY" ||
      input.currency !== AIRTEL_CURRENCY || !rwfInteger(input.amountMinor)) {
      throw new Error("Airtel collections require a UUID reference, a whole RWF amount and Airtel Money");
    }
  }
  return {
    id: "AIRTEL_DIRECT",
    environment: config.environment,
    merchantCode: config.clientId,
    serviceCode: "COLLECTIONS",
    getCapabilities: () => ({ methods: ["AIRTEL_MONEY"], currencies: [AIRTEL_CURRENCY], refunds: false, automatedSettlements: false }),
    acceptsPhone: (phone) => !!airtelWallet(phone),
    phoneHint: "Enter an Airtel Money number (it starts with 072 or 073).",
    async createPayment(input) {
      validate(input);
      const phone = airtelWallet(input.phone);
      if (!phone) throw new Error("Enter an Airtel Rwanda number");
      // Airtel takes the subscriber number without the country code.
      const response = await request("/merchant/v1/payments/", {
        reference: "Thrill Rwanda",
        subscriber: { country: AIRTEL_COUNTRY, currency: AIRTEL_CURRENCY, msisdn: phone.slice(3) },
        transaction: { amount: input.amountMinor, country: AIRTEL_COUNTRY, currency: AIRTEL_CURRENCY, id: airtelTransactionId(input.reference) },
      });
      const reply = accepted.safeParse(await response.json().catch(() => null));
      if (!response.ok || !reply.success || !reply.data.status.success) throw new Error("Airtel did not accept the payment request");
      return { providerReference: input.reference };
    },
    async verifyPayment(input) {
      validate(input);
      const id = airtelTransactionId(input.reference);
      const response = await request(`/standard/v1/payments/${id}`);
      if (response.status === 404) return { state: "missing" };
      if (!response.ok) throw new Error("Airtel status unavailable");
      const parsed = enquiry.safeParse(await response.json().catch(() => null));
      if (!parsed.success) throw new Error("Airtel status unreadable");
      const transaction = parsed.data.data?.transaction;
      if (!transaction) return { state: "missing" };
      // The enquiry does not echo the amount; the id we issued ties it to this exact request.
      if (transaction.id.toLowerCase() !== id) return { state: "mismatch" };
      const code = transaction.status.toUpperCase();
      if (code === "TS") {
        return transaction.airtel_money_id ? { state: "paid", providerReference: input.reference } : { state: "mismatch" };
      }
      if (code === "TF" || code === "TE") return { state: "failed", providerReference: input.reference };
      return { state: "pending", providerReference: input.reference };
    },
  };
}

function liveConfiguration(env: Environment): AirtelConfig | null {
  const base = (env.AIRTEL_BASE_URL?.trim() || AIRTEL_LIVE_BASE).replace(/\/+$/, "");
  const clientId = env.AIRTEL_CLIENT_ID?.trim();
  const clientSecret = env.AIRTEL_CLIENT_SECRET?.trim();
  if (env.AIRTEL_ENABLED !== "true" || env.AIRTEL_LIVE_APPROVED !== "true" || env.APP_ENV !== "production" ||
    (env.VERCEL_ENV && env.VERCEL_ENV !== "production") || !clientId || !clientSecret) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      /uat|sandbox|staging|localhost|127\.0\.0\.1/i.test(url.hostname)) return null;
  } catch { return null; }
  return { base, clientId, clientSecret, environment: "live" };
}

/** Live Airtel Rwanda Collections (official Open API, no intermediary). Offers Airtel Money in RWF only. */
export function getAirtelLiveGateway(env: Environment = process.env): Gateway | null {
  const config = liveConfiguration(env);
  if (!config) return null;
  const min = rwfInteger(env.AIRTEL_MIN_RWF);
  const max = rwfInteger(env.AIRTEL_MAX_RWF);
  const origin = paymentOrigin(env);
  const enabled = !!origin && !!min && !!max && max >= min;
  return {
    provider: adapter(config), enabled, origin,
    eligible: (currency, amount) => enabled && currency === AIRTEL_CURRENCY && Number.isSafeInteger(amount) && amount >= min! && amount <= max! ? ["AIRTEL_MONEY"] : [],
  };
}

/**
 * Airtel UAT (test) adapter, for trying the integration with Airtel's test credentials.
 * Customer routing never selects it; scripts/airtel-sandbox-check.ts drives it.
 */
export function airtelSandboxProvider(env: Environment = process.env): CollectionProvider | null {
  const clientId = env.AIRTEL_SANDBOX_CLIENT_ID?.trim();
  const clientSecret = env.AIRTEL_SANDBOX_CLIENT_SECRET?.trim();
  if (env.AIRTEL_SANDBOX_ENABLED !== "true" || env.VERCEL_ENV === "production" ||
    !["development", "staging", "test"].includes(env.APP_ENV ?? "") || !clientId || !clientSecret) return null;
  return adapter({ base: AIRTEL_UAT_BASE, clientId, clientSecret, environment: "staging" });
}
