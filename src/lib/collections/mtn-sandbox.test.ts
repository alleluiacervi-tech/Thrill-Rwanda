import { afterEach, expect, it, vi } from "vitest";
import { mtnSandboxProvider } from "./mtn-sandbox";

const reference = "494c4fb8-348d-486a-9aca-f9f81f4ba597";
const env = {
  APP_ENV: "test", MTN_SANDBOX_ENABLED: "true", MTN_SANDBOX_SUBSCRIPTION_KEY: "fixture",
  MTN_SANDBOX_API_USER: reference, MTN_SANDBOX_API_KEY: "fixture",
};
const invoice = { reference, amountMinor: 505, currency: "EUR", method: "MOMO" as const };
const input = { ...invoice, name: "Test", email: "payer@example.invalid", phone: "0788123456", returnUrl: "" };
afterEach(() => vi.unstubAllGlobals());

it("restricts direct MTN to testing and verifies exact amount, currency and ID", async () => {
  expect(mtnSandboxProvider({ ...env, APP_ENV: "production" })).toBeNull();
  expect(mtnSandboxProvider({ ...env, VERCEL_ENV: "production" })).toBeNull();
  const fetch = vi.fn()
    .mockResolvedValueOnce(Response.json({ access_token: "fixture", expires_in: 3600 }))
    .mockResolvedValueOnce(new Response(null, { status: 202 }))
    .mockResolvedValueOnce(Response.json({ amount: "5.05", currency: "EUR", externalId: reference, status: "SUCCESSFUL", financialTransactionId: "fixture" }))
    .mockResolvedValueOnce(Response.json({ amount: "5.06", currency: "EUR", externalId: reference, status: "SUCCESSFUL", financialTransactionId: "fixture" }));
  vi.stubGlobal("fetch", fetch);
  const adapter = mtnSandboxProvider(env)!;
  await expect(adapter.createPayment(input)).resolves.toEqual({ providerReference: reference });
  await expect(adapter.verifyPayment(invoice)).resolves.toEqual({ state: "paid", providerReference: reference });
  await expect(adapter.verifyPayment(invoice)).resolves.toEqual({ state: "mismatch" });
  expect(fetch.mock.calls[0][0]).toBe("https://sandbox.momodeveloper.mtn.com/collection/token/");
  expect(fetch.mock.calls[1][1].headers["X-Reference-Id"]).toBe(reference);
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ payer: { partyId: "250788123456" }, amount: "5.05" });
  expect(fetch).toHaveBeenCalledTimes(4);
});
