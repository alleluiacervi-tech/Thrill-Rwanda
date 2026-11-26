import "server-only";
import { ImapFlow, type FetchMessageObject } from "imapflow";
import { simpleParser, type ParsedMail, type AddressObject } from "mailparser";
import { mailConfig, type MailConfig } from "@/lib/mail/config";
import { combine, viewPlan, type Criteria } from "@/lib/mail/criteria";
import { mapFolders, type ListedMailbox } from "@/lib/mail/folders";
import { sanitizeEmailHtml } from "@/lib/mail/sanitize";
import { hasAttachment } from "@/lib/mail/structure";
import {
  FOLDER_KEYS,
  type Address,
  type AttachmentInfo,
  type Folder,
  type FolderKey,
  type MessageDetail,
  type MessageSummary,
  type Page,
  type View,
} from "@/lib/mail/types";

/**
 * Reading and changing the mailbox over IMAP.
 *
 * Signing in to the mail server takes about five seconds; every command after
 * that takes well under one. So one signed-in connection is kept per server
 * process and reused, then closed after `IDLE_MS` of silence. On a host that does
 * not keep processes alive (serverless) it simply reconnects, which is slower
 * but just as correct. A dropped connection is replaced and the call retried
 * once.
 */

export const PAGE_SIZE = 25;

/** Where a role is created when the mailbox has no folder for it yet. */
const DEFAULT_PATH: Record<FolderKey, string> = {
  inbox: "INBOX",
  sent: "Sent",
  drafts: "Drafts",
  spam: "Spam",
  archive: "Archive",
  trash: "Trash",
};

export class MailError extends Error {}

/** A message a person can act on, without leaking host names or credentials. */
export function describeMailError(err: unknown): string {
  if (err instanceof MailError) return err.message;
  const e = err as { authenticationFailed?: boolean; code?: string; responseText?: string; message?: string };
  if (e?.authenticationFailed) return "The mailbox rejected the sign-in. Check MAIL_USER and MAIL_PASSWORD.";
  if (e?.code === "ENOTFOUND" || e?.code === "ECONNREFUSED" || e?.code === "ETIMEDOUT" || e?.code === "ECONNRESET") {
    return "Could not reach the mail server. Try again in a moment.";
  }
  console.error("[mail]", e?.code ?? "", e?.responseText ?? e?.message ?? err);
  return "The mail server could not complete that. Try again.";
}

export function requireConfig(): MailConfig {
  const config = mailConfig();
  if (!config) throw new MailError("The mailbox is not connected yet.");
  return config;
}

const IDLE_MS = 90_000;

type Shared = { client: ImapFlow; timer: ReturnType<typeof setTimeout> | null };
let shared: Shared | null = null;
let connecting: Promise<ImapFlow> | null = null;

function release(entry: Shared) {
  if (entry.timer) clearTimeout(entry.timer);
  if (shared === entry) shared = null;
  paths = null;
  entry.client.logout().catch(() => entry.client.close());
}

async function open(config: MailConfig): Promise<ImapFlow> {
  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: true,
    auth: { user: config.user, pass: config.pass },
    logger: false,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });
  // An unhandled 'error' event would take the whole server process down.
  client.on("error", () => {});
  client.on("close", () => {
    if (shared?.client === client) {
      if (shared.timer) clearTimeout(shared.timer);
      shared = null;
      paths = null;
    }
  });
  await client.connect();
  return client;
}

async function acquire(config: MailConfig): Promise<ImapFlow> {
  if (shared?.client.usable) {
    if (shared.timer) clearTimeout(shared.timer);
    return shared.client;
  }
  // Two requests arriving together share one sign-in instead of making two.
  connecting ??= open(config)
    .then((client) => {
      shared = { client, timer: null };
      return client;
    })
    .finally(() => {
      connecting = null;
    });
  return connecting;
}

function idle() {
  if (!shared) return;
  const entry = shared;
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => release(entry), IDLE_MS);
  // Never keep the process alive just for an idle mailbox connection.
  entry.timer.unref?.();
}

/**
 * Starts signing in to the mailbox without waiting for it. The Mail page calls
 * this while it renders, so the 3-4 second IMAP sign-in overlaps page load and
 * hydration instead of starting only when the browser asks for the inbox.
 * Errors are left for the real request to report.
 */
