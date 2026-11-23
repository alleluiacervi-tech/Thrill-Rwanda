"use client";

import * as React from "react";
import { Bold, Italic, Link2, List, ListOrdered, Loader2, Paperclip, RemoveFormatting, Underline, X } from "lucide-react";
import { fileSize } from "@/components/mail/format";
import { cn } from "@/lib/utils";
import type { MailResult } from "@/lib/mail/types";

/** What the composer opens with: blank, a reply, a forward, or a saved draft. */
export type ComposeSeed = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  html: string;
  inReplyTo?: string;
  references?: string[];
  draftUid?: number;
};

const MAX_TOTAL = 20 * 1024 * 1024;
const AUTOSAVE_MS = 20_000;

const field =
  "w-full min-w-0 border-0 border-b border-[var(--line)] bg-transparent py-2 text-sm outline-none transition-colors focus:border-lake-600";

async function post(intent: "send" | "draft", seed: ComposeSeed, html: string, files: File[], draftUid?: number): Promise<MailResult<{ uid?: number | null }>> {
  const form = new FormData();
  form.set("intent", intent);
  form.set("to", seed.to);
  form.set("cc", seed.cc);
  form.set("bcc", seed.bcc);
  form.set("subject", seed.subject);
  form.set("html", html);
  if (seed.inReplyTo) form.set("inReplyTo", seed.inReplyTo);
  if (seed.references?.length) form.set("references", seed.references.join(" "));
  if (draftUid) form.set("draftUid", String(draftUid));
  for (const f of files) form.append("files", f, f.name);
  try {
    const res = await fetch("/admin/mail/compose", { method: "POST", body: form });
    return (await res.json()) as MailResult<{ uid?: number | null }>;
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection and try again." };
  }
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Keep the selection in the editor while the button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="grid size-8 place-items-center rounded text-[var(--ink-muted)] transition-colors hover:bg-[var(--paper-sunken)] hover:text-[var(--ink)]"
    >
      {children}
    </button>
  );
}

