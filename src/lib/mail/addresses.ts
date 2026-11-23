import type { Address, MessageDetail } from "@/lib/mail/types";

/**
 * Recipient fields arrive as one line of text ("Ann <ann@x.com>, bob@y.com"),
 * so they are split on commas that are not inside quotes or angle brackets.
 */
const EMAIL = /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@<>(),;:"[\]\\]{2,}$/;

export function splitRecipients(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  let angle = false;
  for (const ch of input) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === "<") angle = true;
    else if (!quoted && ch === ">") angle = false;
    if (!quoted && !angle && (ch === "," || ch === ";" || ch === "\n")) {
      if (current.trim()) parts.push(current.trim());
      current = "";
    } else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** "Ann Lee <ann@x.com>" or "ann@x.com" into a name and an address. */
export function parseAddress(raw: string): Address | null {
  const text = raw.trim();
  const angled = /^(.*)<([^<>]+)>\s*$/.exec(text);
  const address = (angled ? angled[2]! : text).trim();
  if (!EMAIL.test(address) || address.length > 254) return null;
  const name = angled ? angled[1]!.trim().replace(/^"(.*)"$/, "$1").trim() : "";
  return { name, address: address.toLowerCase() };
}

export function parseRecipients(input: string): { valid: Address[]; invalid: string[] } {
  const valid: Address[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const part of splitRecipients(input)) {
    const parsed = parseAddress(part);
    if (!parsed) invalid.push(part);
    else if (!seen.has(parsed.address)) {
      seen.add(parsed.address);
      valid.push(parsed);
    }
  }
  return { valid, invalid };
}

export const formatAddress = (a: Address) => (a.name ? `${a.name.replace(/"/g, "")} <${a.address}>` : a.address);
export const displayName = (a: Address | null) => (a ? a.name || a.address : "Unknown sender");

/* ----------------------------------------------------------- reply & forward */

const prefix = (subject: string, tag: "Re" | "Fwd") => {
  const re = tag === "Re" ? /^\s*(re|aw|sv)\s*:/i : /^\s*(fwd?|fw)\s*:/i;
  return re.test(subject) ? subject : `${tag}: ${subject}`;
};
export const replySubject = (subject: string) => prefix(subject, "Re");
export const forwardSubject = (subject: string) => prefix(subject, "Fwd");

/** Who a reply goes to. Reply-all also takes everyone else, minus the mailbox itself. */
export function replyRecipients(message: Pick<MessageDetail, "from" | "to" | "cc" | "replyTo">, me: string, all: boolean) {
  const mine = me.toLowerCase();
  const primary = message.replyTo ?? message.from;
  const to = primary && primary.address !== mine ? [primary] : message.to.filter((a) => a.address !== mine).slice(0, 1);
  if (!all) return { to, cc: [] as Address[] };
  const taken = new Set([mine, ...to.map((a) => a.address)]);
  const cc = [...message.to, ...message.cc].filter((a) => {
    if (taken.has(a.address)) return false;
    taken.add(a.address);
    return true;
  });
  return { to, cc };
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The quoted original under a reply or forward. `body` must already be sanitised HTML. */
export function quotedOriginal(message: Pick<MessageDetail, "from" | "to" | "date" | "subject" | "html" | "text">, mode: "reply" | "forward") {
  const when = new Date(message.date).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Kigali" });
  const body = message.html ?? `<p>${escapeHtml(message.text).replace(/\n/g, "<br>")}</p>`;
  const from = message.from ? escapeHtml(formatAddress(message.from)) : "Unknown sender";
  if (mode === "forward") {
    return `<br><br><div>---------- Forwarded message ----------<br>From: ${from}<br>Date: ${escapeHtml(when)}<br>Subject: ${escapeHtml(message.subject)}<br>To: ${escapeHtml(message.to.map(formatAddress).join(", "))}</div><br>${body}`;
  }
  return `<br><br><div>On ${escapeHtml(when)}, ${from} wrote:</div><blockquote style="margin:8px 0 0 0;padding-left:12px;border-left:2px solid #cccccc">${body}</blockquote>`;
}
