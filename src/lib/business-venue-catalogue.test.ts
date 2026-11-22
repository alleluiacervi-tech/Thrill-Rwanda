import { afterEach, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { publicBusinessVenueCatalogue, readBusinessVenues } from "./business-venue-catalogue";
import { meetingSpaces, meetingVenues } from "./meeting-directory";

const findMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { businessVenue: { findMany } } }));

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

it("keeps the public directory available when the database migration is missing", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  findMany.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Table missing", {
    code: "P2021",
    clientVersion: "7",
  }));

  await expect(publicBusinessVenueCatalogue()).resolves.toEqual({ venues: meetingVenues, spaces: meetingSpaces });
  await expect(readBusinessVenues(false)).resolves.toBeNull();
});

it("applies publication filters for guests and reads drafts for administrators", async () => {
  findMany.mockResolvedValue([]);

  await publicBusinessVenueCatalogue();
  expect(findMany).toHaveBeenLastCalledWith({
    where: { isPublished: true, spaces: { some: { isPublished: true } } },
    include: { spaces: { where: { isPublished: true }, orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });
  await readBusinessVenues(false);
  expect(findMany).toHaveBeenLastCalledWith({
    where: undefined,
    include: { spaces: { where: undefined, orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });
});

it("surfaces unexpected database errors", async () => {
  const error = new Error("Database unreachable");
  findMany.mockRejectedValue(error);

  await expect(publicBusinessVenueCatalogue()).rejects.toBe(error);
});
