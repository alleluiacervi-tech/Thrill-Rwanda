import { afterEach, describe, expect, it, vi } from "vitest";
import { dateRange, searchTerm, sortOrder } from "@/lib/table-query";

/** Search, sort and date filters come straight from the URL, so they are tested against junk too. */

const SORTS = [
  { value: "total", orderBy: { totalMinor: true } },
  { value: "customer", orderBy: { customer: { fullName: true } } },
  { value: "listed", orderBy: [{ status: true }, { createdAt: true }] },
];
const FALLBACK = { createdAt: "desc" };

describe("searchTerm", () => {
  it("trims what was typed", () => {
    expect(searchTerm({ q: "  mara  " })).toBe("mara");
  });

  it("ignores a single character, which would match nearly everything", () => {
    expect(searchTerm({ q: "m" })).toBe("");
  });

  it("is empty when nothing was searched for", () => {
    expect(searchTerm({})).toBe("");
    expect(searchTerm({ q: "   " })).toBe("");
  });
});

describe("sortOrder", () => {
  it("sorts a column newest or largest first", () => {
    expect(sortOrder({ sort: "total" }, SORTS, FALLBACK).orderBy).toEqual({ totalMinor: "desc" });
  });

  it("reverses when asked", () => {
    expect(sortOrder({ sort: "total", dir: "asc" }, SORTS, FALLBACK).orderBy).toEqual({
      totalMinor: "asc",
    });
  });

  it("sorts on a related table, like the customer's name", () => {
    expect(sortOrder({ sort: "customer" }, SORTS, FALLBACK).orderBy).toEqual({
      customer: { fullName: "desc" },
    });
  });

  it("applies the direction across every clause of a multi-column sort", () => {
    expect(sortOrder({ sort: "listed", dir: "asc" }, SORTS, FALLBACK).orderBy).toEqual([
      { status: "asc" },
      { createdAt: "asc" },
    ]);
  });

  it("falls back for a column the page does not allow, instead of passing it to the database", () => {
    const result = sortOrder({ sort: "password" }, SORTS, FALLBACK);
    expect(result.orderBy).toEqual(FALLBACK);
    expect(result.sort).toBe("");
  });

  it("treats an unknown direction as descending", () => {
    expect(sortOrder({ sort: "total", dir: "sideways" }, SORTS, FALLBACK).orderBy).toEqual({
      totalMinor: "desc",
    });
  });
});

describe("dateRange", () => {
  afterEach(() => vi.useRealTimers());

  const freeze = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  };

  it("counts back the right number of days", () => {
    freeze("2026-10-15T09:00:00Z");
    expect(dateRange({ range: "7d" })?.gte.toISOString()).toBe("2026-10-08T09:00:00.000Z");
    expect(dateRange({ range: "30d" })?.gte.toISOString()).toBe("2026-09-15T09:00:00.000Z");
  });

  it("starts this month on the 1st", () => {
    freeze("2026-10-15T09:00:00Z");
    expect(dateRange({ range: "month" })?.gte.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("starts this year on 1 January", () => {
    freeze("2026-10-15T09:00:00Z");
    expect(dateRange({ range: "year" })?.gte.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("counts back across a month boundary", () => {
    freeze("2026-03-03T12:00:00Z");
    expect(dateRange({ range: "7d" })?.gte.toISOString().slice(0, 10)).toBe("2026-02-24");
  });

  it("filters nothing when no range is chosen, or the value is junk", () => {
    expect(dateRange({})).toBeUndefined();
    expect(dateRange({ range: "whenever" })).toBeUndefined();
  });
});
