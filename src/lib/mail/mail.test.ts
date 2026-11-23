import { describe, expect, it } from "vitest";
import { forwardSubject, parseAddress, parseRecipients, quotedOriginal, replyRecipients, replySubject, splitRecipients } from "@/lib/mail/addresses";
import { mailConfig } from "@/lib/mail/config";
import { combine, viewPlan } from "@/lib/mail/criteria";
import { folderKeyFor, mapFolders } from "@/lib/mail/folders";
import { decodeEntities, htmlToText, sanitizeEmailHtml } from "@/lib/mail/sanitize";
import { hasAttachment } from "@/lib/mail/structure";

describe("mailConfig", () => {
  it("is off until both the user and password are set", () => {
    expect(mailConfig({ MAIL_USER: "a@b.com" })).toBeNull();
    expect(mailConfig({ MAIL_PASSWORD: "x" })).toBeNull();
  });
  it("defaults to Spacemail's servers and implicit TLS", () => {
    const c = mailConfig({ MAIL_USER: "contact@thrillrwanda.com", MAIL_PASSWORD: "x" })!;
    expect([c.imapHost, c.imapPort, c.smtpHost, c.smtpPort, c.smtpSecure]).toEqual([
      "mail.spacemail.com", 993, "mail.spacemail.com", 465, true,
    ]);
  });
  it("uses STARTTLS on 587 and ignores a nonsense port", () => {
    const c = mailConfig({ MAIL_USER: "a@b.com", MAIL_PASSWORD: "x", MAIL_SMTP_PORT: "587", MAIL_IMAP_PORT: "abc" })!;
    expect(c.smtpSecure).toBe(false);
    expect(c.imapPort).toBe(993);
  });
});

describe("folders", () => {
  it("recognises the inbox and server-flagged folders", () => {
    expect(folderKeyFor({ path: "INBOX" })).toBe("inbox");
    expect(folderKeyFor({ path: "Weird", specialUse: "\\Sent" })).toBe("sent");
    expect(folderKeyFor({ path: "Weird", specialUse: "\\Junk" })).toBe("spam");
  });
  it("falls back to names, case-insensitively", () => {
    expect(folderKeyFor({ path: "Sent Items" })).toBe("sent");
    expect(folderKeyFor({ path: "INBOX.Trash", name: "Trash" })).toBe("trash");
    expect(folderKeyFor({ path: "Deleted Items" })).toBe("trash");
    expect(folderKeyFor({ path: "Clients" })).toBeNull();
  });
  it("prefers the server-flagged folder when two claim a role", () => {
    const map = mapFolders([{ path: "Archive" }, { path: "All", specialUse: "\\Archive" }]);
    expect(map.archive?.path).toBe("All");
  });
});

describe("criteria", () => {
  it("builds unread as inbox plus unseen, and starred across several folders", () => {
    expect(viewPlan("unread")).toEqual({ folders: ["inbox"], filter: { seen: false } });
    const starred = viewPlan("starred");
    expect(starred.filter).toEqual({ flagged: true });
    expect(starred.folders).not.toContain("trash");
    expect(starred.folders).not.toContain("spam");
  });
  it("adds text search without losing the filter", () => {
    const c = combine({ seen: false }, "invoice");
    expect(c.seen).toBe(false);
    expect(c.or).toHaveLength(4);
    expect(combine({ all: true }, "  ")).toEqual({ all: true });
  });
});

describe("recipients", () => {
  it("splits on commas outside quotes", () => {
    expect(splitRecipients('"Lee, Ann" <ann@x.com>, bob@y.com; cy@z.org')).toEqual(['"Lee, Ann" <ann@x.com>', "bob@y.com", "cy@z.org"]);
  });
  it("parses names and plain addresses", () => {
    expect(parseAddress("Ann Lee <ANN@X.com>")).toEqual({ name: "Ann Lee", address: "ann@x.com" });
    expect(parseAddress("bob@y.com")).toEqual({ name: "", address: "bob@y.com" });
    expect(parseAddress("not an email")).toBeNull();
  });
  it("treats an injected header line as an invalid address, not a recipient", () => {
    const r = parseRecipients("a@b.com\nBcc: evil@x.com");
    expect(r.valid.map((x) => x.address)).toEqual(["a@b.com"]);
    expect(r.invalid).toEqual(["Bcc: evil@x.com"]);
    expect(parseAddress("a@b.com\r\nBcc: x@y.com")).toBeNull();
  });
  it("removes duplicates regardless of case", () => {
    expect(parseRecipients("a@b.com, A@B.com").valid).toHaveLength(1);
  });
});

