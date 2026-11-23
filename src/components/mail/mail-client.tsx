"use client";

import * as React from "react";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  FileText,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  OctagonAlert,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  SquarePen,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteMail,
  emptyMailFolder,
  loadFolders,
  loadMessages,
  markRead,
  markStarred,
  moveMail,
  openMessage,
} from "@/app/actions/mail";
import { Compose, type ComposeSeed } from "@/components/mail/compose";
import { groupByFolder, keyOf, listDate } from "@/components/mail/format";
import { Reader, type ReaderAction } from "@/components/mail/reader";
import { displayName, formatAddress, forwardSubject, quotedOriginal, replyRecipients, replySubject } from "@/lib/mail/addresses";
import type { Folder, FolderKey, MailResult, MessageDetail, MessageSummary, Page, View } from "@/lib/mail/types";
import { cn } from "@/lib/utils";

const NAV: { key: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "unread", label: "Unread", icon: Mail },
  { key: "starred", label: "Favorites", icon: Star },
  { key: "drafts", label: "Drafts", icon: FileText },
  { key: "sent", label: "Sent", icon: Send },
  { key: "spam", label: "Spam", icon: OctagonAlert },
  { key: "archive", label: "Archive", icon: Archive },
  { key: "trash", label: "Trash", icon: Trash2 },
];

const SIGNATURE = "<br><br>--<br>Thrill Rwanda<br>contact@thrillrwanda.com";
const REFRESH_MS = 60_000;

type Toast = { kind: "ok" | "error"; text: string };
type ComposeState = { id: number; seed: ComposeSeed; files: File[] };

const blank: ComposeSeed = { to: "", cc: "", bcc: "", subject: "", html: SIGNATURE };

/** Downloads a message's attached files so a forward or an edited draft keeps them. */
async function fetchAttachments(m: MessageDetail): Promise<File[]> {
  const out: File[] = [];
  for (const a of m.attachments.filter((x) => !x.inline)) {
    const res = await fetch(`/admin/mail/attachment?folder=${m.folder}&uid=${m.uid}&index=${a.index}`);
    if (!res.ok) throw new Error(`Could not load ${a.filename}.`);
    out.push(new File([await res.blob()], a.filename, { type: a.contentType }));
  }
  return out;
}

