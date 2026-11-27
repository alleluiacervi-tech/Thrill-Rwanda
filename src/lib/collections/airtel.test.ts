import { afterEach, describe, expect, it, vi } from "vitest";
import {
  airtelSandboxProvider, airtelTransactionId, airtelWallet, getAirtelLiveGateway, referenceFromAirtelId,
} from "./airtel";
import { configuredGateways } from "./registry";

const reference = "494c4fb8-348d-486a-9aca-f9f81f4ba597";
const airtelId = "494c4fb8348d486a9acaf9f81f4ba597";
const env = {
  APP_ENV: "production", AIRTEL_ENABLED: "true", AIRTEL_LIVE_APPROVED: "true",
  AIRTEL_CLIENT_ID: "client-fixture", AIRTEL_CLIENT_SECRET: "secret-fixture",
  AIRTEL_MIN_RWF: "100", AIRTEL_MAX_RWF: "1000000", PAYMENT_PUBLIC_ORIGIN: "https://pay.example.invalid",
};
const invoice = { reference, amountMinor: 5000, currency: "RWF", method: "AIRTEL_MONEY" as const };
const input = { ...invoice, name: "Test", email: "payer@example.invalid", phone: "0728123456", returnUrl: "" };
const token = () => Response.json({ access_token: "t", expires_in: "180", token_type: "bearer" });
const enquiry = (status: string, extra: object = {}) =>
  Response.json({ data: { transaction: { id: airtelId, status, airtel_money_id: "MP210603.1234.A12345", message: "x", ...extra } }, status: { success: true } });
afterEach(() => vi.unstubAllGlobals());

