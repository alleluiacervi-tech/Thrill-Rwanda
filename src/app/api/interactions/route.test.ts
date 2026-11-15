import { describe, it, expect, vi, beforeEach } from "vitest";
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $executeRaw: execute } }));
import { POST } from "./route";
const request = (
  body: unknown,
  origin = "http://localhost:3000",
  host = "localhost:3000",
) =>
  new Request("http://0.0.0.0:3000/api/interactions", {
    method: "POST",
    headers: { origin, host, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => vi.clearAllMocks());
describe("non-identifying interaction counter", () => {
  it("accepts the browser host behind the Next server's internal bind address", async () => {
    expect(
      (await POST(request({ service: "FLIGHT", placement: "HOME_HERO" })))
        .status,
    ).toBe(204);
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it("rejects a different origin before persisting", async () => {
    expect(
      (
        await POST(
          request(
            { service: "FLIGHT", placement: "HOME_HERO" },
            "https://other.invalid",
          ),
        )
      ).status,
    ).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });
  it("rejects sensitive or arbitrary properties", async () => {
    expect(
      (
        await POST(
          request({
            service: "FLIGHT",
            placement: "HOME_HERO",
            email: "private@example.invalid",
          }),
        )
      ).status,
    ).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });
  it("rejects oversized payloads", async () => {
    expect(
      (
        await POST(
          request({
            service: "FLIGHT",
            placement: "HOME_HERO",
            extra: "a".repeat(600),
          }),
        )
      ).status,
    ).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });
});
