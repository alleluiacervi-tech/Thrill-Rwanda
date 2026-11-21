import { afterEach, expect, it, vi } from "vitest";
import { initiateUrubutoTest, testAmount, verifyUrubutoTest } from "./urubuto-pay";

const config = { key: "upg:test_fixture", merchant: "MERCHANT", service: "EVENTS" };
const reference = "TEST-fixture";
const input = {
  reference,
  method: "CARD" as const,
  name: "Test Payer",
  email: "test@example.invalid",
  phone: "250780000000",
  returnUrl: "https://thrill.example/events-business/payment-preview/staging",
};
const envelope = (data: object) => Response.json({ status: 200, data });

afterEach(() => vi.unstubAllGlobals());

it("initiates hosted checkout on staging using a fixed amount and reference", async () => {
  const url = "https://staging.urubutopay.rw/card/process/fixture";
  const fetch = vi.fn().mockResolvedValue(envelope({
    external_transaction_ref_number: reference,
    card_processing_url: url,
  }));
  vi.stubGlobal("fetch", fetch);
  await expect(initiateUrubutoTest(config, input)).resolves.toBe(url);
  const [endpoint, options] = fetch.mock.calls[0];
  expect(endpoint).toBe("https://staging.urubutopay.rw/api/v2/payment/initiate");
  expect(JSON.parse(options.body)).toMatchObject({
    amount: testAmount,
    transaction_id: reference,
    payer_code: reference,
    channel_name: "CARD",
    redirection_url: input.returnUrl,
  });
});

it("rejects hosted URLs outside provider staging", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(envelope({
    external_transaction_ref_number: reference,
    card_processing_url: "https://urubutopay.rw/card/process/fixture",
  })));
  await expect(initiateUrubutoTest(config, input)).rejects.toThrow();
});

it("matches verified status to the exact merchant, payer, reference and amount", async () => {
  const result = {
    transaction_status: "VALID", payer_code: reference, transaction_id: reference,
    merchant_code: config.merchant, service_code: config.service, currency: "RWF",
    amount: String(testAmount),
  };
  const fetch = vi.fn().mockResolvedValueOnce(envelope(result))
    .mockResolvedValueOnce(envelope({ ...result, amount: "5" }));
  vi.stubGlobal("fetch", fetch);
  await expect(verifyUrubutoTest(config, reference)).resolves.toBe("VALID");
  await expect(verifyUrubutoTest(config, reference)).rejects.toThrow();
});