describe("Airtel live collections", () => {
  it("stays off unless every live gate is satisfied", () => {
    expect(getAirtelLiveGateway(env)).not.toBeNull();
    for (const patch of [
      { APP_ENV: "staging" }, { VERCEL_ENV: "preview" }, { AIRTEL_ENABLED: "false" }, { AIRTEL_LIVE_APPROVED: "" },
      { AIRTEL_CLIENT_ID: "" }, { AIRTEL_CLIENT_SECRET: " " },
      { AIRTEL_BASE_URL: "http://openapi.airtel.africa" }, { AIRTEL_BASE_URL: "https://openapiuat.airtel.africa" },
      { AIRTEL_BASE_URL: "https://openapi.airtel.africa/merchant" },
    ]) expect(getAirtelLiveGateway({ ...env, ...patch })).toBeNull();
  });

  it("offers Airtel Money in RWF within limits, after MTN and before UrubutoPay", () => {
    const gateway = getAirtelLiveGateway(env)!;
    expect(gateway.eligible("RWF", 5000)).toEqual(["AIRTEL_MONEY"]);
    expect(gateway.eligible("RWF", 50)).toEqual([]);
    expect(gateway.eligible("USD", 5000)).toEqual([]);
    expect(getAirtelLiveGateway({ ...env, AIRTEL_MAX_RWF: "" })!.eligible("RWF", 5000)).toEqual([]);
    expect(configuredGateways(env).map((g) => g.provider.id)).toEqual(["AIRTEL_DIRECT"]);
  });

  it("accepts Airtel numbers only", () => {
    expect(airtelWallet("0728123456")).toBe("250728123456");
    expect(airtelWallet("+250 73 123 4567")).toBe("250731234567");
    expect(airtelWallet("0788123456")).toBeNull();
    expect(airtelWallet("12345")).toBeNull();
    const { provider } = getAirtelLiveGateway(env)!;
    expect(provider.acceptsPhone!("0731234567")).toBe(true);
    expect(provider.acceptsPhone!("0788123456")).toBe(false);
    expect(provider.phoneHint).toMatch(/072 or 073/);
  });

  it("maps the attempt reference to Airtel's id and back", () => {
    expect(airtelTransactionId(reference)).toBe(airtelId);
    expect(referenceFromAirtelId(airtelId)).toBe(reference);
    expect(referenceFromAirtelId("../etc")).toBeNull();
  });

  it("pushes a whole-RWF request with the market headers and no country code on the number", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(Response.json({ data: { transaction: { id: airtelId, status: "Success." } }, status: { success: true, response_code: "DP00800001006" } }));
    vi.stubGlobal("fetch", fetch);
    const { provider } = getAirtelLiveGateway(env)!;
    await expect(provider.createPayment(input)).resolves.toEqual({ providerReference: reference });
    expect(fetch.mock.calls[0][0]).toBe("https://openapi.airtel.africa/auth/oauth2/token");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ client_id: "client-fixture", client_secret: "secret-fixture", grant_type: "client_credentials" });
    expect(fetch.mock.calls[1][0]).toBe("https://openapi.airtel.africa/merchant/v1/payments/");
    expect(fetch.mock.calls[1][1].headers).toMatchObject({ "X-Country": "RW", "X-Currency": "RWF", Authorization: "Bearer t" });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      reference: "Thrill Rwanda",
      subscriber: { country: "RW", currency: "RWF", msisdn: "728123456" },
      transaction: { amount: 5000, country: "RW", currency: "RWF", id: airtelId },
    });
  });

  it("treats a refused push as a failure to start", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(Response.json({ status: { success: false, response_code: "DP00800001007" } })));
    await expect(getAirtelLiveGateway(env)!.provider.createPayment(input)).rejects.toThrow();
  });

  it("reads every status code from the enquiry", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(enquiry("TS"))
      .mockResolvedValueOnce(enquiry("TS", { airtel_money_id: null }))
      .mockResolvedValueOnce(enquiry("TF"))
      .mockResolvedValueOnce(enquiry("TE"))
      .mockResolvedValueOnce(enquiry("TIP"))
      .mockResolvedValueOnce(enquiry("TA"))
      .mockResolvedValueOnce(enquiry("TS", { id: "someoneelse0000000000000000000000" }))
      .mockResolvedValueOnce(Response.json({ data: { transaction: null }, status: { success: false } }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetch);
    const { provider } = getAirtelLiveGateway(env)!;
    const seen = [];
    for (let i = 0; i < 9; i++) seen.push((await provider.verifyPayment(invoice)).state);
    expect(seen).toEqual(["paid", "mismatch", "failed", "failed", "pending", "pending", "mismatch", "missing", "missing"]);
    await expect(provider.verifyPayment(invoice)).rejects.toThrow();
    expect(fetch.mock.calls[1][0]).toBe(`https://openapi.airtel.africa/standard/v1/payments/${airtelId}`);
  });

  it("renews the token once after a 401", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(enquiry("TS"));
    vi.stubGlobal("fetch", fetch);
    await expect(getAirtelLiveGateway(env)!.provider.verifyPayment(invoice)).resolves.toMatchObject({ state: "paid" });
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("rejects other currencies, methods and MTN numbers before calling Airtel", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { provider } = getAirtelLiveGateway(env)!;
    await expect(provider.createPayment({ ...input, currency: "USD" })).rejects.toThrow();
    await expect(provider.createPayment({ ...input, method: "MOMO" })).rejects.toThrow();
    await expect(provider.createPayment({ ...input, phone: "0788123456" })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Airtel UAT adapter", () => {
  const sandbox = { APP_ENV: "staging", AIRTEL_SANDBOX_ENABLED: "true", AIRTEL_SANDBOX_CLIENT_ID: "uat", AIRTEL_SANDBOX_CLIENT_SECRET: "uat" };
  it("only exists outside production and uses the UAT host", async () => {
    expect(airtelSandboxProvider(sandbox)?.environment).toBe("staging");
    expect(airtelSandboxProvider({ ...sandbox, APP_ENV: "production" })).toBeNull();
    expect(airtelSandboxProvider({ ...sandbox, VERCEL_ENV: "production" })).toBeNull();
    const fetch = vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(enquiry("TIP"));
    vi.stubGlobal("fetch", fetch);
    await airtelSandboxProvider(sandbox)!.verifyPayment(invoice);
    expect(fetch.mock.calls[0][0]).toBe("https://openapiuat.airtel.africa/auth/oauth2/token");
  });
  it("is never offered to customers", () => {
    expect(configuredGateways(sandbox)).toEqual([]);
  });
});
