"use server";

import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { mailActor } from "@/lib/mail/access";
import { mailConfig } from "@/lib/mail/config";
import {
  deleteMessages,
  describeMailError,
  emptyFolder,
  getMessage,
  listFolders,
  listMessages,
  moveMessages,
  setFlag,
} from "@/lib/mail/imap";
import {
  FOLDER_KEYS,
  type Folder,
  type MailResult,
  type MessageDetail,
  type MessageSummary,
  type Page,
  type View,
} from "@/lib/mail/types";

/**
 * Every mailbox action the admin screen can ask for. Each one checks the
 * caller is an administrator, validates its input, and answers with a result
 * the screen can show, rather than throwing at the browser.
 */

const folderKey = z.enum(FOLDER_KEYS);
const view = z.enum([...FOLDER_KEYS, "unread", "starred"]);
const uids = z.array(z.number().int().positive()).min(1).max(500);

async function run<T>(fn: (actorId: string) => Promise<T>): Promise<MailResult<T>> {
  const actor = await mailActor();
  if (!actor) return { ok: false, error: "Your session has ended. Sign in again." };
  if (!mailConfig()) return { ok: false, error: "The mailbox is not connected yet." };
  try {
    return { ok: true, data: await fn(actor.id) };
  } catch (err) {
    return { ok: false, error: describeMailError(err) };
  }
}

const invalid: MailResult<never> = { ok: false, error: "That request was not understood." };

export async function loadFolders(): Promise<MailResult<Folder[]>> {
  return run(() => listFolders());
}

export async function loadMessages(v: View, page: number, query: string): Promise<MailResult<Page<MessageSummary>>> {
  const parsed = z.object({ v: view, page: z.number().int().min(1), query: z.string().max(200) }).safeParse({ v, page, query });
  if (!parsed.success) return invalid;
  return run(() => listMessages(parsed.data.v, parsed.data.page, parsed.data.query));
}

export async function openMessage(folder: string, uid: number, showImages = false): Promise<MailResult<MessageDetail>> {
  const parsed = z.object({ folder: folderKey, uid: z.number().int().positive() }).safeParse({ folder, uid });
  if (!parsed.success) return invalid;
  return run(() => getMessage(parsed.data.folder, parsed.data.uid, showImages));
}

export async function markRead(folder: string, ids: number[], read: boolean): Promise<MailResult> {
  const parsed = z.object({ folder: folderKey, ids: uids }).safeParse({ folder, ids });
  if (!parsed.success) return invalid;
  return run(async () => setFlag(parsed.data.folder, parsed.data.ids, "\\Seen", read));
}

export async function markStarred(folder: string, ids: number[], starred: boolean): Promise<MailResult> {
  const parsed = z.object({ folder: folderKey, ids: uids }).safeParse({ folder, ids });
  if (!parsed.success) return invalid;
  return run(async () => setFlag(parsed.data.folder, parsed.data.ids, "\\Flagged", starred));
}

export async function moveMail(folder: string, ids: number[], to: string): Promise<MailResult> {
  const parsed = z.object({ folder: folderKey, ids: uids, to: folderKey }).safeParse({ folder, ids, to });
  if (!parsed.success) return invalid;
  return run(async () => moveMessages(parsed.data.folder, parsed.data.ids, parsed.data.to));
}

export async function deleteMail(folder: string, ids: number[]): Promise<MailResult> {
  const parsed = z.object({ folder: folderKey, ids: uids }).safeParse({ folder, ids });
  if (!parsed.success) return invalid;
  const { folder: from, ids: list } = parsed.data;
  return run(async (actorId) => {
    await deleteMessages(from, list);
    // Only an erasure that cannot be undone is worth a line in the log.
    if (from === "trash" || from === "spam") {
      await logActivity(actorId, {
        action: "mail.delete",
        area: "Mail",
        target: "Mailbox",
        summary: `Permanently deleted ${list.length} ${list.length === 1 ? "message" : "messages"} from ${from}.`,
      });
    }
  });
}

export async function emptyMailFolder(folder: string): Promise<MailResult> {
  const parsed = z.enum(["trash", "spam"]).safeParse(folder);
  if (!parsed.success) return invalid;
  return run(async (actorId) => {
    await emptyFolder(parsed.data);
    await logActivity(actorId, { action: "mail.empty", area: "Mail", target: "Mailbox", summary: `Emptied the ${parsed.data} folder.` });
  });
}
