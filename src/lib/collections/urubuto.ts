import { z } from "zod";
import { COLLECTION_METHODS, payerPhone, rwfInteger, type CollectionMethod } from "./rules";
import type { CollectionProvider } from "./provider";

const reference = z.string().trim().min(1).max(160);
const configText = z.string().trim().min(1).max(160);
const envelope = z.object({ status: z.literal(200), data: z.unknown() });
const initiation = z.object({
  internal_transaction_ref_number: reference,
  external_transaction_ref_number: reference,
  card_processing_url: z.string().optional(),
  currency: z.literal("RWF"),
});
const status = z.object({
  transaction_status: z.enum(["INITIATED", "PENDING", "PENDING_SETTLEMENT", "VALID", "FAILED"]),
  transaction_id: reference,
  internal_transaction_id: reference,
  payer_code: reference,
  merchant_code: reference,
  service_code: reference,
  payment_channel: z.string(),
  payment_channel_name: z.string(),
  currency: z.string(),
  amount: z.unknown(),
});

type Environment = Record<string, string | undefined>;

export function paymentOrigin(env: Environment = process.env) {
  try {
    const url = new URL(env.PAYMENT_PUBLIC_ORIGIN || env.NEXT_PUBLIC_SITE_URL || "");
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.username || url.password || (url.protocol !== "https:" && !(local && env.APP_ENV === "development"))) return null;
    return url.origin;
  } catch { return null; }
}

export function urubutoWebhookConfig(env: Environment = process.env) {
  const username = env.URUBUTOPAY_WEBHOOK_USERNAME;
  const password = env.URUBUTOPAY_WEBHOOK_PASSWORD;
  const secret = env.URUBUTOPAY_WEBHOOK_SECRET;
  return username && username.length <= 160 && password && password.length >= 24 && password.length <= 256 && secret && secret.length >= 32 && secret !== password
    ? { username, password, secret }
    : null;
}

function credentials(env: Environment) {
  const environment = env.URUBUTOPAY_ENVIRONMENT;
  const appEnv = env.APP_ENV;
  const key = env.URUBUTOPAY_API_KEY?.trim();
  const merchantCode = configText.safeParse(env.URUBUTOPAY_MERCHANT_CODE);
  const serviceCode = configText.safeParse(env.URUBUTOPAY_SERVICE_CODE);
  if (!key || !merchantCode.success || !serviceCode.success) return null;
  if (environment === "live") {
    if (appEnv !== "production" || (env.VERCEL_ENV && env.VERCEL_ENV !== "production") || key.startsWith("upg:test_")) return null;
  } else if (environment !== "staging" || env.VERCEL_ENV === "production" || !["development", "test", "staging"].includes(appEnv ?? "") || !key.startsWith("upg:test_")) {
    return null;
  }
  const origin = environment === "live" ? "https://urubutopay.rw" : "https://staging.urubutopay.rw";
  return { environment, key, origin, merchantCode: merchantCode.data, serviceCode: serviceCode.data };
}

export function getUrubutoProvider(env: Environment = process.env) {
  const config = credentials(env);
  if (!config) return null;
  const selected = env.URUBUTOPAY_APPROVED_METHODS?.split(",").map((m) => m.trim()) ?? [];
  const methods = COLLECTION_METHODS.filter((method) => selected.includes(method));
  const max = rwfInteger(env.URUBUTOPAY_MAX_RWF);
  const min = rwfInteger(env.URUBUTOPAY_MIN_RWF);
  const origin = paymentOrigin(env);
  const enabled = env.URUBUTOPAY_ENABLED === "true" && !!origin && !!urubutoWebhookConfig(env) &&
    !!min && !!max && max >= min && methods.length > 0 &&
    (config.environment !== "live" || (env.URUBUTOPAY_LIVE_APPROVED === "true" && origin.startsWith("https:")));
  const eligible = (currency: string, amount: number) =>
    enabled && currency === "RWF" && Number.isSafeInteger(amount) && amount >= min! && amount <= max!
      ? methods.filter((method) => method === "CARD" || amount >= 5)
      : [];
  return { provider: adapter(config, methods), enabled, origin, eligible };
}

type Credentials = NonNullable<ReturnType<typeof credentials>>;
function adapter(config: Credentials, methods: readonly CollectionMethod[]): CollectionProvider {
  async function request(path: string, data: object) {
    return fetch(`${config.origin}/api/v2/payment/${path}`, {
      method: "POST",
      headers: { Authorization: config.key, "Content-Type": "application/json" },
      body: JSON.stringify(data),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(7_000),
    });
  }
  return {
    id: "URUBUTOPAY",
    environment: config.environment,
    merchantCode: config.merchantCode,
    serviceCode: config.serviceCode,
    getCapabilities: () => ({ methods, currencies: ["RWF"], refunds: false, automatedSettlements: false }),
    async createPayment(payment) {
      const phone = payerPhone(payment.phone, payment.method);
      if (!phone || payment.currency !== "RWF" || !rwfInteger(payment.amountMinor) || !methods.includes(payment.method) ||
        (payment.method !== "CARD" && payment.amountMinor < 5)) throw new Error("Invalid collection request");
      const response = await request("initiate", {
        merchant_code: config.merchantCode,
        service_code: config.serviceCode,
        payer_code: payment.reference,
        payer_names: payment.name,
        payer_email: payment.email,
        amount: payment.amountMinor,
        channel_name: payment.method,
        phone_number: phone,
        transaction_id: payment.reference,
        ...(payment.method === "CARD" ? { redirection_url: payment.returnUrl } : {}),
      });
      if (!response.ok) throw new Error("Could not confirm gateway initiation");
      const data = initiation.parse(envelope.parse(await response.json()).data);
      if (data.external_transaction_ref_number !== payment.reference) throw new Error("Initiation reference mismatch");
      if (payment.method !== "CARD") return { providerReference: data.internal_transaction_ref_number };
      const hosted = new URL(data.card_processing_url ?? "");
      if (hosted.origin !== config.origin || hosted.username || hosted.password || !/^\/card\/process\/[^/]+$/.test(hosted.pathname)) throw new Error("Invalid hosted checkout address");
      return { providerReference: data.internal_transaction_ref_number, hostedUrl: hosted.href };
    },
    async verifyPayment(payment) {
      const response = await request("transaction/status", { merchant_code: config.merchantCode, transaction_id: payment.reference });
      if (response.status === 404) return { state: "missing" };
      if (!response.ok) throw new Error("Gateway status unavailable");
      const data = status.parse(envelope.parse(await response.json()).data);
      const matchChannel = payment.method === "CARD" ? data.payment_channel === "CARD" : data.payment_channel_name === payment.method;
      if (data.transaction_id !== payment.reference || data.payer_code !== payment.reference ||
        data.service_code !== config.serviceCode || data.merchant_code !== config.merchantCode ||
        data.currency !== payment.currency || rwfInteger(data.amount) !== payment.amountMinor || !matchChannel) {
        return { state: "mismatch" };
      }
      const state = ["VALID", "PENDING_SETTLEMENT"].includes(data.transaction_status) ? "paid" : data.transaction_status === "FAILED" ? "failed" : "pending";
      return { state, providerReference: data.internal_transaction_id };
    },
  };
}
