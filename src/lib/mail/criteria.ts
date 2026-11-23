import type { FolderKey, View } from "@/lib/mail/types";

/** The IMAP search for a view, with an optional free-text query. Plain data, so it can be tested. */
export type Criteria = {
  all?: true;
  seen?: boolean;
  flagged?: boolean;
  or?: Criteria[];
  subject?: string;
  from?: string;
  to?: string;
  body?: string;
};

export function textSearch(query: string): Criteria | null {
  const q = query.trim().slice(0, 100);
  if (!q) return null;
  return { or: [{ subject: q }, { from: q }, { to: q }, { body: q }] };
}

/** Which real folders a view reads, and the filter applied inside each. */
export function viewPlan(view: View): { folders: FolderKey[]; filter: Criteria } {
  switch (view) {
    case "unread":
      return { folders: ["inbox"], filter: { seen: false } };
    case "starred":
      // Spam and trash are left out: a starred message there is not something to act on.
      return { folders: ["inbox", "sent", "archive", "drafts"], filter: { flagged: true } };
    default:
      return { folders: [view], filter: { all: true } };
  }
}

/** The filter and the text query together. IMAP ANDs the keys of one search object. */
export function combine(filter: Criteria, query: string): Criteria {
  const text = textSearch(query);
  return text ? { ...filter, ...text } : filter;
}
