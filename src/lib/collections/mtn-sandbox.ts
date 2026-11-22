import { z } from "zod";
import { toQuoteMinor } from "@/lib/quote-rules";
import type { CollectionProvider, ProviderPayment } from "./provider";
import { payerPhone } from "./rules";

const base = "https://sandbox.momodeveloper.mtn.com/collection";
const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().int().positive() });
const mtnStatus = z.object({
  amount: z.string(),
  currency: z.string(),
  externalId: z.string(),
  status: z.enum(["PENDING", "SUCCESSFUL", "FAILED"]),
  financialTransactionId: z.string().min(1).optional(),
});

/** Direct Collections sandbox adapter. Customer routing never selects this adapter. */
export function mtnSandboxProvider(env: Record<string, string | undefined> = process.env): CollectionProvider | null {
  const subscription = env.MTN_SANDBOX_SUBSCRIPTION_KEY?.trim();
  const user = z.uuid().safeParse(env.MTN_SANDBOX_API_USER);
  const key = env.MTN_SANDBOX_API_KEY?.trim();
  if (
    env.MTN_SANDBOX_ENABLED !== "true" || env.VERCEL_ENV === "production" ||
    !["development", "staging", "test"].includes(env.APP_ENV ?? "") || !subscription || !user.success || !key
  ) return null;
  let token: { value: string; expiry: number } | undefined;
  let renewal: Promise<string> | undefined;
  async function accessToken() {
    if (token && token.expiry > Date.now()) return token.value;
    if (!renewal) renewal = (async () => {
      const reply = await fetch(`${base}/token/`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${user.data}:${key}`).toString("base64")}`, "Ocp-Apim-Subscription-Key": subscription! },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(7_000),
      });
      if (!reply.ok) throw new Error("MTN sandbox access token unavailable");
      const item = tokenSchema.parse(await reply.json());
      token = { value: item.access_token, expiry: Date.now() + Math.max(1, item.expires_in - 30) * 1000 };
      return token.value;
    })().finally(() => { renewal = undefined; });
    return renewal;
  }

  async function request(path: string, init?: { body: object; reference: string }) {
    const method = init ? "POST" : "GET";
    const call = async () => fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        "Ocp-Apim-Subscription-Key": subscription!,
        "X-Target-Environment": "sandbox",
        ...(init ? { "X-Reference-Id": init.reference, "Content-Type": "application/json" } : {}),
      },
      body: init ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(7_000),
    });
    const first = await call();
    if (first.status !== 401) return first;
    token = undefined;
    return call();
  }

  function validate(input: ProviderPayment) {
    if (!z.uuid().safeParse(input.reference).success || input.method !== "MOMO" ||
      input.currency !== "EUR" || !Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1) {
      throw new Error("MTN sandbox requires a UUID, a positive EUR amount and MTN MoMo");
    }
  }

  return {
    id: "MTN_DIRECT",
    environment: "staging",
    merchantCode: user.data,
    serviceCode: "COLLECTIONS",
    getCapabilities: () => ({ methods: ["MOMO"], currencies: ["EUR"], refunds: false, automatedSettlements: false }),
    async createPayment(input) {
      validate(input);
      // The MTN sandbox also has official non-Rwanda scenario numbers.
      const phone = payerPhone(input.phone, "CARD");
      if (!phone) throw new Error("Invalid sandbox wallet number");
      const amount = `${Math.floor(input.amountMinor / 100)}.${String(input.amountMinor % 100).padStart(2, "0")}`;
      const response = await request("/v1_0/requesttopay", {
        reference: input.reference,
        body: {
          amount, currency: "EUR", externalId: input.reference,
          payer: { partyIdType: "MSISDN", partyId: phone },
          payerMessage: "Thrill Rwanda payment test", payeeNote: "Sandbox collection",
        },
      });
      if (response.status !== 202) throw new Error("MTN sandbox request acceptance unavailable");
      return { providerReference: input.reference };
    },
    async verifyPayment(input) {
      validate(input);
      const response = await request(`/v1_0/requesttopay/${input.reference}`);
      if (response.status === 404) return { state: "missing" };
      if (!response.ok) throw new Error("MTN sandbox status unavailable");
      const result = mtnStatus.parse(await response.json());
      if (result.externalId !== input.reference || result.currency !== input.currency ||
        toQuoteMinor(result.amount, result.currency) !== input.amountMinor ||
        (result.status === "SUCCESSFUL" && !result.financialTransactionId)) return { state: "mismatch" };
      return {
        state: result.status === "SUCCESSFUL" ? "paid" : result.status === "FAILED" ? "failed" : "pending",
        providerReference: input.reference,
      };
    },
  };
}
