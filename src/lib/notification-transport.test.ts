import { afterEach, expect, it, vi } from "vitest";
import { sendOutboxEmail } from "./notification-worker";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("keeps the frozen sender and idempotency key across configuration changes", async () => {
 vi.stubEnv("RESEND_API_KEY", "test-only"); vi.stubEnv("EMAIL_FROM", "Changed <changed@example.invalid>");
 const fetcher = vi.fn(async () => new Response(JSON.stringify({ id: "mock-provider-id" }), { status: 200 })); vi.stubGlobal("fetch", fetcher);
 const result = await sendOutboxEmail("guest@example.invalid", { from: "Frozen <frozen@example.invalid>", subject: "Quotation", html: "<p>Written quote</p>", text: "Written quote" }, "enquiry-fixed-key");
 expect(result.providerId).toBe("mock-provider-id");
 const [destination, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
 expect(destination).toBe("https://api.resend.com/emails"); expect(JSON.parse(String(options.body)).from).toBe("Frozen <frozen@example.invalid>"); expect((options.headers as Record<string, string>)["Idempotency-Key"]).toBe("enquiry-fixed-key");
});
it("classifies a provider outage without exposing its response body", async () => {
 vi.stubGlobal("fetch", vi.fn(async () => new Response("private provider response", { status: 503 })));
 await expect(sendOutboxEmail("guest@example.invalid", { subject: "Test", html: "Test", text: "Test" }, "safe-key")).rejects.toMatchObject({ code: "PROVIDER_TEMPORARY", retryable: true });
});
