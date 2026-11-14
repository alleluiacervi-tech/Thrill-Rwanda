"use client";

import * as React from "react";
import { ImagePlus, Loader2, Star, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

// Files upload as they are picked; the form field is just a hidden input of
// URLs, so the server actions never had to learn about files. Per-file so one
// rejected photo doesn't discard the whole form.

const MAX_BYTES = 6 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_IMAGES = 12;

type Pending = { key: string; name: string };

export function ImageUploader({
  name = "images",
  defaultValue = [],
}: {
  name?: string;
  defaultValue?: string[];
}) {
  const [urls, setUrls] = React.useState<string[]>(defaultValue);
  const [pending, setPending] = React.useState<Pending[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const seq = React.useRef(0);

  const room = MAX_IMAGES - urls.length - pending.length;

  async function upload(files: File[]) {
    setError(null);

    const batch = files.slice(0, Math.max(0, room));
    if (files.length > batch.length) {
      setError(`You can attach up to ${MAX_IMAGES} images.`);
    }

    await Promise.all(
      batch.map(async (file) => {
        const key = `p${seq.current++}`;

        // Checked here as well as on the server so an obvious mistake costs
        // nothing rather than a full upload of bytes bound to be rejected.
        if (file.size > MAX_BYTES) {
          setError(`${file.name} is larger than 6 MB.`);
          return;
        }

        setPending((p) => [...p, { key, name: file.name }]);
        try {
          const body = new FormData();
          body.append("file", file);
          const res = await fetch("/api/uploads", { method: "POST", body });
          const data = (await res.json().catch(() => ({}))) as {
            url?: string;
            error?: string;
          };

          if (!res.ok || !data.url) {
            setError(data.error ?? `${file.name} could not be uploaded.`);
            return;
          }
          const stored = data.url;
          setUrls((u) => (u.includes(stored) ? u : [...u, stored]));
        } catch {
          setError(`${file.name} could not be uploaded. Check your connection.`);
        } finally {
          setPending((p) => p.filter((x) => x.key !== key));
        }
      }),
    );
  }

  function addByUrl(raw: string) {
    const value = raw.trim();
    if (!value) return false;
    if (!/^https:\/\/\S+$/i.test(value)) {
      setError("Image links must start with https://");
      return false;
    }
    setError(null);
    setUrls((u) =>
      u.includes(value) || u.length >= MAX_IMAGES ? u : [...u, value],
    );
    return true;
  }

  return (
    <div className="space-y-3">
      {/* The actual form field. Newline-separated, parsed by imageUrls(). */}
      <input type="hidden" name={name} value={urls.join("\n")} />

      <span className="block text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
        Photos
      </span>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "rounded-[var(--radius-inset)] border border-dashed p-6 text-center transition-colors",
          dragging
            ? "border-ember-500 bg-ember-100"
            : "border-[var(--line-strong)] bg-[var(--paper-sunken)]",
        )}
      >
        <ImagePlus className="mx-auto size-6 text-[var(--ink-faint)]" />
        <p className="mt-3 text-sm text-[var(--ink-muted)]">
          Drag photos here, or{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-medium text-clay-700 underline underline-offset-4"
          >
            choose files
          </button>
          .
        </p>
        <p className="mt-1 text-2xs text-[var(--ink-faint)]">
          JPEG, PNG, WebP or AVIF · up to 6 MB each · {MAX_IMAGES} maximum. The
          first photo is the cover.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            void upload(Array.from(e.target.files ?? []));
            // Reset so re-picking the same file fires change again.
            e.target.value = "";
          }}
        />
      </div>

      {error ? (
        <p role="alert" className="text-2xs font-medium text-red-700">
          {error}
        </p>
      ) : null}

      {urls.length > 0 || pending.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {urls.map((url, i) => (
            <li
              key={url}
              className="group relative aspect-[4/3] overflow-hidden rounded-[var(--radius-inset)] border border-[var(--line)] bg-[var(--paper-sunken)]"
            >
              {/* Plain img: these are arbitrary hosts a provider pasted, and
                  next/image refuses anything outside remotePatterns. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="size-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.opacity = "0.25";
                }}
              />

              {i === 0 ? (
                <span className="absolute top-1.5 left-1.5 rounded-full bg-forest-900/85 px-2 py-0.5 text-[0.6rem] font-semibold tracking-[0.12em] text-bone-50 uppercase">
                  Cover
                </span>
              ) : null}

              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-forest-950/80 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                {i > 0 ? (
                  <button
                    type="button"
                    title="Make this the cover"
                    onClick={() =>
                      setUrls((u) => [u[i], ...u.filter((_, j) => j !== i)])
                    }
                    className="rounded-full bg-bone-50/90 p-1.5 text-forest-900 transition-colors hover:bg-bone-50"
                  >
                    <Star className="size-3.5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  title="Remove"
                  onClick={() => setUrls((u) => u.filter((_, j) => j !== i))}
                  className="rounded-full bg-bone-50/90 p-1.5 text-red-700 transition-colors hover:bg-bone-50"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}

          {pending.map((p) => (
            <li
              key={p.key}
              className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-[var(--radius-inset)] border border-[var(--line)] bg-[var(--paper-sunken)] p-2"
            >
              <Loader2 className="size-4 animate-spin text-[var(--ink-faint)]" />
              <span className="line-clamp-2 text-center text-[0.6rem] text-[var(--ink-faint)]">
                {p.name}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <UrlAdder onAdd={addByUrl} disabled={room <= 0} />
    </div>
  );
}

/** Escape hatch for providers whose photos already live somewhere public. */
function UrlAdder({
  onAdd,
  disabled,
}: {
  onAdd: (value: string) => boolean;
  disabled: boolean;
}) {
  const [value, setValue] = React.useState("");

  return (
    <div className="flex gap-2">
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // Enter inside a form submits it. Adding a URL is not submitting.
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (onAdd(value)) setValue("");
        }}
        placeholder="…or paste an image link (https://…)"
        className="w-full rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-4 py-2.5 text-sm outline-none transition-colors focus-visible:border-ember-500 disabled:opacity-50"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (onAdd(value)) setValue("");
        }}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-inset)] border border-[var(--line-strong)] px-4 text-sm transition-colors hover:border-forest-800 hover:bg-forest-800 hover:text-bone-50 disabled:opacity-50"
      >
        <Upload className="size-3.5" />
        Add
      </button>
    </div>
  );
}
