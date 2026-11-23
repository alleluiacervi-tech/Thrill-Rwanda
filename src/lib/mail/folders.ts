import type { FolderKey } from "@/lib/mail/types";

/** The few fields of a listed mailbox we need. Matches imapflow's list entries. */
export type ListedMailbox = {
  path: string;
  name?: string;
  specialUse?: string;
  flags?: Set<string> | string[];
  listed?: boolean;
  status?: { messages?: number; unseen?: number };
};

const SPECIAL_USE: Record<string, FolderKey> = {
  "\\Sent": "sent",
  "\\Drafts": "drafts",
  "\\Junk": "spam",
  "\\Trash": "trash",
  "\\Archive": "archive",
};

/** Providers differ in naming, so names are the fallback when the server flags nothing. */
const NAMES: Record<FolderKey, string[]> = {
  inbox: ["inbox"],
  sent: ["sent", "sent items", "sent mail", "sent messages"],
  drafts: ["drafts", "draft"],
  spam: ["spam", "junk", "junk e-mail", "junk email", "bulk mail"],
  archive: ["archive", "archives", "all mail"],
  trash: ["trash", "deleted", "deleted items", "deleted messages", "bin"],
};

/** The folder a mailbox plays, or null for a custom one we do not show. */
export function folderKeyFor(box: ListedMailbox): FolderKey | null {
  if (box.path.toUpperCase() === "INBOX") return "inbox";
  if (box.specialUse && SPECIAL_USE[box.specialUse]) return SPECIAL_USE[box.specialUse]!;
  const leaf = (box.name ?? box.path.split(/[/.]/).pop() ?? box.path).trim().toLowerCase();
  for (const [key, names] of Object.entries(NAMES) as [FolderKey, string[]][]) {
    if (names.includes(leaf)) return key;
  }
  return null;
}

/** One path per role. When two mailboxes claim a role, the server-flagged one wins. */
export function mapFolders<T extends ListedMailbox>(boxes: T[]): Partial<Record<FolderKey, T>> {
  const out: Partial<Record<FolderKey, T>> = {};
  const flagged = new Set<FolderKey>();
  for (const box of boxes) {
    const key = folderKeyFor(box);
    if (!key) continue;
    const byServer = Boolean(box.specialUse && SPECIAL_USE[box.specialUse]) || key === "inbox";
    if (!out[key] || (byServer && !flagged.has(key))) {
      out[key] = box;
      if (byServer) flagged.add(key);
    }
  }
  return out;
}
