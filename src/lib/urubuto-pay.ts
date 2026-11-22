import { z } from "zod";

const gateway = "https://staging.urubutopay.rw/api";
export const urubutoChannels = ["MOMO", "AIRTEL_MONEY", "CARD"] as const;
export type UrubutoChannel = (typeof urubutoChannels)[number];
export const testAmount = 125000;

export function urubutoTestConfig() {
  if (!["development", "test", "staging"].includes(process.env.APP_ENV ?? "") || process.env.VERCEL_ENV === "production") return null;
  const key = process.env.URUBUTO_PAY_TEST_KEY?.trim();
  const merchant = process.env.URUBUTO_PAY_MERCHANT_CODE?.trim();
  const service = process.env.URUBUTO_PAY_SERVICE_CODE?.trim();
  if (!key?.startsWith("upg:test_") || !merchant || !service) return null;
  return { key, merchant, service };
}

type Config = NonNullable<ReturnType<typeof urubutoTestConfig>>;
const envelope = z.object({ status: z.literal(200), data: z.unknown() });
const initiation = z.object({
  external_transaction_ref_number: z.string(),
  card_processing_url: z.string().optional(),
});
const statusResponse = z.object({
  transaction_status: z.enum(["INITIATED", "PENDING", "VALID", "FAILED", "PENDING_SETTLEMENT"]),
  transaction_id: z.string(),
  payer_code: z.string(),
  merchant_code: z.string(),
  service_code: z.string(),
  currency: z.literal("RWF"),
  amount: z.union([z.string().regex(/^\d+(?:\.0+)?$/), z.number()]).transform(Number),
});

export class UrubutoTestError extends Error {
  constructor(public httpStatus?: number) {
    super("UrubutoPay staging request could not be confirmed.");
  }
}

async function request(config: Config, path: string, body: object) {
  const response = await fetch(gateway + path, {
    method: "POST",
    headers: { Authorization: config.key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new UrubutoTestError(response.status);
  return envelope.parse(await response.json()).data;
}

export async function initiateUrubutoTest(config: Config, input: {
  reference: string;
  method: UrubutoChannel;
  name: string;
  email: string;
  phone: string;
  returnUrl: string;
}) {
  const result = initiation.parse(await request(config, "/v2/payment/initiate", {
    merchant_code: config.merchant,
    service_code: config.service,
    payer_code: input.reference,
    payer_names: input.name,
    payer_email: input.email,
    amount: testAmount,
    channel_name: input.method,
    phone_number: input.phone,
    transaction_id: input.reference,
    ...(input.method === "CARD" && { redirection_url: input.returnUrl }),
  }));
  if (result.external_transaction_ref_number !== input.reference) throw new UrubutoTestError();
  if (input.method !== "CARD") return undefined;
  const url = new URL(result.card_processing_url ?? "");
  if (url.origin !== "https://staging.urubutopay.rw" || !url.pathname.startsWith("/card/process/"))
    throw new UrubutoTestError();
  return url.href;
}

export async function verifyUrubutoTest(config: Config, reference: string) {
  const result = statusResponse.parse(await request(config, "/v2/payment/transaction/status", {
    merchant_code: config.merchant,
    transaction_id: reference,
  }));
  if (result.transaction_id !== reference || result.payer_code !== reference ||
    result.merchant_code !== config.merchant || result.service_code !== config.service ||
    result.amount !== testAmount) throw new UrubutoTestError();
  return result.transaction_status;
}
