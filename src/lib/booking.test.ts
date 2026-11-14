import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  HOLD_MINUTES,
  dayCount,
  isCancellable,
  isStaleHold,
  quoteFor,
  toUtcDay,
} from "@/lib/booking";

/**
 * The booking rules that decide prices, nights and who may change what.
 * `createBooking` itself needs a database, so its arithmetic is tested here
 * through the helpers it calls.
 */

describe("toUtcDay", () => {
  it("reads a date string as that calendar day in UTC", () => {
    expect(toUtcDay("2026-10-15").toISOString()).toBe("2026-10-15T00:00:00.000Z");
  });

  it("drops the time, so a late booking is still that day", () => {
    expect(toUtcDay(new Date("2026-10-15T23:30:00Z")).toISOString()).toBe(
      "2026-10-15T00:00:00.000Z",
    );
  });

  it("refuses an unparseable date rather than inventing one", () => {
    expect(() => toUtcDay("not-a-date")).toThrow();
  });
});

describe("dayCount", () => {
  it("counts whole nights between the dates", () => {
    expect(dayCount(toUtcDay("2026-10-15"), toUtcDay("2026-10-18"))).toBe(3);
  });

  it("counts a single day when start and end are the same", () => {
    expect(dayCount(toUtcDay("2026-10-15"), toUtcDay("2026-10-15"))).toBe(1);
  });

  it("stays correct across a daylight-saving boundary", () => {
    // Europe moves its clocks on 25 October; UTC days must not drift.
    expect(dayCount(toUtcDay("2026-10-24"), toUtcDay("2026-10-26"))).toBe(2);
  });
});

describe("quoteFor", () => {
  const price = 28_000 * 100;

  it("charges a safari per person, not per day", () => {
    expect(quoteFor("TOUR", price, { days: 3, guests: 2 })).toBe(price * 2);
  });

  it("charges a room per night", () => {
    expect(quoteFor("ROOM", price, { days: 3, guests: 2 })).toBe(price * 3);
  });

  it("charges a vehicle per day, whoever is in it", () => {
    expect(quoteFor("VEHICLE", price, { days: 3, guests: 4 })).toBe(price * 3);
  });
});

describe("allowedTransitions", () => {
  it("lets a provider accept or decline new work", () => {
    expect(allowedTransitions("PROVIDER", "PENDING")).toEqual(["CONFIRMED", "REJECTED"]);
  });

  it("never lets a provider cancel — that is a support action", () => {
    for (const from of ["PENDING", "AWAITING_PAYMENT", "PAID", "CONFIRMED"] as const) {
      expect(allowedTransitions("PROVIDER", from)).not.toContain("CANCELLED");
    }
  });

  it("lets an admin cancel at any live stage", () => {
    for (const from of ["PENDING", "AWAITING_PAYMENT", "PAID", "CONFIRMED"] as const) {
      expect(allowedTransitions("ADMIN", from)).toContain("CANCELLED");
    }
  });

  it("closes finished bookings to both roles", () => {
    for (const actor of ["PROVIDER", "ADMIN"] as const) {
      for (const from of ["COMPLETED", "CANCELLED", "REJECTED"] as const) {
        expect(allowedTransitions(actor, from)).toEqual([]);
      }
    }
  });

  it("only marks a confirmed booking complete, never a pending one", () => {
    expect(allowedTransitions("PROVIDER", "CONFIRMED")).toContain("COMPLETED");
    expect(allowedTransitions("PROVIDER", "PENDING")).not.toContain("COMPLETED");
  });
});

describe("isCancellable", () => {
  it("lets a customer cancel before the trip is delivered", () => {
    expect(isCancellable("PENDING")).toBe(true);
    expect(isCancellable("CONFIRMED")).toBe(true);
  });

  it("refuses once it is finished or already closed", () => {
    expect(isCancellable("COMPLETED")).toBe(false);
    expect(isCancellable("CANCELLED")).toBe(false);
    expect(isCancellable("REJECTED")).toBe(false);
  });
});

describe("isStaleHold", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
  const hold = { status: "AWAITING_PAYMENT" as const, createdAt: ago(HOLD_MINUTES + 5), details: {}, paymentCount: 0 };

  it("releases an unconfirmed hold past the hold time", () => {
    expect(isStaleHold(hold, now)).toBe(true);
  });

  it("keeps a hold still inside the hold time", () => {
    expect(isStaleHold({ ...hold, createdAt: ago(HOLD_MINUTES - 5) }, now)).toBe(false);
  });

  it("keeps a booking confirmed at checkout, or with a payment started", () => {
    expect(isStaleHold({ ...hold, details: { terms: { version: 1 } } }, now)).toBe(false);
    expect(isStaleHold({ ...hold, paymentCount: 1 }, now)).toBe(false);
  });

  it("never touches other statuses", () => {
    expect(isStaleHold({ ...hold, status: "PENDING" }, now)).toBe(false);
    expect(isStaleHold({ ...hold, status: "CONFIRMED" }, now)).toBe(false);
  });
});