function IconButton({ label, onClick, disabled = false, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-8 place-items-center rounded text-[var(--ink-muted)] transition-colors hover:bg-[var(--paper-sunken)] hover:text-[var(--ink)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function MailClient({ address }: { address: string }) {
  const [folders, setFolders] = React.useState<Folder[] | null>(null);
  const [view, setView] = React.useState<View>("inbox");
  const [page, setPage] = React.useState(1);
  const [query, setQuery] = React.useState("");
  const [queryInput, setQueryInput] = React.useState("");
  const [loaded, setLoaded] = React.useState<{ key: string; page: Page<MessageSummary> | null; error: string | null }>({ key: "", page: null, error: null });
  const [reload, setReload] = React.useState(0);
  const [foldersReload, setFoldersReload] = React.useState(0);
  const [spinning, setSpinning] = React.useState(false);
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<MessageDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [loadingImages, setLoadingImages] = React.useState(false);
  const [compose, setCompose] = React.useState<ComposeState | null>(null);
  const [toast, setToast] = React.useState<Toast | null>(null);

  const openRequest = React.useRef(0);
  const composeId = React.useRef(0);

  const notify = React.useCallback((kind: Toast["kind"], text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 5000);
  }, []);

  // The list on screen is whatever last finished loading. It counts as loading
  // while it is for a different view, page or search than the one asked for.
  const key = `${view}|${page}|${query}`;
  const loading = loaded.key !== key || spinning;
  const list = loaded.page;
  const listError = loaded.error;

  const refreshFolders = React.useCallback(() => setFoldersReload((n) => n + 1), []);
  const refreshList = React.useCallback(() => setReload((n) => n + 1), []);
  const refreshAll = React.useCallback(() => {
    setReload((n) => n + 1);
    setFoldersReload((n) => n + 1);
  }, []);

  React.useEffect(() => {
    let live = true;
    void loadMessages(view, page, query).then((res) => {
      if (!live) return;
      setSpinning(false);
      if (!res.ok) return setLoaded((l) => ({ key, page: l.page, error: res.error }));
      // The last message of a page was removed: step back instead of showing an empty page.
      if (res.data.items.length === 0 && page > 1) return setPage(page - 1);
      setLoaded({ key, page: res.data, error: null });
    });
    return () => {
      live = false;
    };
  }, [view, page, query, key, reload]);

  React.useEffect(() => {
    let live = true;
    void loadFolders().then((res) => {
      if (live && res.ok) setFolders(res.data);
    });
    return () => {
      live = false;
    };
  }, [foldersReload]);

  // New mail turns up on its own while the tab is open and in view.
  React.useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshAll();
    }, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [refreshAll]);

  const patchList = (fn: (items: MessageSummary[]) => MessageSummary[]) =>
    setLoaded((l) => (l.page ? { ...l, page: { ...l.page, items: fn(l.page.items) } } : l));

  const folderOf = (key: FolderKey) => folders?.find((f) => f.key === key);
  const countFor = (key: View) => {
    if (key === "unread") return folderOf("inbox")?.unread ?? 0;
    if (key === "inbox" || key === "drafts" || key === "spam") return key === "drafts" ? (folderOf("drafts")?.total ?? 0) : (folderOf(key)?.unread ?? 0);
    return 0;
  };

  function changeView(next: View) {
    setView(next);
    setPage(1);
    setQuery("");
    setQueryInput("");
    setChecked(new Set());
    setOpenKey(null);
    setDetail(null);
  }

  async function open(item: MessageSummary) {
    const id = ++openRequest.current;
    setOpenKey(keyOf(item));
    setDetail(null);
    setDetailLoading(true);
    // A draft is opened with its images in place, since editing it must not lose them.
    const res = await openMessage(item.folder, item.uid, item.folder === "drafts");
    if (id !== openRequest.current) return;
    setDetailLoading(false);
    if (!res.ok) {
      setOpenKey(null);
      return notify("error", res.error);
    }
    setDetail(res.data);
    if (!item.seen) {
      patchList((items) => items.map((x) => (keyOf(x) === keyOf(item) ? { ...x, seen: true } : x)));
      refreshFolders();
    }
  }

  async function showImages() {
    if (!detail) return;
    setLoadingImages(true);
    const res = await openMessage(detail.folder, detail.uid, true);
    setLoadingImages(false);
    if (res.ok) setDetail(res.data);
    else notify("error", res.error);
  }

  function closeReader() {
    openRequest.current++;
    setOpenKey(null);
    setDetail(null);
  }

  /** Runs a change per folder, then brings the screen back in line with the mailbox. */
  async function apply(
    items: Pick<MessageSummary, "folder" | "uid">[],
    fn: (folder: FolderKey, ids: number[]) => Promise<MailResult>,
    done?: string,
  ) {
    for (const [f, ids] of groupByFolder(items)) {
      const res = await fn(f, ids);
      if (!res.ok) {
        notify("error", res.error);
        break;
      }
      if (done) notify("ok", done);
    }
    setChecked(new Set());
    refreshAll();
  }

  const selected = list?.items.filter((m) => checked.has(keyOf(m))) ?? [];
  const bulk = (fn: (folder: FolderKey, ids: number[]) => Promise<MailResult>, done: string) => {
    if (selected.some((m) => keyOf(m) === openKey)) closeReader();
    return apply(selected, fn, done);
  };

  async function toggleStar(item: MessageSummary) {
    const next = !item.flagged;
    patchList((items) => items.map((x) => (keyOf(x) === keyOf(item) ? { ...x, flagged: next } : x)));
    setDetail((d) => (d && keyOf(d) === keyOf(item) ? { ...d, flagged: next } : d));
    const res = await markStarred(item.folder, [item.uid], next);
    if (!res.ok) notify("error", res.error);
    refreshList();
  }

  function startCompose(seed: ComposeSeed, files: File[] = []) {
    if (compose) return notify("error", "Finish or close the message you are writing first.");
    setCompose({ id: ++composeId.current, seed, files });
  }

  async function onReaderAction(action: ReaderAction) {
    if (!detail) return;
    const item = { folder: detail.folder, uid: detail.uid };
    const mine = address.toLowerCase();

    if (action === "reply" || action === "replyAll") {
      const r = replyRecipients(detail, mine, action === "replyAll");
      return startCompose({
        to: r.to.map(formatAddress).join(", "),
        cc: r.cc.map(formatAddress).join(", "),
        bcc: "",
        subject: replySubject(detail.subject),
        html: `<p><br></p>${SIGNATURE}${quotedOriginal(detail, "reply")}`,
        inReplyTo: detail.messageId ?? undefined,
        references: [...detail.references, ...(detail.messageId ? [detail.messageId] : [])],
      });
    }
    if (action === "forward" || action === "edit") {
      let files: File[] = [];
      try {
        files = await fetchAttachments(detail);
      } catch (e) {
        return notify("error", e instanceof Error ? e.message : "Could not load the attachments.");
      }
      if (action === "forward") {
        return startCompose(
          { to: "", cc: "", bcc: "", subject: forwardSubject(detail.subject), html: `<p><br></p>${SIGNATURE}${quotedOriginal(detail, "forward")}` },
          files,
        );
      }
      return startCompose(
        {
          to: detail.to.map(formatAddress).join(", "),
          cc: detail.cc.map(formatAddress).join(", "),
          bcc: "",
          subject: detail.subject === "(no subject)" ? "" : detail.subject,
          html: detail.html ?? `<p>${detail.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`,
          draftUid: detail.uid,
        },
        files,
      );
    }
    if (action === "star") return toggleStar(detail);
    if (action === "unread") {
      closeReader();
      return apply([item], (f, ids) => markRead(f, ids, false), "Marked as unread.");
    }
    if (action === "delete" && !window.confirm("Delete this message forever? This cannot be undone.")) return;
    closeReader();
    if (action === "archive") return apply([item], (f, ids) => moveMail(f, ids, "archive"), "Archived.");
    if (action === "spam") return apply([item], (f, ids) => moveMail(f, ids, "spam"), "Moved to spam.");
    if (action === "notSpam" || action === "inbox") return apply([item], (f, ids) => moveMail(f, ids, "inbox"), "Moved to the inbox.");
    if (action === "trash") return apply([item], (f, ids) => deleteMail(f, ids), "Moved to trash.");
    if (action === "delete") return apply([item], (f, ids) => deleteMail(f, ids), "Deleted.");
  }

  async function emptyCurrent() {
    if (view !== "trash" && view !== "spam") return;
    if (!window.confirm(`Delete everything in ${view === "trash" ? "Trash" : "Spam"} forever? This cannot be undone.`)) return;
    const res = await emptyMailFolder(view);
    if (!res.ok) notify("error", res.error);
    else notify("ok", "Emptied.");
    closeReader();
    refreshAll();
  }

  const total = list?.total ?? 0;
  const from = total ? (page - 1) * (list?.pageSize ?? 25) + 1 : 0;
  const to = Math.min(total, page * (list?.pageSize ?? 25));
  const allChecked = Boolean(list?.items.length) && list!.items.every((m) => checked.has(keyOf(m)));
  const sentLike = view === "sent" || view === "drafts";
  const inTrashLike = view === "trash" || view === "spam";

  const composeButton = (
    <button
      type="button"
      onClick={() => startCompose(blank)}
      className="inline-flex h-10 items-center justify-center gap-2 rounded bg-forest-800 px-5 text-sm font-medium text-bone-50 transition-colors hover:bg-forest-900"
    >
      <SquarePen className="size-4" />
      Compose
    </button>
  );

  return (
    <div className="relative">
      <div className="grid h-[calc(100svh-12rem)] min-h-[34rem] overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] lg:grid-cols-[minmax(19rem,23rem)_minmax(0,1fr)] xl:grid-cols-[13.5rem_minmax(19rem,23rem)_minmax(0,1fr)]">
        {/* Folders: a column on wide screens, a strip above the list otherwise. */}
        <nav aria-label="Mail folders" className="hidden flex-col gap-1 border-r border-[var(--line)] bg-[var(--paper)] p-3 xl:flex">
          <div className="mb-2">{composeButton}</div>
          {NAV.map(({ key, label, icon: Icon }) => {
            const n = countFor(key);
            const active = view === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => changeView(key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded px-3 py-2 text-left text-sm transition-colors",
                  active ? "bg-forest-800 font-medium text-bone-50" : "text-[var(--ink-muted)] hover:bg-[var(--paper-sunken)] hover:text-[var(--ink)]",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {n ? <span className={cn("tnum text-xs", active ? "text-bone-50/80" : "font-semibold text-[var(--ink)]")}>{n}</span> : null}
              </button>
            );
          })}
          <p className="mt-auto truncate px-3 pt-4 text-2xs text-[var(--ink-faint)]" title={address}>
            {address}
          </p>
        </nav>

        {/* List */}
        <section aria-label="Messages" className={cn("min-h-0 min-w-0 flex-col border-r border-[var(--line)]", openKey ? "hidden lg:flex" : "flex")}>
          <div className="flex gap-1 overflow-x-auto border-b border-[var(--line)] p-2 xl:hidden">
            <div className="shrink-0">{composeButton}</div>
            {NAV.map(({ key, label, icon: Icon }) => {
              const n = countFor(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => changeView(key)}
                  aria-current={view === key ? "page" : undefined}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded px-3 text-xs transition-colors",
                    view === key ? "bg-forest-800 font-medium text-bone-50" : "text-[var(--ink-muted)] hover:bg-[var(--paper-sunken)]",
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                  {n ? <span className="tnum font-semibold">{n}</span> : null}
                </button>
              );
            })}
          </div>

          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setQuery(queryInput.trim());
            }}
            className="relative border-b border-[var(--line)] p-2"
          >
            <Search aria-hidden className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-faint)]" />
            <input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              aria-label="Search mail"
              placeholder="Search sender, subject or text"
              className="h-9 w-full rounded border border-[var(--line-strong)] bg-[var(--paper-raised)] pl-9 pr-8 text-sm outline-none focus-visible:border-lake-600"
            />
            {queryInput ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQueryInput("");
                  setQuery("");
                  setPage(1);
                }}
                className="absolute right-4 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-[var(--ink-faint)] hover:bg-[var(--paper-sunken)]"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </form>

          <div className="flex min-h-11 items-center gap-1 border-b border-[var(--line)] px-3">
            <input
              type="checkbox"
              aria-label="Select all on this page"
              checked={allChecked}
              onChange={(e) => setChecked(e.target.checked ? new Set(list?.items.map(keyOf)) : new Set())}
              className="size-4 accent-forest-800"
            />
            {selected.length ? (
              <div className="ml-2 flex items-center gap-0.5">
                <span className="mr-1 text-xs text-[var(--ink-muted)]">{selected.length} selected</span>
                {view !== "archive" && (
                  <IconButton label="Archive" onClick={() => bulk((f, ids) => moveMail(f, ids, "archive"), "Archived.")}>
                    <Archive className="size-4" />
                  </IconButton>
                )}
                {view === "spam" ? (
                  <IconButton label="Not spam" onClick={() => bulk((f, ids) => moveMail(f, ids, "inbox"), "Moved to the inbox.")}>
                    <Inbox className="size-4" />
                  </IconButton>
                ) : !sentLike ? (
                  <IconButton label="Report spam" onClick={() => bulk((f, ids) => moveMail(f, ids, "spam"), "Moved to spam.")}>
                    <OctagonAlert className="size-4" />
                  </IconButton>
                ) : null}
                {(view === "archive" || view === "trash") && (
                  <IconButton label="Move to inbox" onClick={() => bulk((f, ids) => moveMail(f, ids, "inbox"), "Moved to the inbox.")}>
                    <Inbox className="size-4" />
                  </IconButton>
                )}
                <IconButton label="Mark as read" onClick={() => bulk((f, ids) => markRead(f, ids, true), "Marked as read.")}>
                  <MailOpen className="size-4" />
                </IconButton>
                <IconButton label="Mark as unread" onClick={() => bulk((f, ids) => markRead(f, ids, false), "Marked as unread.")}>
                  <Mail className="size-4" />
                </IconButton>
                <IconButton
                  label={inTrashLike ? "Delete forever" : "Move to trash"}
                  onClick={() => {
                    if (inTrashLike && !window.confirm(`Delete ${selected.length} ${selected.length === 1 ? "message" : "messages"} forever? This cannot be undone.`)) return;
                    void bulk((f, ids) => deleteMail(f, ids), inTrashLike ? "Deleted." : "Moved to trash.");
                  }}
                >
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
            ) : (
              <>
                <IconButton
                  label="Refresh"
                  onClick={() => {
                    setSpinning(true);
                    refreshAll();
                  }}
                >
                  <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                </IconButton>
                {inTrashLike && total > 0 ? (
                  <button type="button" onClick={() => void emptyCurrent()} className="ml-1 text-xs font-medium text-clay-700 hover:underline">
                    Empty {view}
                  </button>
                ) : null}
              </>
            )}
            <span className="ml-auto flex items-center gap-1 text-xs text-[var(--ink-muted)]">
              <span className="tnum">{total ? `${from}–${to} of ${total}` : ""}</span>
              <IconButton label="Newer" onClick={() => setPage(page - 1)} disabled={page <= 1}>
                <ChevronLeft className="size-4" />
              </IconButton>
              <IconButton label="Older" onClick={() => setPage(page + 1)} disabled={to >= total}>
                <ChevronRight className="size-4" />
              </IconButton>
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {listError ? (
              <div role="alert" className="m-4 rounded border border-clay-300 bg-clay-100 p-4 text-sm text-clay-800">
                <p>{listError}</p>
                <button type="button" onClick={() => refreshList()} className="mt-2 font-medium underline">
                  Try again
                </button>
              </div>
            ) : loading && !list ? (
              <p className="flex items-center gap-2 p-5 text-sm text-[var(--ink-muted)]">
                <Loader2 className="size-4 animate-spin" /> Loading your mail…
              </p>
            ) : list && list.items.length === 0 ? (
              <p className="p-8 text-center text-sm text-[var(--ink-muted)]">
                {query ? "Nothing matches that search." : view === "unread" ? "You are all caught up." : "Nothing here."}
              </p>
            ) : (
              <ul className={cn(loading && "pointer-events-none opacity-60 transition-opacity")}>
                {list?.items.map((m) => {
                  const key = keyOf(m);
                  const active = key === openKey;
                  const who = sentLike ? `To: ${m.to.map(displayName).join(", ") || "no recipient"}` : displayName(m.from);
                  return (
                    <li key={key} className={cn("flex items-start gap-1 border-b border-[var(--line)] pl-3 pr-2 transition-colors", active ? "bg-forest-100/60" : "hover:bg-[var(--paper-sunken)]")}>
                      <input
                        type="checkbox"
                        aria-label={`Select message from ${who}`}
                        checked={checked.has(key)}
                        onChange={(e) =>
                          setChecked((c) => {
                            const next = new Set(c);
                            if (e.target.checked) next.add(key);
                            else next.delete(key);
                            return next;
                          })
                        }
                        className="mt-4 size-4 shrink-0 accent-forest-800"
                      />
                      <button
                        type="button"
                        aria-label={m.flagged ? "Remove star" : "Add star"}
                        onClick={() => void toggleStar(m)}
                        className="mt-2.5 grid size-7 shrink-0 place-items-center rounded text-[var(--ink-faint)] hover:text-sun-600"
                      >
                        <Star className={cn("size-4", m.flagged && "fill-sun-500 text-sun-600")} />
                      </button>
                      <button type="button" onClick={() => void open(m)} className="min-w-0 flex-1 py-2.5 pl-1 text-left">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn("truncate text-sm", !m.seen ? "font-semibold" : "text-[var(--ink-muted)]")}>{who}</span>
                          <span className="tnum shrink-0 text-2xs text-[var(--ink-faint)]">{listDate(m.date)}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          {!m.seen ? <span aria-label="Unread" className="size-1.5 shrink-0 rounded-full bg-lake-600" /> : null}
                          <span className={cn("truncate text-sm", !m.seen ? "font-medium text-[var(--ink)]" : "text-[var(--ink-muted)]")}>{m.subject}</span>
                          {m.hasAttachments ? <Paperclip aria-label="Has attachments" className="size-3.5 shrink-0 text-[var(--ink-faint)]" /> : null}
                          {m.draft && view === "starred" ? <span className="shrink-0 text-2xs text-clay-700">Draft</span> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Reader */}
        <section aria-label="Message" className={cn("min-h-0 min-w-0 flex-col bg-[var(--paper-raised)]", openKey ? "flex" : "hidden lg:flex")}>
          {detail ? (
            <Reader message={detail} onAction={(a) => void onReaderAction(a)} onBack={closeReader} onLoadImages={() => void showImages()} loadingImages={loadingImages} />
          ) : detailLoading ? (
            <p className="flex items-center gap-2 p-6 text-sm text-[var(--ink-muted)]">
              <Loader2 className="size-4 animate-spin" /> Opening…
            </p>
          ) : (
            <div className="m-auto max-w-xs p-8 text-center text-[var(--ink-muted)]">
              <Mail className="mx-auto size-8 text-[var(--ink-faint)]" aria-hidden />
              <p className="mt-3 text-sm">Select a message to read it.</p>
            </div>
          )}
        </section>
      </div>

      {toast ? (
        <p
          role={toast.kind === "error" ? "alert" : "status"}
          className={cn(
            "fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded px-4 py-2.5 text-sm font-medium shadow-lg",
            toast.kind === "error" ? "bg-clay-700 text-bone-50" : "bg-forest-900 text-bone-50",
          )}
        >
          {toast.text}
        </p>
      ) : null}

      {compose ? (
        <Compose
          key={compose.id}
          seed={compose.seed}
          initialFiles={compose.files}
          onClose={() => setCompose(null)}
          onSent={(warning) => {
            setCompose(null);
            notify(warning ? "error" : "ok", warning ?? "Message sent.");
            refreshAll();
          }}
          onDraftChanged={() => {
            refreshFolders();
            if (view === "drafts") refreshList();
          }}
        />
      ) : null}
    </div>
  );
}
