import { afterEach, describe, expect, it, vi } from "vitest";
import { getUrubutoProvider } from "./urubuto";
import { invoiceCharge, payerPhone, rwfInteger } from "./rules";
import { webhookJson, verifyWebhookToken, webhookToken } from "./webhooks";

const env = {
  APP_ENV: "staging", URUBUTOPAY_ENVIRONMENT: "staging", URUBUTOPAY_API_KEY: "upg:test_fixture",
  URUBUTOPAY_MERCHANT_CODE: "merchant", URUBUTOPAY_SERVICE_CODE: "service", URUBUTOPAY_ENABLED: "true",
  URUBUTOPAY_APPROVED_METHODS: "MOMO,AIRTEL_MONEY,CARD", URUBUTOPAY_MIN_RWF: "1", URUBUTOPAY_MAX_RWF: "100000",
  PAYMENT_PUBLIC_ORIGIN: "https://staging.example.invalid", URUBUTOPAY_WEBHOOK_USERNAME: "fixture",
  URUBUTOPAY_WEBHOOK_PASSWORD: "fixture-independent-password", URUBUTOPAY_WEBHOOK_SECRET: "fixture-callback-secret-long-enough",
};
const ref = "55cb5b18-56d3-42ac-893a-acab45440714";
const fixture = {
  reference: ref, currency: "RWF", amountMinor: 5_000, method: "MOMO" as const,
  name: "Test Guest", email: "guest@example.invalid", phone: "+250 788 123 456",
  returnUrl: "https://staging.example.invalid/payments/status/" + ref,
};
const hosted = (url: string) => ({
  internal_transaction_ref_number: "provider-ref", external_transaction_ref_number: ref,
  currency: "RWF", card_processing_url: url,
});
const status = {
  transaction_status: "VALID", payer_code: ref, transaction_id: ref, internal_transaction_id: "provider-ref",
  merchant_code: "merchant", service_code: "service", currency: "RWF", amount: 5_000,
  payment_channel: "WALLET", payment_channel_name: "MOMO",
};
const answer = (data: object) => Response.json({ status: 200, data });
afterEach(() => vi.unstubAllGlobals());

describe("approved routing and invoice arithmetic", () => {
  it("rejects unsafe environments and applies currency, method, approval and amount bounds", () => {
    expect(getUrubutoProvider({ ...env, APP_ENV: "production" })).toBeNull();
    expect(getUrubutoProvider({ ...env, VERCEL_ENV: "production" })).toBeNull();
    expect(getUrubutoProvider({ ...env, URUBUTOPAY_ENVIRONMENT: "live" })).toBeNull();
    const live = { ...env, APP_ENV: "production", URUBUTOPAY_ENVIRONMENT: "live", URUBUTOPAY_API_KEY: "fixture-live" };
    expect(getUrubutoProvider(live)?.enabled).toBe(false);
    expect(getUrubutoProvider({ ...live, URUBUTOPAY_LIVE_APPROVED: "true" })?.enabled).toBe(true);
    expect(getUrubutoProvider({ ...env, URUBUTOPAY_WEBHOOK_SECRET: "" })?.enabled).toBe(false);
    const config = getUrubutoProvider(env)!;
    expect(config.eligible("RWF", 4)).toEqual(["CARD"]);
    expect(config.eligible("USD", 5000)).toEqual([]);
    expect(config.eligible("RWF", 100001)).toEqual([]);
  });
  it("uses whole francs, approved deposit and remaining balance", () => {
    expect(rwfInteger("5000.000")).toBe(5000);
    expect(rwfInteger("5000.25")).toBeNull();
    expect(rwfInteger(1e99)).toBeNull();
    expect([0, 4000, 5000, 6000, 9000].map((paid) => invoiceCharge(9000, paid, 5000))).toEqual([5000, 1000, 4000, 3000, 0]);
    expect(payerPhone("0788-123-456", "MOMO")).toBe("250788123456");
    expect(payerPhone("+49 151 23456789", "CARD")).toBe("4915123456789");
    expect(payerPhone("+49 151 23456789", "MOMO")).toBeNull();
    expect(payerPhone("000", "CARD")).toBeNull();
  });
});

