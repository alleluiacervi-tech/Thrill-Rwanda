import { describe, expect, it } from "vitest";
import { configuredGateways, gatewayForAttempt } from "./registry";

const env = {
  APP_ENV: "staging", URUBUTOPAY_ENVIRONMENT: "staging", URUBUTOPAY_API_KEY: "upg:test_fixture",
  URUBUTOPAY_MERCHANT_CODE: "merchant", URUBUTOPAY_SERVICE_CODE: "service", URUBUTOPAY_ENABLED: "true",
  URUBUTOPAY_APPROVED_METHODS: "MOMO,CARD", URUBUTOPAY_MIN_RWF: "1", URUBUTOPAY_MAX_RWF: "100000",
  PAYMENT_PUBLIC_ORIGIN: "https://staging.example.invalid", URUBUTOPAY_WEBHOOK_USERNAME: "fixture",
  URUBUTOPAY_WEBHOOK_PASSWORD: "fixture-independent-password", URUBUTOPAY_WEBHOOK_SECRET: "fixture-callback-secret-long-enough",
};
const attempt = { provider: "URUBUTOPAY", environment: "staging", merchantCode: "merchant", serviceCode: "service" };

describe("collection gateway registry", () => {
  it("lists nothing without configuration", () => {
    expect(configuredGateways({})).toEqual([]);
  });
  it("resolves an attempt only to the provider and merchant that created it", () => {
    expect(gatewayForAttempt(attempt, env)?.provider.id).toBe("URUBUTOPAY");
    expect(gatewayForAttempt({ ...attempt, provider: "MTN_DIRECT" }, env)).toBeNull();
    expect(gatewayForAttempt({ ...attempt, merchantCode: "other" }, env)).toBeNull();
    expect(gatewayForAttempt({ ...attempt, environment: "live" }, env)).toBeNull();
  });
  it("offers only approved methods within the amount limits", () => {
    const [gateway] = configuredGateways(env);
    expect(gateway.eligible("RWF", 5_000)).toEqual(["MOMO", "CARD"]);
    expect(gateway.eligible("RWF", 200_000)).toEqual([]);
    expect(gateway.eligible("USD", 5_000)).toEqual([]);
  });
});