describe("reply and forward", () => {
  const msg = {
    from: { name: "Ann", address: "ann@x.com" },
    to: [{ name: "", address: "contact@thrillrwanda.com" }, { name: "", address: "bob@y.com" }],
    cc: [{ name: "", address: "cy@z.org" }],
    replyTo: null,
  };
  it("does not stack prefixes", () => {
    expect(replySubject("Hello")).toBe("Re: Hello");
    expect(replySubject("RE: Hello")).toBe("RE: Hello");
    expect(forwardSubject("Fwd: Hello")).toBe("Fwd: Hello");
  });
  it("replies to the sender, and reply-all adds the others but not the mailbox", () => {
    const one = replyRecipients(msg, "contact@thrillrwanda.com", false);
    expect(one.to.map((a) => a.address)).toEqual(["ann@x.com"]);
    expect(one.cc).toEqual([]);
    const all = replyRecipients(msg, "contact@thrillrwanda.com", true);
    expect(all.cc.map((a) => a.address)).toEqual(["bob@y.com", "cy@z.org"]);
  });
  it("honours Reply-To", () => {
    const r = replyRecipients({ ...msg, replyTo: { name: "", address: "desk@x.com" } }, "contact@thrillrwanda.com", false);
    expect(r.to[0]!.address).toBe("desk@x.com");
  });
  it("escapes the original's header fields and plain text when quoting", () => {
    const html = quotedOriginal(
      { from: { name: "<b>x</b>", address: "a@b.com" }, to: [], date: "2026-01-01T00:00:00Z", subject: "<i>s</i>", html: null, text: "hi <u>there</u>" },
      "forward",
    );
    expect(html).not.toContain("<b>x</b>");
    expect(html).not.toContain("<u>there</u>");
  });
});

describe("sanitizeEmailHtml", () => {
  it("removes scripts, handlers, frames and forms", () => {
    const { html } = sanitizeEmailHtml(
      '<p onclick="x()">Hi</p><script>alert(1)</script><iframe src="https://e.com"></iframe><form action="/"><input></form><style>p{}</style>',
    );
    expect(html).toBe("<p>Hi</p>");
  });
  it("neutralises javascript: and data: links", () => {
    const { html } = sanitizeEmailHtml('<a href="javascript:alert(1)">a</a><a href="data:text/html,x">b</a><a href="https://ok.com">c</a>');
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:text");
    expect(html).toContain('href="https://ok.com"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
  });
  it("blocks remote images by default, counts them, and loads them on request", () => {
    const src = '<img src="https://track.example/p.gif" alt="a">';
    const blocked = sanitizeEmailHtml(src);
    expect(blocked.html).not.toContain("track.example");
    expect(blocked.blockedImages).toBe(1);
    const loaded = sanitizeEmailHtml(src, { allowRemoteImages: true });
    expect(loaded.html).toContain("track.example");
    expect(loaded.blockedImages).toBe(0);
  });
  it("swaps embedded cid images for their data, and drops unknown ones", () => {
    const cid = new Map([["logo", "data:image/png;base64,AAAA"]]);
    expect(sanitizeEmailHtml('<img src="cid:logo">', { cid }).html).toContain("data:image/png;base64,AAAA");
    expect(sanitizeEmailHtml('<img src="cid:missing">', { cid }).html).not.toContain("cid:");
  });
  it("drops risky css but keeps plain styling", () => {
    const { html } = sanitizeEmailHtml('<p style="color:#333;background:url(https://e.com/x);position:fixed">x</p>');
    expect(html).toContain("color:#333");
    expect(html).not.toContain("url(");
    expect(html).not.toContain("position");
  });
});

describe("text conversion", () => {
  it("turns html into readable text", () => {
    expect(htmlToText("<p>Hello&nbsp;<b>world</b></p><p>Bye &amp; thanks</p><ul><li>a</li><li>b</li></ul>")).toBe("Hello world\nBye & thanks\n- a\n- b");
  });
  it("decodes numeric entities safely", () => {
    expect(decodeEntities("&#65;&#x42;&bogus;&#99999999;")).toBe("AB&bogus;&#99999999;");
  });
});

describe("hasAttachment", () => {
  it("is false for a plain multipart/alternative body", () => {
    expect(hasAttachment({ type: "multipart/alternative", childNodes: [{ type: "text/plain" }, { type: "text/html" }] })).toBe(false);
  });
  it("sees a disposition: attachment anywhere in the tree", () => {
    expect(
      hasAttachment({ type: "multipart/mixed", childNodes: [{ type: "text/plain" }, { type: "application/pdf", disposition: "attachment" }] }),
    ).toBe(true);
  });
  it("ignores inline images and signatures", () => {
    expect(hasAttachment({ type: "multipart/related", childNodes: [{ type: "text/html" }, { type: "image/png", disposition: "inline" }] })).toBe(false);
    expect(hasAttachment({ type: "application/pgp-signature" })).toBe(false);
  });
});
