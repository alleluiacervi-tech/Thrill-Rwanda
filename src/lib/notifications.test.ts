import { beforeEach, expect, it, vi } from "vitest";
const { database, send } = vi.hoisted(() => ({
  database: {
    notification: { createManyAndReturn: vi.fn(), updateMany: vi.fn() },
  },
  send: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: database }));
vi.mock("@/lib/settings", () => ({ getSite: vi.fn(async () => ({})) }));
vi.mock("@/lib/email/template", () => ({
  sendRendered: send,
  renderEmail: vi.fn(() => ({ subject: "test", text: "test", html: "test" })),
}));
import { notify } from "./notifications";
const input = {
  to: [
    { userId: "one", email: "one@example.invalid", name: "One" },
    { userId: "two", email: "two@example.invalid", name: "Two" },
  ],
  type: "booking.created",
  title: "Test",
  body: "Test",
};
beforeEach(() => {
  vi.resetAllMocks();
  database.notification.createManyAndReturn.mockResolvedValue([
    { id: "new-one", userId: "one" },
    { id: "new-two", userId: "two" },
  ]);
});
it("marks only the exact event row for each successful recipient", async () => {
  send
    .mockResolvedValueOnce({ skipped: false })
    .mockRejectedValueOnce(new Error("unavailable"));
  await notify(input);
  expect(database.notification.updateMany.mock.calls[0][0].where).toEqual({
    id: { in: ["new-one"] },
  });
});
it("never marks skipped email as delivered", async () => {
  send.mockResolvedValue({ skipped: true });
  await notify(input);
  expect(database.notification.updateMany).not.toHaveBeenCalled();
});
it("does not stamp older events if the new notification rows could not be created", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  database.notification.createManyAndReturn.mockRejectedValue(
    new Error("database unavailable"),
  );
  send.mockResolvedValue({ skipped: false });
  await notify(input);
  expect(database.notification.updateMany).not.toHaveBeenCalled();
  log.mockRestore();
});
it("deduplicates recipients for a single event", async () => {
  send.mockResolvedValue({ skipped: false });
  await notify({ ...input, to: [input.to[0], input.to[0]] });
  expect(send).toHaveBeenCalledTimes(1);
});
