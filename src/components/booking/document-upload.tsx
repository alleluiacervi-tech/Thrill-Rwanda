"use client";

import * as React from "react";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadedDocument = { id: string; fileName: string };

// Phone photos are often 4–8 MB; this keeps them sharp enough to read and well under the limit.
const MAX_SIDE = 2000;

async function shrinkPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size < 900_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    // An image the browser can't decode (e.g. HEIC) goes up as it is; the server decides.
    return file;
  }
}

/** One required document: pick a photo or PDF, it uploads straight away. */
export function DocumentUpload({
  reference,
  kind,
  label,
  hint,
  accept,
  initial,
  onChange,
}: {
  reference: string;
  kind: string;
  label: string;
  hint: string;
  accept: string;
  initial?: UploadedDocument;
  onChange?: (uploaded: boolean) => void;
}) {
  const [doc, setDoc] = React.useState<UploadedDocument | undefined>(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputId = React.useId();

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("kind", kind);
      const blob = await shrinkPhoto(file);
      body.set("file", blob, blob === file ? file.name : file.name.replace(/\.\w+$/, "") + ".jpg");
      const res = await fetch(`/api/bookings/${reference}/documents`, { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "That upload didn't go through. Please try again.");
      setDoc({ id: json.id, fileName: json.fileName });
      onChange?.(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That upload didn't go through.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-[var(--radius-inset)] border p-4",
        doc ? "border-forest-300 bg-forest-100/40" : "border-[var(--line-strong)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            {doc ? <CheckCircle2 className="size-4 text-forest-600" /> : null}
            {label}
          </p>
          <p className="mt-0.5 text-2xs leading-relaxed text-[var(--ink-muted)]">
            {doc ? (
              <>
                Uploaded:{" "}
                <a href={`/api/documents/${doc.id}`} target="_blank" rel="noopener" className="link-draw text-clay-700">
                  {doc.fileName}
                </a>
              </>
            ) : (
              hint
            )}
          </p>
        </div>
        <label
          htmlFor={inputId}
          className={cn(
            "inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-[var(--line-strong)] px-4 text-2xs font-semibold transition-colors hover:border-forest-800",
            busy && "pointer-events-none opacity-60",
          )}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FileUp className="size-3.5" />}
          {busy ? "Uploading…" : doc ? "Replace" : "Upload"}
        </label>
        <input
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-2xs font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