export function warmMail() {
  if (!mailConfig() || shared?.client.usable) return;
  void withMail(async () => undefined).catch(() => {});
}

/** Closes the shared connection now. For tests and shutdown. */
export function closeMail() {
  if (shared) release(shared);
}

export async function withMail<T>(fn: (client: ImapFlow, config: MailConfig) => Promise<T>): Promise<T> {
  const config = requireConfig();
  for (let attempt = 0; ; attempt++) {
    const client = await acquire(config);
    try {
      const result = await fn(client, config);
      idle();
      return result;
    } catch (err) {
      // A connection that died under us is replaced once; any other failure is the caller's to see.
      if (!client.usable && attempt === 0 && !(err instanceof MailError)) {
        if (shared?.client === client) release(shared);
        continue;
      }
      idle();
      throw err;
    }
  }
}

/* ----------------------------------------------------------------- folders */

let paths: { at: number; map: Partial<Record<FolderKey, ListedMailbox>> } | null = null;
const PATHS_TTL_MS = 5 * 60_000;

async function pathsOf(client: ImapFlow) {
  if (paths && Date.now() - paths.at < PATHS_TTL_MS) return paths.map;
  const boxes = await client.list();
  const map = mapFolders(boxes as unknown as ListedMailbox[]);
  paths = { at: Date.now(), map };
  return map;
}

/** The path for a role. A missing Archive is created; the others have a default to fall back on. */
async function pathFor(client: ImapFlow, key: FolderKey, create = false): Promise<string> {
  const found = (await pathsOf(client))[key];
  if (found) return found.path;
  const path = DEFAULT_PATH[key];
  if (create) {
    await client.mailboxCreate(path).catch(() => undefined);
    await client.mailboxSubscribe(path).catch(() => undefined);
    paths = null;
  }
  return path;
}

export async function listFolders(): Promise<Folder[]> {
  return withMail(async (client) => {
    const boxes = (await client.list({ statusQuery: { messages: true, unseen: true } })) as unknown as ListedMailbox[];
    const map = mapFolders(boxes);
    return FOLDER_KEYS.map((key) => {
      const box = map[key];
      return { key, path: box?.path ?? DEFAULT_PATH[key], total: box?.status?.messages ?? 0, unread: box?.status?.unseen ?? 0 };
    });
  });
}

/* ---------------------------------------------------------------- messages */

const address = (a: { name?: string | undefined; address?: string | undefined } | undefined): Address | null =>
  a?.address ? { name: a.name ?? "", address: a.address.toLowerCase() } : null;

const addresses = (list: { name?: string | undefined; address?: string | undefined }[] | undefined): Address[] =>
  (list ?? []).map(address).filter((a): a is Address => a !== null);

function summarise(folder: FolderKey, m: FetchMessageObject): MessageSummary {
  const flags = m.flags ?? new Set<string>();
  const env = m.envelope;
  const date = env?.date ? new Date(env.date) : m.internalDate ? new Date(m.internalDate) : new Date(0);
  return {
    folder,
    uid: m.uid,
    from: address(env?.from?.[0]),
    to: addresses(env?.to),
    subject: env?.subject?.trim() || "(no subject)",
    date: (Number.isNaN(date.getTime()) ? new Date(0) : date).toISOString(),
    seen: flags.has("\\Seen"),
    flagged: flags.has("\\Flagged"),
    draft: flags.has("\\Draft") || folder === "drafts",
    hasAttachments: hasAttachment(m.bodyStructure),
  };
}

const SUMMARY_FIELDS = { uid: true, flags: true, envelope: true, bodyStructure: true, internalDate: true } as const;

async function searchIn(client: ImapFlow, path: string, criteria: Criteria): Promise<number[]> {
  const lock = await client.getMailboxLock(path, { readOnly: true });
  try {
    const uids = await client.search(criteria, { uid: true });
    return uids ? uids.sort((a, b) => a - b) : [];
  } finally {
    lock.release();
  }
}

