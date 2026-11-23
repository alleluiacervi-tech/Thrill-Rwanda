import { afterAll, describe, expect, it, vi } from "vitest";

// "server-only" throws outside Next's server build; here we are on the server by definition.
vi.mock("server-only", () => ({}));

/**
 * Opt-in: talks to the real mailbox named by MAIL_USER / MAIL_PASSWORD.
 *
 *   node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/mail/mail.live.test.ts
 *   (with MAIL_LIVE_TEST=1 set)
 *
 * It sends one message to the mailbox itself, walks it through every folder and
 * flag, then deletes everything it created. Every message carries a unique
 * token in its subject, so nothing else in the mailbox is read or touched.
 */
const live = process.env.MAIL_LIVE_TEST === "1" && Boolean(process.env.MAIL_USER && process.env.MAIL_PASSWORD);
const token = `livetest-${Date.now().toString(36)}`;

const mail = async () => ({
  imap: await import("@/lib/mail/imap"),
  send: await import("@/lib/mail/send"),
});

async function find(view: "inbox" | "sent" | "drafts" | "spam" | "archive" | "trash" | "unread" | "starred", wait = 0) {
  const { imap } = await mail();
  const deadline = Date.now() + wait;
  for (;;) {
    const page = await imap.listMessages(view, 1, token);
    if (page.items.length || Date.now() >= deadline) return page.items;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

describe.skipIf(!live)("live mailbox", () => {
  afterAll(async () => {
    const { imap } = await mail();
    for (const view of ["inbox", "sent", "drafts", "archive", "spam", "trash"] as const) {
      const items = await find(view);
      if (!items.length) continue;
      const uids = items.map((m) => m.uid);
      // Straight to the trash, then erased from it: nothing is left behind.
      if (view !== "trash") await imap.deleteMessages(view, uids).catch(() => undefined);
    }
    const left = await find("trash");
    if (left.length) await imap.deleteMessages("trash", left.map((m) => m.uid));
    const spam = await find("spam");
    if (spam.length) await imap.deleteMessages("spam", spam.map((m) => m.uid));
    imap.closeMail();
  }, 120_000);

  it("connects and finds all six folders", async () => {
    const { imap } = await mail();
    const folders = await imap.listFolders();
    expect(folders.map((f) => f.key)).toEqual(["inbox", "sent", "drafts", "spam", "archive", "trash"]);
    expect(folders[0]!.path.toUpperCase()).toBe("INBOX");
  }, 60_000);

  it("sends to itself with an attachment, and the copy lands in Sent", async () => {
    const { send } = await mail();
    const out = await send.sendMessage(
      {
        to: process.env.MAIL_USER!,
        cc: "",
        bcc: "",
        subject: `Test ${token}`,
        html: `<p>Hello <b>world</b> ${token}</p><img src="https://example.com/p.gif"><script>alert(1)</script>`,
      },
      [{ filename: "note.txt", contentType: "text/plain", content: Buffer.from("attachment body") }],
    );
    expect(out.recipients).toEqual([process.env.MAIL_USER!.toLowerCase()]);
    expect(out.warning).toBeUndefined();
    expect((await find("sent", 15_000)).length).toBe(1);
  }, 90_000);

  it("receives it, reads it safely, and downloads the attachment", async () => {
    const { imap } = await mail();
    const [item] = await find("inbox", 60_000);
    expect(item, "the message should arrive in the inbox within a minute").toBeTruthy();
    expect(item!.hasAttachments).toBe(true);
    expect(item!.seen).toBe(false);

    const msg = await imap.getMessage("inbox", item!.uid);
    expect(msg.subject).toBe(`Test ${token}`);
    expect(msg.text).toContain("Hello world");
    expect(msg.html).toContain("<b>world</b>");
    expect(msg.html).not.toContain("<script");
    expect(msg.html).not.toContain("example.com");
    expect(msg.blockedImages).toBe(1);
    expect(msg.attachments.map((a) => a.filename)).toEqual(["note.txt"]);

    const file = await imap.getAttachment("inbox", item!.uid, 0);
    expect(file.content.toString()).toBe("attachment body");

    // Opening it marked it read.
    expect((await find("inbox"))[0]!.seen).toBe(true);
    expect((await find("unread")).length).toBe(0);
  }, 120_000);

  it("stars, unstars and marks unread", async () => {
    const { imap } = await mail();
    const [item] = await find("inbox");
    await imap.setFlag("inbox", [item!.uid], "\\Flagged", true);
    expect((await find("starred")).map((m) => m.folder)).toContain("inbox");
    await imap.setFlag("inbox", [item!.uid], "\\Seen", false);
    expect((await find("unread")).length).toBe(1);
    await imap.setFlag("inbox", [item!.uid], "\\Flagged", false);
    expect((await find("starred")).filter((m) => m.folder === "inbox").length).toBe(0);
  }, 120_000);

  it("moves between folders: archive, spam, inbox, trash", async () => {
    const { imap } = await mail();
    let [item] = await find("inbox");
    await imap.moveMessages("inbox", [item!.uid], "archive");
    expect((await find("inbox")).length).toBe(0);
    [item] = await find("archive");
    expect(item).toBeTruthy();

    await imap.moveMessages("archive", [item!.uid], "spam");
    [item] = await find("spam");
    expect(item).toBeTruthy();

    await imap.moveMessages("spam", [item!.uid], "inbox");
    [item] = await find("inbox");
    expect(item).toBeTruthy();

    await imap.deleteMessages("inbox", [item!.uid]);
    [item] = await find("trash");
    expect(item, "delete from the inbox should land in trash").toBeTruthy();
  }, 180_000);

  it("deletes from trash for good", async () => {
    const { imap } = await mail();
    const items = await find("trash");
    await imap.deleteMessages("trash", items.map((m) => m.uid));
    expect((await find("trash")).length).toBe(0);
  }, 90_000);

  it("saves a draft, replaces it, and reopens it", async () => {
    const { imap, send } = await mail();
    const first = await send.saveDraft({ to: "someone@example.com", cc: "", bcc: "", subject: `Draft ${token}`, html: "<p>first version</p>" }, []);
    expect(first.uid).toBeTruthy();
    const second = await send.saveDraft(
      { to: "someone@example.com", cc: "", bcc: "", subject: `Draft ${token}`, html: "<p>second version</p>", draftUid: first.uid },
      [{ filename: "a.txt", contentType: "text/plain", content: Buffer.from("x") }],
    );
    const drafts = await find("drafts");
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.draft).toBe(true);
    const opened = await imap.getMessage("drafts", drafts[0]!.uid, true);
    expect(opened.text).toContain("second version");
    expect(opened.attachments).toHaveLength(1);
    await imap.discardDraft(second.uid!);
    expect((await find("drafts")).length).toBe(0);
  }, 120_000);

  it("rejects a bad recipient without sending anything", async () => {
    const { send } = await mail();
    await expect(send.sendMessage({ to: "not-an-address", cc: "", bcc: "", subject: `Bad ${token}`, html: "<p>x</p>" }, [])).rejects.toThrow(/not valid/i);
  }, 30_000);
});
