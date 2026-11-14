import { describe, expect, it } from "vitest";
import { pageHref, paginate, paginateList } from "@/lib/pagination";

/** Paging the dashboard tables: no row may be unreachable, and no page may be empty. */

describe("paginate", () => {
  it("slices the first page", () => {
    const page = paginate({}, 340);
    expect(page).toMatchObject({ current: 1, pages: 14, skip: 0, take: 25, from: 1, to: 25 });
  });

  it("slices a middle page", () => {
    expect(paginate({ page: "3" }, 340)).toMatchObject({ skip: 50, from: 51, to: 75 });
  });

  it("shows a short last page rather than padding it", () => {
    expect(paginate({ page: "14" }, 340)).toMatchObject({ from: 326, to: 340 });
  });

  it("clamps a page past the end to the last one, never an empty table", () => {
    expect(paginate({ page: "99" }, 340).current).toBe(14);
  });

  it("ignores junk in the URL", () => {
    for (const bad of ["abc", "-2", "0", "", undefined]) {
      expect(paginate({ page: bad }, 340).current).toBe(1);
    }
  });

  it("reports an empty table honestly", () => {
    expect(paginate({}, 0)).toMatchObject({ pages: 1, from: 0, to: 0, total: 0 });
  });

  it("reaches every row across all pages", () => {
    const total = 97;
    const seen = new Set<number>();
    for (let n = 1; n <= paginate({}, total).pages; n++) {
      const page = paginate({ page: String(n) }, total);
      for (let row = page.from; row <= page.to; row++) seen.add(row);
    }
    expect(seen.size).toBe(total);
  });
});

describe("paginateList", () => {
  const items = Array.from({ length: 26 }, (_, i) => i + 1);

  it("returns the slice for the page asked for", () => {
    expect(paginateList({ page: "2" }, items, 12).items).toEqual([13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
  });

  it("returns the remainder on the last page", () => {
    expect(paginateList({ page: "3" }, items, 12).items).toEqual([25, 26]);
  });
});

describe("pageHref", () => {
  it("keeps the filters already in the URL", () => {
    expect(pageHref("/admin/bookings", { status: "PAID", q: "mara" }, 4)).toBe(
      "/admin/bookings?status=PAID&q=mara&page=4",
    );
  });

  it("leaves page 1 out of the link, so the plain URL is the first page", () => {
    expect(pageHref("/admin/bookings", { status: "PAID" }, 1)).toBe("/admin/bookings?status=PAID");
    expect(pageHref("/admin/bookings", {}, 1)).toBe("/admin/bookings");
  });

  it("pages each list separately when a page holds several", () => {
    const params = { tours: "2", vehicles: "3" };
    expect(pageHref("/provider/listings", params, 4, "vehicles")).toContain("tours=2");
    expect(pageHref("/provider/listings", params, 4, "vehicles")).toContain("vehicles=4");
  });
});
