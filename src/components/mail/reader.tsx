"use client";

import * as React from "react";
import { Archive, ArrowLeft, Download, Forward, Inbox, MailOpen, OctagonAlert, Paperclip, Pencil, Reply, ReplyAll, Star, Trash2 } from "lucide-react";
import { fileSize, fullDate, readerDocument } from "@/components/mail/format";
import { displayName, formatAddress } from "@/lib/mail/addresses";
import type { FolderKey, MessageDetail } from "@/lib/mail/types";
import { cn } from "@/lib/utils";

export type ReaderAction =
  | "reply"
  | "replyAll"
  | "forward"
  | "edit"
  | "star"
  | "archive"
  | "spam"
  | "notSpam"
  | "inbox"
  | "trash"
  | "delete"
  | "unread";

const recipients = (list: MessageDetail["to"]) => list.map(formatAddress).join(", ");

export function Reader({
  message,
  onAction,
  onBack,
  onLoadImages,
  loadingImages,
}: {
  message: MessageDetail;
  onAction: (action: ReaderAction) => void;
  onBack: () => void;
  onLoadImages: () => void;
  loadingImages: boolean;
}) {
  const folder: FolderKey = message.folder;
  const showingImages = message.blockedImages === 0;
  const doc = React.useMemo(
    () => readerDocument({ html: message.html, text: message.text, showImages: showingImages }),
    [message.html, message.text, showingImages],
  );
  const files = message.attachments.filter((a) => !a.inline);

  const btn = (label: string, icon: React.ReactNode, action: ReaderAction, tone: "plain" | "danger" = "plain") => (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => onAction(action)}
      className={cn(
        "grid size-9 place-items-center rounded transition-colors hover:bg-[var(--paper-sunken)]",
        tone === "danger" ? "text-clay-700" : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
      )}
    >
      {icon}
    </button>
  );

  return (
    <article className="flex h-full min-h-0 flex-col" aria-label={message.subject}>
      <div className="flex items-center gap-0.5 border-b border-[var(--line)] px-3 py-1.5">
        <button type="button" onClick={onBack} aria-label="Back to the list" className="mr-1 grid size-9 place-items-center rounded text-[var(--ink-muted)] hover:bg-[var(--paper-sunken)] lg:hidden">
          <ArrowLeft className="size-4" />
        </button>
        {folder === "drafts" ? btn("Edit draft", <Pencil className="size-4" />, "edit") : null}
        {folder !== "drafts" ? (
          <>
            {btn("Reply", <Reply className="size-4" />, "reply")}
            {btn("Reply all", <ReplyAll className="size-4" />, "replyAll")}
            {btn("Forward", <Forward className="size-4" />, "forward")}
            <span aria-hidden className="mx-1 h-5 w-px bg-[var(--line)]" />
          </>
        ) : null}
        {btn(message.flagged ? "Remove star" : "Add star", <Star className={cn("size-4", message.flagged && "fill-sun-500 text-sun-600")} />, "star")}
        {folder !== "archive" ? btn("Archive", <Archive className="size-4" />, "archive") : null}
        {folder === "spam" ? btn("Not spam", <Inbox className="size-4" />, "notSpam") : folder !== "drafts" && folder !== "sent" ? btn("Report spam", <OctagonAlert className="size-4" />, "spam") : null}
        {folder === "archive" || folder === "trash" ? btn("Move to inbox", <Inbox className="size-4" />, "inbox") : null}
        {btn("Mark as unread", <MailOpen className="size-4" />, "unread")}
        <span className="ml-auto" />
        {folder === "trash" || folder === "spam"
          ? btn("Delete forever", <Trash2 className="size-4" />, "delete", "danger")
          : btn("Move to trash", <Trash2 className="size-4" />, "trash", "danger")}
      </div>

      <header className="border-b border-[var(--line)] px-5 py-4">
        <h2 className="text-lg font-semibold leading-snug">{message.subject}</h2>
        <div className="mt-3 flex items-start justify-between gap-4 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {displayName(message.from)}
              {message.from?.name ? <span className="ml-2 font-normal text-[var(--ink-faint)]">&lt;{message.from.address}&gt;</span> : null}
            </p>
            <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]" title={recipients(message.to)}>
              To: {message.to.length ? recipients(message.to) : "undisclosed recipients"}
            </p>
            {message.cc.length ? (
              <p className="truncate text-xs text-[var(--ink-muted)]" title={recipients(message.cc)}>
                Cc: {recipients(message.cc)}
              </p>
            ) : null}
          </div>
          <time className="shrink-0 text-xs text-[var(--ink-faint)]" dateTime={message.date}>
            {fullDate(message.date)}
          </time>
        </div>
      </header>

      {message.blockedImages > 0 ? (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-sun-300/20 px-5 py-2 text-xs">
          <span>Images are hidden to protect your privacy. Senders can see when you load them.</span>
          <button type="button" onClick={onLoadImages} disabled={loadingImages} className="shrink-0 font-medium text-lake-700 hover:underline disabled:opacity-60">
            {loadingImages ? "Loading…" : "Show images"}
          </button>
        </div>
      ) : null}

      {/* No scripts and no same-origin access: the message can only be looked at. */}
      <iframe
        title={`Message: ${message.subject}`}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        srcDoc={doc}
        className="min-h-0 w-full flex-1 border-0 bg-white"
      />

      {files.length ? (
        <footer className="border-t border-[var(--line)] px-5 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)]">
            <Paperclip className="size-3.5" />
            {files.length} {files.length === 1 ? "attachment" : "attachments"}
          </p>
          <ul className="flex flex-wrap gap-2">
            {files.map((a) => (
              <li key={a.index}>
                <a
                  href={`/admin/mail/attachment?folder=${message.folder}&uid=${message.uid}&index=${a.index}`}
                  className="flex items-center gap-2 rounded border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-xs transition-colors hover:border-[var(--line-strong)]"
                >
                  <Download className="size-3.5 text-[var(--ink-faint)]" />
                  <span className="max-w-[14rem] truncate">{a.filename}</span>
                  <span className="text-[var(--ink-faint)]">{fileSize(a.size)}</span>
                </a>
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
    </article>
  );
}
