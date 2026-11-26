import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateRange } from "./utils";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("formatDateRange", () => {
  afterEach(() => vi.useRealTimers());

  it("shares the month within the current year", () => {
    vi.useFakeTimers({ now: day("2026-11-26") });
    expect(formatDateRange(day("2026-12-10"), day("2026-12-17"))).toBe("10 – 17 Dec");
  });

  it("names the year once for a same-month range in another year", () => {
    vi.useFakeTimers({ now: day("2026-11-26") });
    expect(formatDateRange(day("2027-02-10"), day("2027-02-11"))).toBe("10 – 11 Feb 2027");
  });

  it("spells out both ends across a year boundary", () => {
    vi.useFakeTimers({ now: day("2026-11-26") });
    expect(formatDateRange(day("2026-12-30"), day("2027-01-02"))).toBe("30 Dec – 2 Jan 2027");
  });
});
