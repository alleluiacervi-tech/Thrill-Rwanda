import { z } from "zod";
import { mtnClient } from "./mtn-client";
import { paymentOrigin } from "./urubuto";
import type { Gateway } from "./registry";
import type { CollectionProvider, ProviderPayment } from "./provider";
import { payerPhone, rwfInteger } from "./rules";

type Environment = Record<string, string | undefined>;
const status = z.object({
  amount: z.union([z.string(), z.number()]),
  currency: z.string(),
  externalId: z.string(),
  status: z.enum(["PENDING", "SUCCESSFUL", "FAILED"]),
  financialTransactionId: z.union([z.string(), z.number()]).optional(),
});

/** MTN Rwanda numbers only (078 and 079 prefixes); Airtel numbers must not be sent to MTN. */
export function mtnWallet(raw: string) {
  const phone = payerPhone(raw, "MOMO");
  return phone && /^2507[89]/.test(phone) ? phone : null;
}

function configuration(env: Environment) {
  const base = env.MTN_BASE_URL?.trim().replace(/\/+$/, "");
  const subscription = env.MTN_SUBSCRIPTION_KEY?.trim();
  const user = z.uuid().safeParse(env.MTN_API_USER);
  const key = env.MTN_API_KEY?.trim();
  const target = env.MTN_TARGET_ENVIRONMENT?.trim();
  if (env.MTN_ENABLED !== "true" || env.MTN_LIVE_APPROVED !== "true" || env.APP_ENV !== "production" ||
    (env.VERCEL_ENV && env.VERCEL_ENV !== "production") || !base || !subscription || !user.success || !key || !target ||
    !/^[\w-]{1,60}$/.test(target)) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      /sandbox|localhost|127\.0\.0\.1/i.test(url.hostname)) return null;
  } catch { return null; }
  return { base, subscription, user: user.data, key, target };
}

function adapter(config: NonNullable<ReturnType<typeof configuration>>): CollectionProvider {
  const request = mtnClient(config);
  function validate(input: ProviderPayment) {
    if (!z.uuid().safeParse(input.reference).success || input.method !== "MOMO" || input.currency !== "RWF" || !rwfInteger(input.amountMinor)) {
      throw new Error("MTN collections require a UUID reference, a whole RWF amount and MTN MoMo");
    }
  }
  return {
    id: "MTN_DIRECT",
    environment: "live",
    merchantCode: config.user,
    serviceCode: "COLLECTIONS",
    getCapabilities: () => ({ methods: ["MOMO"], currencies: ["RWF"], refunds: false, automatedSettlements: false }),
    acceptsPhone: (phone) => !!mtnWallet(phone),
    phoneHint: "Enter an MTN MoMo number (it starts with 078 or 079).",
    async createPayment(input) {
      validate(input);
      const phone = mtnWallet(input.phone);
      if (!phone) throw new Error("Enter an MTN Rwanda number");
      const response = await request("/v1_0/requesttopay", {
        reference: input.reference,
        body: {
          amount: String(input.amountMinor), currency: "RWF", externalId: input.reference,
          payer: { partyIdType: "MSISDN", partyId: phone },
          payerMessage: "Thrill Rwanda payment", payeeNote: input.reference,
        },
      });
      if (response.status !== 202) throw new Error("MTN did not accept the payment request");
      return { providerReference: input.reference };
    },
    async verifyPayment(input) {
      validate(input);
      const response = await request(`/v1_0/requesttopay/${input.reference}`);
      if (response.status === 404) return { state: "missing" };
      if (!response.ok) throw new Error("MTN status unavailable");
      const result = status.parse(await response.json());
      if (result.externalId !== input.reference || result.currency !== input.currency ||
        rwfInteger(result.amount) !== input.amountMinor ||
        (result.status === "SUCCESSFUL" && !result.financialTransactionId)) return { state: "mismatch" };
      return {
        state: result.status === "SUCCESSFUL" ? "paid" : result.status === "FAILED" ? "failed" : "pending",
        providerReference: input.reference,
      };
    },
  };
}

/** Live MTN Rwanda Collections (official API, no intermediary). Offers MTN MoMo in RWF only. */
export function getMtnLiveGateway(env: Environment = process.env): Gateway | null {
  const config = configuration(env);
  if (!config) return null;
  const min = rwfInteger(env.MTN_MIN_RWF);
  const max = rwfInteger(env.MTN_MAX_RWF);
  const origin = paymentOrigin(env);
  const enabled = !!origin && !!min && !!max && max >= min;
  return {
    provider: adapter(config), enabled, origin,
    eligible: (currency, amount) => enabled && currency === "RWF" && Number.isSafeInteger(amount) && amount >= min! && amount <= max! ? ["MOMO"] : [],
  };
}