export function Compose({
  seed,
  initialFiles,
  onClose,
  onSent,
  onDraftChanged,
}: {
  seed: ComposeSeed;
  /** Files carried over from a draft or a forwarded message. */
  initialFiles: File[];
  onClose: () => void;
  onSent: (warning?: string) => void;
  /** A draft was saved or discarded, so the Drafts count and list are stale. */
  onDraftChanged: () => void;
}) {
  const [to, setTo] = React.useState(seed.to);
  const [cc, setCc] = React.useState(seed.cc);
  const [bcc, setBcc] = React.useState(seed.bcc);
  const [showCc, setShowCc] = React.useState(Boolean(seed.cc || seed.bcc));
  const [subject, setSubject] = React.useState(seed.subject);
  const [files, setFiles] = React.useState<File[]>(initialFiles);
  const [error, setError] = React.useState<string | null>(null);
  const [state, setState] = React.useState<"idle" | "sending" | "saving">("idle");
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  const editor = React.useRef<HTMLDivElement>(null);
  const draftUid = React.useRef<number | undefined>(seed.draftUid);
  const dirty = React.useRef(false);
  const busy = React.useRef(false);

  // The editor is uncontrolled: React must not re-render over what is being typed.
  React.useEffect(() => {
    if (editor.current) editor.current.innerHTML = seed.html;
    editor.current?.focus();
    // Put the caret at the very top, above any quoted text.
    const sel = window.getSelection();
    if (sel && editor.current) {
      const range = document.createRange();
      range.setStart(editor.current, 0);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [seed.html]);

  const current = React.useCallback(
    () => ({ ...seed, to, cc, bcc, subject, html: editor.current?.innerHTML ?? "" }),
    [seed, to, cc, bcc, subject],
  );

  const save = React.useCallback(
    async (quiet: boolean) => {
      if (busy.current) return;
      busy.current = true;
      setState("saving");
      const c = current();
      const res = await post("draft", c, c.html, files, draftUid.current);
      busy.current = false;
      setState("idle");
      if (res.ok) {
        if (res.data.uid) draftUid.current = res.data.uid;
        dirty.current = false;
        setSavedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" }));
        setError(null);
        onDraftChanged();
      } else if (!quiet) setError(res.error);
    },
    [current, files, onDraftChanged],
  );

  // Autosave a while after the last change, like any mail app.
  React.useEffect(() => {
    if (!dirty.current) return;
    const t = window.setTimeout(() => void save(true), AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [to, cc, bcc, subject, files, save]);

  const touch = () => {
    dirty.current = true;
  };

  const total = files.reduce((n, f) => n + f.size, 0);

  async function send() {
    if (busy.current) return;
    const c = current();
    if (!c.to.trim()) return setError("Add at least one recipient.");
    const plain = (editor.current?.innerText ?? "").trim();
    if (!c.subject.trim() && !plain && !window.confirm("Send this message without a subject or text?")) return;
    if (!c.subject.trim() && plain && !window.confirm("Send this message without a subject?")) return;
    busy.current = true;
    setState("sending");
    setError(null);
    const res = await post("send", c, c.html, files, draftUid.current);
    busy.current = false;
    setState("idle");
    if (!res.ok) return setError(res.error);
    dirty.current = false;
    onSent(res.warning);
  }

  async function discard() {
    const hasContent = dirty.current || (editor.current?.innerText ?? "").trim() || to.trim() || subject.trim();
    if (hasContent && !draftUid.current && !window.confirm("Discard this message?")) return;
    onClose();
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)];
    if (next.reduce((n, f) => n + f.size, 0) > MAX_TOTAL) return setError("Attachments can total 20 MB at most.");
    if (next.length > 15) return setError("Attach 15 files at most.");
    setError(null);
    setFiles(next);
    touch();
  }

  const run = (command: string, value?: string) => {
    editor.current?.focus();
    document.execCommand(command, false, value);
    touch();
  };
  const link = () => {
    const url = window.prompt("Link address (https://…)");
    if (!url) return;
    if (!/^(https?:\/\/|mailto:)/i.test(url)) return setError("Links must start with https:// or mailto:");
    run("createLink", url);
  };

  return (
    <div
      role="dialog"
      aria-label="New message"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          void send();
        }
      }}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--paper-raised)] sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[min(42rem,calc(100svh-2rem))] sm:w-[42rem] sm:max-w-[calc(100vw-2rem)] sm:rounded-lg sm:border sm:border-[var(--line-strong)] sm:shadow-2xl"
    >
      <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-forest-900 px-4 py-2.5 text-bone-50 sm:rounded-t-lg">
        <p className="truncate text-sm font-medium">{subject.trim() || "New message"}</p>
        <button type="button" onClick={() => void discard()} aria-label="Close" className="grid size-7 place-items-center rounded hover:bg-bone-50/10">
          <X className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <div className="flex items-center gap-2">
          <label htmlFor="mail-to" className="w-10 shrink-0 text-xs text-[var(--ink-faint)]">To</label>
          <input id="mail-to" value={to} onChange={(e) => { setTo(e.target.value); touch(); }} className={field} placeholder="name@example.com, another@example.com" autoComplete="off" />
          {!showCc ? (
            <button type="button" onClick={() => setShowCc(true)} className="shrink-0 text-xs font-medium text-lake-700 hover:underline">
              Cc / Bcc
            </button>
          ) : null}
        </div>
        {showCc ? (
          <>
            <div className="flex items-center gap-2">
              <label htmlFor="mail-cc" className="w-10 shrink-0 text-xs text-[var(--ink-faint)]">Cc</label>
              <input id="mail-cc" value={cc} onChange={(e) => { setCc(e.target.value); touch(); }} className={field} autoComplete="off" />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="mail-bcc" className="w-10 shrink-0 text-xs text-[var(--ink-faint)]">Bcc</label>
              <input id="mail-bcc" value={bcc} onChange={(e) => { setBcc(e.target.value); touch(); }} className={field} autoComplete="off" />
            </div>
          </>
        ) : null}
        <div className="flex items-center gap-2">
          <label htmlFor="mail-subject" className="w-10 shrink-0 text-xs text-[var(--ink-faint)]">Subject</label>
          <input id="mail-subject" value={subject} onChange={(e) => { setSubject(e.target.value); touch(); }} className={field} maxLength={300} />
        </div>

        <div className="my-2 flex flex-wrap items-center gap-0.5 border-b border-[var(--line)] pb-2">
          <ToolButton label="Bold" onClick={() => run("bold")}>
            <Bold className="size-4" />
          </ToolButton>
          <ToolButton label="Italic" onClick={() => run("italic")}>
            <Italic className="size-4" />
          </ToolButton>
          <ToolButton label="Underline" onClick={() => run("underline")}>
            <Underline className="size-4" />
          </ToolButton>
          <span aria-hidden className="mx-1 h-5 w-px bg-[var(--line)]" />
          <ToolButton label="Bulleted list" onClick={() => run("insertUnorderedList")}>
            <List className="size-4" />
          </ToolButton>
          <ToolButton label="Numbered list" onClick={() => run("insertOrderedList")}>
            <ListOrdered className="size-4" />
          </ToolButton>
          <ToolButton label="Add link" onClick={link}>
            <Link2 className="size-4" />
          </ToolButton>
          <ToolButton label="Clear formatting" onClick={() => run("removeFormat")}>
            <RemoveFormatting className="size-4" />
          </ToolButton>
        </div>

        <div
          ref={editor}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Message"
          onInput={touch}
          // Pasting brings other pages' styling along; plain text keeps messages clean.
          onPaste={(e) => {
            e.preventDefault();
            document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
          }}
          className="min-h-48 pb-4 text-sm leading-relaxed outline-none [&_a]:text-lake-700 [&_a]:underline [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--line-strong)] [&_blockquote]:pl-3 [&_ol]:ml-5 [&_ol]:list-decimal [&_ul]:ml-5 [&_ul]:list-disc"
        />

        {files.length ? (
          <ul className="flex flex-wrap gap-2 pb-3">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded border border-[var(--line)] bg-[var(--paper)] py-1 pl-2.5 pr-1 text-xs">
                <Paperclip className="size-3.5 text-[var(--ink-faint)]" />
                <span className="max-w-[10rem] truncate">{f.name}</span>
                <span className="text-[var(--ink-faint)]">{fileSize(f.size)}</span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => { setFiles(files.filter((_, j) => j !== i)); touch(); }} className="grid size-5 place-items-center rounded hover:bg-[var(--paper-sunken)]">
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="border-t border-clay-300 bg-clay-100 px-4 py-2 text-xs font-medium text-clay-800">
          {error}
        </p>
      ) : null}

      <footer className="flex items-center gap-2 border-t border-[var(--line)] px-4 py-3">
        <button
          type="button"
          onClick={() => void send()}
          disabled={state !== "idle"}
          className="inline-flex h-9 items-center gap-2 rounded bg-forest-800 px-5 text-sm font-medium text-bone-50 transition-colors hover:bg-forest-900 disabled:opacity-60"
        >
          {state === "sending" ? <Loader2 className="size-4 animate-spin" /> : null}
          {state === "sending" ? "Sending…" : "Send"}
        </button>
        <label className="grid size-9 cursor-pointer place-items-center rounded text-[var(--ink-muted)] transition-colors hover:bg-[var(--paper-sunken)]" title="Attach files">
          <Paperclip className="size-4" />
          <span className="sr-only">Attach files</span>
          <input type="file" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </label>
        <button type="button" onClick={() => void save(false)} disabled={state !== "idle"} className="h-9 rounded px-3 text-sm text-[var(--ink-muted)] transition-colors hover:bg-[var(--paper-sunken)] disabled:opacity-60">
          {state === "saving" ? "Saving…" : "Save draft"}
        </button>
        <span className={cn("ml-auto truncate text-xs text-[var(--ink-faint)]", !savedAt && !total && "hidden")}>
          {total ? `${fileSize(total)} attached` : ""}
          {total && savedAt ? " · " : ""}
          {savedAt ? `Draft saved ${savedAt}` : ""}
        </span>
      </footer>
    </div>
  );
}