async function fetchSummaries(client: ImapFlow, path: string, folder: FolderKey, uids: number[]): Promise<MessageSummary[]> {
  if (!uids.length) return [];
  const lock = await client.getMailboxLock(path, { readOnly: true });
  try {
    const out: MessageSummary[] = [];
    for await (const m of client.fetch(uids, SUMMARY_FIELDS, { uid: true })) out.push(summarise(folder, m));
    return out;
  } finally {
    lock.release();
  }
}

const newestFirst = (a: MessageSummary, b: MessageSummary) => b.date.localeCompare(a.date) || b.uid - a.uid;

export async function listMessages(view: View, page: number, query: string): Promise<Page<MessageSummary>> {
  const current = Math.max(1, Math.min(10_000, Math.floor(page) || 1));
  return withMail(async (client) => {
    const plan = viewPlan(view);
    const criteria = combine(plan.filter, query);
    const paths = await pathsOf(client);

    // One real folder: only the requested page is fetched.
    if (plan.folders.length === 1) {
      const key = plan.folders[0]!;
      const path = paths[key]?.path ?? DEFAULT_PATH[key];
      const uids = await searchIn(client, path, criteria).catch(() => [] as number[]);
      const end = uids.length - (current - 1) * PAGE_SIZE;
      const slice = uids.slice(Math.max(0, end - PAGE_SIZE), Math.max(0, end));
      const items = (await fetchSummaries(client, path, key, slice)).sort(newestFirst);
      return { items, total: uids.length, page: current, pageSize: PAGE_SIZE };
    }

    // Several folders (starred): the dates are needed to merge them, so fetch the matches of each.
    const all: MessageSummary[] = [];
    for (const key of plan.folders) {
      const path = paths[key]?.path;
      if (!path) continue;
      const uids = (await searchIn(client, path, criteria).catch(() => [] as number[])).slice(-200);
      all.push(...(await fetchSummaries(client, path, key, uids)));
    }
    all.sort(newestFirst);
    const start = (current - 1) * PAGE_SIZE;
    return { items: all.slice(start, start + PAGE_SIZE), total: all.length, page: current, pageSize: PAGE_SIZE };
  });
}

/* ------------------------------------------------------------- one message */

async function downloadSource(client: ImapFlow, path: string, uid: number, markSeen: boolean) {
  const lock = await client.getMailboxLock(path, { readOnly: !markSeen });
  try {
    const m = await client.fetchOne(String(uid), { uid: true, flags: true, source: true }, { uid: true });
    if (!m || !m.source) throw new MailError("That message is no longer in the mailbox.");
    const wasUnread = !(m.flags ?? new Set<string>()).has("\\Seen");
    if (markSeen && wasUnread) await client.messageFlagsAdd([uid], ["\\Seen"], { uid: true });
    return { source: m.source, flags: m.flags ?? new Set<string>() };
  } finally {
    lock.release();
  }
}

const list = (a: AddressObject | AddressObject[] | undefined): Address[] =>
  (Array.isArray(a) ? a : a ? [a] : []).flatMap((o) => addresses(o.value));

const MAX_INLINE = 3_000_000;

function toDetail(folder: FolderKey, uid: number, flags: Set<string>, parsed: ParsedMail, allowRemoteImages: boolean): MessageDetail {
  const cid = new Map<string, string>();
  for (const att of parsed.attachments) {
    const id = (att.cid ?? att.contentId ?? "").replace(/^<|>$/g, "");
    if (id && att.contentType.startsWith("image/") && att.size <= MAX_INLINE) {
      cid.set(id, `data:${att.contentType};base64,${att.content.toString("base64")}`);
    }
  }
  const safe = typeof parsed.html === "string" ? sanitizeEmailHtml(parsed.html, { allowRemoteImages, cid }) : null;
  const html = safe?.html ?? null;
  const attachments: AttachmentInfo[] = parsed.attachments.map((att, index) => {
    const id = (att.cid ?? att.contentId ?? "").replace(/^<|>$/g, "");
    return {
      index,
      filename: att.filename || `attachment-${index + 1}`,
      contentType: att.contentType,
      size: att.size,
      inline: Boolean(id && cid.has(id) && parsed.html && String(parsed.html).includes(id)),
    };
  });
  const date = parsed.date ?? new Date(0);
  return {
    folder,
    uid,
    from: list(parsed.from)[0] ?? null,
    to: list(parsed.to),
    cc: list(parsed.cc),
    replyTo: list(parsed.replyTo)[0] ?? null,
    subject: parsed.subject?.trim() || "(no subject)",
    date: date.toISOString(),
    seen: true,
    flagged: flags.has("\\Flagged"),
    draft: flags.has("\\Draft") || folder === "drafts",
    hasAttachments: attachments.some((a) => !a.inline),
    messageId: parsed.messageId ?? null,
    references: Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [],
    html,
    text: parsed.text ?? "",
    attachments,
    blockedImages: safe?.blockedImages ?? 0,
  };
}

