import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * Opt-in: talks to the Duffel SANDBOX with the token in DUFFEL_ACCESS_TOKEN.
 *
 *   DUFFEL_LIVE_TEST=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/duffel/duffel.live.test.ts
 *
 * It refuses to run against a live token. It searches, prices, books a test
 * order paid from the test balance, reads the tickets back and cancels the
 * order, using only Duffel's test data.
 */
const token = process.env.DUFFEL_ACCESS_TOKEN ?? "";
const enabled = process.env.DUFFEL_LIVE_TEST === "1" && token.startsWith("duffel_test_");

const future = () => {
  const d = new Date(Date.now() + 75 * 86_400_000);
  return d.toISOString().slice(0, 10);
};

describe.skipIf(!enabled)("Duffel sandbox", () => {
  it("connects with the test token", async () => {
    const { testDuffelConnection } = await import("@/lib/ticketing-duffel");
    const res = await testDuffelConnection();
    expect(res).toMatchObject({ ok: true, mode: "sandbox" });
  }, 60_000);

  it("rejects a bad token with a readable message", async () => {
    const { duffel } = await import("@/lib/duffel/client");
    await expect(
      duffel("/air/airlines", { query: { limit: 1 }, config: { token: "duffel_test_wrong", baseUrl: "https://api.duffel.com", mode: "sandbox" } }),
    ).rejects.toMatchObject({ info: { status: 401 } });
  }, 60_000);

  it("searches, prices, books, reads the tickets back and cancels", async () => {
    const { duffel } = await import("@/lib/duffel/client");
    const { offerToOption, orderPassengers, searchFromEnquiry, summariseOffer, ticketsFromOrder } = await import("@/lib/duffel/mapping");
    const { optionSchema } = await import("@/lib/ticketing-rules");
    type Offer = import("@/lib/duffel/types").DuffelOffer;
    type Order = import("@/lib/duffel/types").DuffelOrder;
    type Request = import("@/lib/duffel/types").DuffelOfferRequest;

    // 1. Search, built from an enquiry's details exactly as the desk does.
    const search = searchFromEnquiry({ origin: "London (LHR)", destination: "Dubai (DXB)", departureDate: future(), tripType: "ONE_WAY", adults: 1, children: 0, infants: 0, cabin: "ECONOMY" });
    const request = await duffel<Request>("/air/offer_requests", { method: "POST", body: search, query: { return_offers: true, supplier_timeout: 30_000 }, timeoutMs: 45_000 });
    expect(request.live_mode).toBe(false);
    expect(request.offers?.length, "the sandbox should return offers for LHR to DXB").toBeGreaterThan(0);

    // 2. Every offer converts to something the desk accepts.
    for (const offer of request.offers!.slice(0, 5)) {
      const option = offerToOption(offer, offer.owner.name);
      const parsed = optionSchema.safeParse(option);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      expect(summariseOffer(offer).slices.length).toBeGreaterThan(0);
    }

    // 3. Re-price the cheapest, as the desk does at the moment of purchase.
    const cheapest = [...request.offers!].sort((a, b) => Number(a.total_amount) - Number(b.total_amount))[0]!;
    const offer = await duffel<Offer>(`/air/offers/${cheapest.id}`);
    expect(offer.id).toBe(cheapest.id);

    // 4. Book with a test traveller, paid from the test balance.
    const traveller = { id: "t1", kind: "ADULT", title: "MR", givenNames: "Test", surname: "Traveller", dateOfBirth: "1985-05-05", nationality: "RW", documentNumber: "PC123456", documentExpiry: "2032-01-01" };
    const passengers = orderPassengers(offer, [traveller], { email: "test@example.com", phone: "+250788123456" });
    const order = await duffel<Order>("/air/orders", {
      method: "POST",
      timeoutMs: 135_000,
      body: { type: "instant", selected_offers: [offer.id], payments: [{ type: "balance", currency: offer.total_currency, amount: offer.total_amount }], passengers },
    });
    expect(order.booking_reference).toMatch(/^[A-Z0-9]{5,8}$/);
    expect(order.live_mode).toBe(false);

    // 5. The order reads back, and tickets (when issued) map onto our traveller.
    const again = await duffel<Order>(`/air/orders/${order.id}`);
    expect(again.id).toBe(order.id);
    const { tickets, missing } = ticketsFromOrder(again, [traveller]);
    console.info(`Duffel sandbox order ${order.id} ref ${order.booking_reference}; tickets ${tickets.length}, awaiting ${missing.length}; documents:`, (again.documents ?? []).map((d) => `${d.type}:${d.unique_identifier}`));

    // 6. Clean up: cancel so the sandbox is left tidy.
    const cancellation = await duffel<{ id: string }>("/air/order_cancellations", { method: "POST", body: { order_id: order.id } });
    await duffel(`/air/order_cancellations/${cancellation.id}/actions/confirm`, { method: "POST" });
  }, 240_000);
});
