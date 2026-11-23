import type { FolderKey, MessageSummary } from "@/lib/mail/types";

export const keyOf = (m: Pick<MessageSummary, "folder" | "uid">) => `${m.folder}:${m.uid}`;

/** Selected messages grouped by the folder they live in, since a starred view mixes several. */
export function groupByFolder(items: Pick<MessageSummary, "folder" | "uid">[]): Map<FolderKey, number[]> {
  const out = new Map<FolderKey, number[]>();
  for (const m of items) out.set(m.folder, [...(out.get(m.folder) ?? []), m.uid]);
  return out;
}

const zone = "Africa/Kigali";

/** Today's messages show a time, this year's a day and month, older ones the year. */
export function listDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() === 0) return "";
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: zone });
  if (day(d) === day(now)) return d.toLocaleTimeString("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit" });
  const sameYear = d.toLocaleDateString("en-GB", { timeZone: zone, year: "numeric" }) === now.toLocaleDateString("en-GB", { timeZone: zone, year: "numeric" });
  return d.toLocaleDateString("en-GB", { timeZone: zone, day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

export const fullDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: zone, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The page shown inside the reading pane's sandboxed frame. The frame has no
 * scripts and no same-origin access, and this adds a content policy on top:
 * nothing may load except images, and remote images only when the reader asked.
 */
export function readerDocument(opts: { html: string | null; text: string; showImages: boolean }) {
  const body = opts.html ?? `<div class="plain">${escapeHtml(opts.text)}</div>`;
  const images = opts.showImages ? "data: https: http:" : "data:";
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${images}; style-src 'unsafe-inline'">
<base target="_blank">
<style>
  html{color:#1b2420;background:#fff}
  body{margin:0;padding:20px 24px;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow-wrap:anywhere}
  img{max-width:100%;height:auto}
  table{max-width:100%}
  a{color:#0a4a7d}
  blockquote{margin:8px 0;padding-left:12px;border-left:2px solid #d4cdbf;color:#5b6660}
  pre,.plain{white-space:pre-wrap;font:inherit;margin:0}
</style></head><body>${body}</body></html>`;
}