export async function getMessage(folder: FolderKey, uid: number, allowRemoteImages = false): Promise<MessageDetail> {
  return withMail(async (client) => {
    const path = await pathFor(client, folder);
    const { source, flags } = await downloadSource(client, path, uid, true);
    return toDetail(folder, uid, flags, await simpleParser(source), allowRemoteImages);
  });
}

export async function getAttachment(folder: FolderKey, uid: number, index: number) {
  return withMail(async (client) => {
    const path = await pathFor(client, folder);
    const { source } = await downloadSource(client, path, uid, false);
    const att = (await simpleParser(source)).attachments[index];
    if (!att) throw new MailError("That attachment is no longer available.");
    return { filename: att.filename || `attachment-${index + 1}`, contentType: att.contentType, content: att.content };
  });
}

/* ----------------------------------------------------------------- changes */

const clean = (uids: number[]) => [...new Set(uids.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);

export async function setFlag(folder: FolderKey, uids: number[], flag: "\\Seen" | "\\Flagged", on: boolean) {
  const ids = clean(uids);
  if (!ids.length) return;
  await withMail(async (client) => {
    const lock = await client.getMailboxLock(await pathFor(client, folder));
    try {
      if (on) await client.messageFlagsAdd(ids, [flag], { uid: true });
      else await client.messageFlagsRemove(ids, [flag], { uid: true });
    } finally {
      lock.release();
    }
  });
}

export async function moveMessages(folder: FolderKey, uids: number[], to: FolderKey) {
  const ids = clean(uids);
  if (!ids.length || folder === to) return;
  await withMail(async (client) => {
    const destination = await pathFor(client, to, to === "archive");
    const lock = await client.getMailboxLock(await pathFor(client, folder));
    try {
      const moved = await client.messageMove(ids, destination, { uid: true });
      if (!moved) throw new MailError("The mail server did not move the messages.");
    } finally {
      lock.release();
    }
  });
}

/** Erases messages for good, bypassing trash. */
async function expunge(folder: FolderKey, uids: number[]) {
  const ids = clean(uids);
  if (!ids.length) return;
  await withMail(async (client) => {
    const lock = await client.getMailboxLock(await pathFor(client, folder));
    try {
      await client.messageDelete(ids, { uid: true });
    } finally {
      lock.release();
    }
  });
}

/** Trash and spam are emptied for good; anywhere else, delete means move to trash. */
export async function deleteMessages(folder: FolderKey, uids: number[]) {
  if (folder === "trash" || folder === "spam") return expunge(folder, uids);
  return moveMessages(folder, uids, "trash");
}

export async function emptyFolder(folder: "trash" | "spam") {
  await withMail(async (client) => {
    const lock = await client.getMailboxLock(await pathFor(client, folder));
    try {
      await client.messageDelete({ all: true });
    } finally {
      lock.release();
    }
  });
}

/** Stores a raw message in Drafts or Sent. Returns its UID when the server reports one. */
export async function appendRaw(folder: "drafts" | "sent", raw: Buffer, replaceUid?: number): Promise<number | undefined> {
  return withMail(async (client) => {
    const path = await pathFor(client, folder, true);
    const flags = folder === "drafts" ? ["\\Draft", "\\Seen"] : ["\\Seen"];
    const stored = await client.append(path, raw, flags);
    if (replaceUid) {
      const lock = await client.getMailboxLock(path);
      try {
        await client.messageDelete([replaceUid], { uid: true });
      } finally {
        lock.release();
      }
    }
    return stored ? stored.uid : undefined;
  });
}

/** Removes a draft once it has been sent. Failure is not worth stopping for. */
export async function discardDraft(uid: number) {
  await expunge("drafts", [uid]).catch(() => undefined);
}
