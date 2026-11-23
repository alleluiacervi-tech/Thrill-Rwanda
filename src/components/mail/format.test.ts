import { describe, expect, it } from "vitest";
import { fileSize, groupByFolder, listDate, readerDocument } from "@/components/mail/format";

describe("groupByFolder", () => {
  it("collects uids under their own folder", () => {
    const g = groupByFolder([
      { folder: "inbox", uid: 1 },
      { folder: "sent", uid: 7 },
      { folder: "inbox", uid: 3 },
    ]);
    expect(g.get("inbox")).toEqual([1, 3]);
    expect(g.get("sent")).toEqual([7]);
  });
});

describe("listDate", () => {
  const now = new Date("2026-11-23T10:00:00Z");
  it("shows a time for today, a day and month this year, and a year before that", () => {
    expect(listDate("2026-11-23T08:15:00Z", now)).toBe("10:15");
    expect(listDate("2026-03-02T08:15:00Z", now)).toBe("2 Mar");
    expect(listDate("2025-03-02T08:15:00Z", now)).toBe("2 Mar 2025");
  });
  it("shows nothing for a missing date", () => {
    expect(listDate("1970-01-01T00:00:00Z", now)).toBe("");
  });
});

describe("fileSize", () => {
  it("scales units", () => {
    expect([fileSize(500), fileSize(2048), fileSize(5 * 1024 * 1024)]).toEqual(["500 B", "2 KB", "5.0 MB"]);
  });
});

describe("readerDocument", () => {
  it("blocks scripts and remote images unless asked", () => {
    const off = readerDocument({ html: "<p>x</p>", text: "", showImages: false });
    expect(off).toContain("default-src 'none'");
    expect(off).toContain("img-src data:;");
    expect(readerDocument({ html: "<p>x</p>", text: "", showImages: true })).toContain("img-src data: https: http:;");
  });
  it("escapes plain text so it cannot become markup", () => {
    const doc = readerDocument({ html: null, text: "<script>alert(1)</script>", showImages: false });
    expect(doc).not.toContain("<script>alert");
    expect(doc).toContain("&lt;script&gt;");
  });
});
