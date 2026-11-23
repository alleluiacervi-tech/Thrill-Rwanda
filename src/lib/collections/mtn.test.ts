import { afterEach, describe, expect, it, vi } from "vitest";
import { getMtnLiveGateway, mtnWallet } from "./mtn";
import { configuredGateways } from "./registry";

const reference = "494c4fb8-348d-486a-9aca-f9f81f4ba597";
const env = {
  APP_ENV: "production", MTN_ENABLED: "true", MTN_LIVE_APPROVED: "true", MTN_BASE_URL: "https://momo.example.invalid/collection/",
  MTN_TARGET_ENVIRONMENT: "mtnrwanda", MTN_SUBSCRIPTION_KEY: "fixture", MTN_API_USER: reference, MTN_API_KEY: "fixture",
  MTN_MIN_RWF: "100", MTN_MAX_RWF: "1000000", PAYMENT_PUBLIC_ORIGIN: "https://pay.example.invalid",
};
const invoice = { reference, amountMinor: 5000, currency: "RWF", method: "MOMO" as const };
const input = { ...invoice, name: "Test", email: "payer@example.invalid", phone: "0788123456", returnUrl: "" };
const reply = (state: string, amount: string | number = "5000") =>
  Response.json({ amount, currency: "RWF", externalId: reference, status: state, financialTransactionId: "tx-1" });
afterEach(() => vi.unstubAllGlobals());

describe("MTN live collections", () => {
  it("stays off unless every live gate is satisfied", () => {
    expect(getMtnLiveGateway(env)).not.toBeNull();
    for (const patch of [
      { APP_ENV: "staging" }, { VERCEL_ENV: "preview" }, { MTN_ENABLED: "false" }, { MTN_LIVE_APPROVED: "" },
      { MTN_BASE_URL: "http://momo.example.invalid/collection" }, { MTN_BASE_URL: "https://sandbox.momodeveloper.mtn.com/collection" },
      { MTN_TARGET_ENVIRONMENT: "" }, { MTN_API_USER: "not-a-uuid" },
    ]) expect(getMtnLiveGateway({ ...env, ...patch })).toBeNull();
  });
  it("offers MoMo in RWF within limits and comes before UrubutoPay", () => {
    const gateway = getMtnLiveGateway(env)!;
    expect(gateway.eligible("RWF", 5000)).toEqual(["MOMO"]);
    expect(gateway.eligible("RWF", 50)).toEqual([]);
    expect(gateway.eligible("USD", 5000)).toEqual([]);
    expect(configuredGateways(env)[0].provider.id).toBe("MTN_DIRECT");
  });
  it("accepts MTN numbers only", () => {
    expect(mtnWallet("0788123456")).toBe("250788123456");
    expect(mtnWallet("+250 79 123 4567")).toBe("250791234567");
    expect(mtnWallet("0728123456")).toBeNull();
  });
  it("sends a whole-RWF request and verifies amount, currency and reference", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: "t", expires_in: 3600 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(reply("SUCCESSFUL"))
      .mockResolvedValueOnce(reply("SUCCESSFUL", "5001"))
      .mockResolvedValueOnce(reply("PENDING"))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    const { provider } = getMtnLiveGateway(env)!;
    await expect(provider.createPayment(input)).resolves.toEqual({ providerReference: reference });
    await expect(provider.verifyPayment(invoice)).resolves.toEqual({ state: "paid", providerReference: reference });
    await expect(provider.verifyPayment(invoice)).resolves.toEqual({ state: "mismatch" });
    await expect(provider.verifyPayment(invoice)).resolves.toEqual({ state: "pending", providerReference: reference });
    await expect(provider.verifyPayment(invoice)).resolves.toEqual({ state: "missing" });
    expect(fetch.mock.calls[0][0]).toBe("https://momo.example.invalid/collection/token/");
    expect(fetch.mock.calls[1][1].headers).toMatchObject({ "X-Reference-Id": reference, "X-Target-Environment": "mtnrwanda" });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ amount: "5000", currency: "RWF", payer: { partyId: "250788123456" } });
  });
  it("rejects non-RWF requests and Airtel numbers before calling MTN", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { provider } = getMtnLiveGateway(env)!;
    await expect(provider.createPayment({ ...input, currency: "EUR" })).rejects.toThrow();
    await expect(provider.createPayment({ ...input, phone: "0728123456" })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
