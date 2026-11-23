/** Shared shapes for the admin mailbox. Plain data only, so they cross the server/client boundary. */

export const FOLDER_KEYS = ["inbox", "sent", "drafts", "spam", "archive", "trash"] as const;
export type FolderKey = (typeof FOLDER_KEYS)[number];

/** What the sidebar can open: a real folder, or a search that spans folders. */
export type View = FolderKey | "unread" | "starred";

export type Folder = {
  key: FolderKey;
  /** The server's own path, which varies by provider ("INBOX", "Sent Items"...). */
  path: string;
  total: number;
  unread: number;
};

export type Address = { name: string; address: string };

export type MessageSummary = {
  /** Which real folder it lives in; a "starred" view mixes several. */
  folder: FolderKey;
  uid: number;
  from: Address | null;
  to: Address[];
  subject: string;
  /** ISO timestamp. */
  date: string;
  seen: boolean;
  flagged: boolean;
  draft: boolean;
  hasAttachments: boolean;
};

export type AttachmentInfo = {
  /** Position in the parsed message, used to download it. */
  index: number;
  filename: string;
  contentType: string;
  size: number;
  /** Shown in the body already (an embedded image), so not listed as a file. */
  inline: boolean;
};

export type MessageDetail = MessageSummary & {
  cc: Address[];
  replyTo: Address | null;
  messageId: string | null;
  references: string[];
  /** Sanitised HTML, or null when the message is plain text only. */
  html: string | null;
  text: string;
  attachments: AttachmentInfo[];
  /** Remote images removed from the HTML, so the reader can offer to load them. */
  blockedImages: number;
};

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

export type MailResult<T = void> =
  | { ok: true; data: T; warning?: string }
  | { ok: false; error: string };

export type ComposeInput = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  /** Sanitised HTML body. */
  html: string;
  inReplyTo?: string;
  references?: string[];
  /** The draft being edited, replaced when this is saved or sent. */
  draftUid?: number;
};