describe("UrubutoPay v2 contract", () => {
  it("sends supported channels with the same exact merchant idempotency reference", async () => {
    const fetch = vi.fn(async () => answer(hosted("https://staging.urubutopay.rw/card/process/confirmed")));
    vi.stubGlobal("fetch", fetch);
    const provider = getUrubutoProvider(env)!.provider;
    for (const method of ["MOMO", "AIRTEL_MONEY", "CARD"] as const) {
      const result = await provider.createPayment({ ...fixture, method });
      const [url, req] = (fetch.mock.calls.at(-1) as unknown as [string, RequestInit]);
      expect(url).toBe("https://staging.urubutopay.rw/api/v2/payment/initiate");
      expect(req.headers).toMatchObject({ Authorization: env.URUBUTOPAY_API_KEY });
      expect(JSON.parse(String(req.body))).toMatchObject({
        transaction_id: ref, payer_code: ref, amount: 5_000, phone_number: "250788123456", channel_name: method,
      });
      expect(result.hostedUrl ? method : "").toBe(method === "CARD" ? "CARD" : "");
    }
  });
  it("rejects hosted links on another host or path and mismatched references", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(answer(hosted("https://urubutopay.rw/card/process/fixture")))
      .mockResolvedValueOnce(answer(hosted("https://staging.urubutopay.rw/admin")))
      .mockResolvedValueOnce(answer({ ...hosted("https://staging.urubutopay.rw/card/process/fixture"), external_transaction_ref_number: "another-ref" }));
    vi.stubGlobal("fetch", fetch);
    const provider = getUrubutoProvider(env)!.provider;
    for (let check = 0; check < 3; check++) {
      await expect(provider.createPayment({ ...fixture, method: "CARD" })).rejects.toThrow();
    }
  });
  it("verifies a payment only when merchant, service, payer, reference, channel, currency and amount all match", async () => {
    const provider = getUrubutoProvider(env)!.provider;
    vi.stubGlobal("fetch", vi.fn(async () => answer(status)));
    await expect(provider.verifyPayment(fixture)).resolves.toEqual({ state: "paid", providerReference: "provider-ref" });
    for (const overwritten of [{ amount: 1 }, { currency: "USD" }, { merchant_code: "other" }, { service_code: "other" }, { transaction_id: "other" }, { payer_code: "other" }, { payment_channel_name: "AIRTEL_MONEY" }]) {
      vi.stubGlobal("fetch", vi.fn(async () => answer({ ...status, ...overwritten })));
      await expect(provider.verifyPayment(fixture)).resolves.toEqual({ state: "mismatch" });
    }
    for (const [gateway, state] of [["PENDING", "pending"], ["PENDING_SETTLEMENT", "paid"], ["FAILED", "failed"]]) {
      vi.stubGlobal("fetch", vi.fn(async () => answer({ ...status, transaction_status: gateway })));
      await expect(provider.verifyPayment(fixture)).resolves.toMatchObject({ state });
    }
    vi.stubGlobal("fetch", vi.fn(async () => new Response("missing", { status: 404 })));
    await expect(provider.verifyPayment(fixture)).resolves.toEqual({ state: "missing" });
  });
});

describe("webhook authentication", () => {
  it("requires a valid signed bearer token and enforces expiration", () => {
    const secret = env.URUBUTOPAY_WEBHOOK_SECRET;
    const token = webhookToken(secret, 10_000);
    expect(verifyWebhookToken("Bearer " + token, secret, 10_100)).toBe(true);
    expect(verifyWebhookToken("Bearer " + token, secret, 17_200)).toBe(false);
    expect(verifyWebhookToken("Bearer " + token, secret, 9_990)).toBe(false);
    expect(verifyWebhookToken("Bearer " + token.slice(0, -1) + "!", secret, 10_100)).toBe(false);
    expect(verifyWebhookToken("Bearer " + token, "different", 10_100)).toBe(false);
  });
  it("rejects invalid types, JSON and payloads over the documented application limit", async () => {
    const request = (body: string, type = "application/json") => new Request("https://thrill.example.invalid/", { method: "POST", headers: { "content-type": type }, body });
    await expect(webhookJson(request('{"sample":"okay"}'))).resolves.toEqual({ sample: "okay" });
    await expect(webhookJson(request("bad"))).resolves.toBeNull();
    await expect(webhookJson(request('{"sample":"wrong type"}', "text/plain"))).resolves.toBeNull();
    await expect(webhookJson(request(JSON.stringify({ example: "x".repeat(16384) })))).resolves.toBeNull();
  });
});
