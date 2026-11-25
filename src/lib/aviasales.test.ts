import { describe, expect, it } from "vitest";
import { aviasalesLink, aviasalesLinks, searchPath } from "./aviasales";

describe("Aviasales partner links", () => {
  it("stays off without a numeric marker", () => {
    expect(aviasalesLinks({})).toBeNull();
    expect(aviasalesLinks({ TRAVELPAYOUTS_MARKER: "abc" })).toBeNull();
  });

  it("writes Aviasales' search path: origin, day, month, destination, adults", () => {
    expect(searchPath("KGL", "NBO", "2026-12-22")).toBe("/search/KGL2212NBO1");
  });

  it("puts the marker, with where the click came from, on the Aviasales link", () => {
    const links = aviasalesLinks({ TRAVELPAYOUTS_MARKER: "123456" })!;
    const url = new URL(aviasalesLink(links, { origin: "KGL", destination: "DXB", date: "2027-01-05", placement: "fares_cheap" })!);
    expect(url.origin + url.pathname).toBe("https://www.aviasales.com/search/KGL0501DXB1");
    expect(url.searchParams.get("marker")).toBe("123456.fares_cheap");
  });

  it("goes through the tracked redirect when a project ID is set", () => {
    const links = aviasalesLinks({ TRAVELPAYOUTS_MARKER: "123456", TRAVELPAYOUTS_PROJECT_ID: "606370" })!;
    const url = new URL(aviasalesLink(links, { origin: "KGL", destination: "NBO", date: "2026-12-22", placement: "fares_deals" })!);
    expect(url.origin + url.pathname).toBe("https://tp.media/r");
    expect(url.searchParams.get("marker")).toBe("123456");
    expect(url.searchParams.get("trs")).toBe("606370");
    expect(url.searchParams.get("p")).toBe("4114");
    expect(url.searchParams.get("sub_id")).toBe("fares_deals");
    expect(url.searchParams.get("u")).toBe("https://www.aviasales.com/search/KGL2212NBO1");
  });

  it("refuses anything that is not a route and a day", () => {
    const links = aviasalesLinks({ TRAVELPAYOUTS_MARKER: "123456" })!;
    expect(aviasalesLink(links, { origin: "kgl", destination: "NBO", date: "2026-12-22", placement: "x" })).toBeNull();
    expect(aviasalesLink(links, { origin: "KGL", destination: "NBO", date: "22/12/2026", placement: "x" })).toBeNull();
  });
});
