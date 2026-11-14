import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Upload drivers, in priority order: cloudinary, r2, local disk (dev only).
// Callers just get a URL back and never learn which one ran.

const CLOUDINARY = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
};

const R2 = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  publicUrl: process.env.R2_PUBLIC_URL,
};

export type StorageDriver = "cloudinary" | "r2" | "local" | "none";

/** The prefix every locally-stored file is served under. */
export const LOCAL_URL_PREFIX = "/api/uploads/";

const LOCAL_ROOT = path.join(process.cwd(), ".uploads");

export function storageDriver(): StorageDriver {
  if (CLOUDINARY.cloudName && CLOUDINARY.apiKey && CLOUDINARY.apiSecret) {
    return "cloudinary";
  }
  if (
    R2.accountId &&
    R2.accessKeyId &&
    R2.secretAccessKey &&
    R2.bucket &&
    R2.publicUrl
  ) {
    return "r2";
  }
  // Prod with no gateway refuses: a serverless disk is wiped on deploy, so
  // a "successful" write there 404s for customers days later.
  return process.env.NODE_ENV === "production" ? "none" : "local";
}

/** Thrown when there is nowhere safe to put the bytes. */
export class StorageUnavailable extends Error {}

/* ------------------------------------------------------------ file types */

// The browser's declared type is never trusted; sniff() reads magic bytes.
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const ACCEPT_ATTRIBUTE = ACCEPTED_TYPES.join(",");

/** 6 MB. Comfortably above a phone photo, well below an unresized DSLR RAW. */
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

type Sniffed = { contentType: (typeof ACCEPTED_TYPES)[number]; ext: string };

function ascii(bytes: Uint8Array, from: number, to: number) {
  return String.fromCharCode(...bytes.subarray(from, to));
}

export function sniff(bytes: Uint8Array): Sniffed | null {
  if (bytes.length < 16) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", ext: "jpg" };
  }

  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (PNG.every((b, i) => bytes[i] === b)) {
    return { contentType: "image/png", ext: "png" };
  }

  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return { contentType: "image/webp", ext: "webp" };
  }

  // ISO-BMFF: size, then 'ftyp', then the brand.
  if (ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12);
    if (brand === "avif" || brand === "avis") {
      return { contentType: "image/avif", ext: "avif" };
    }
  }

  return null;
}

/* ---------------------------------------------------------------- put */

/** `listings/2026/09/<uuid>.jpg` — dated so a bucket listing stays navigable. */
function makeKey(ext: string) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `listings/${yyyy}/${mm}/${randomUUID()}.${ext}`;
}

export type StoredFile = { url: string; key: string; contentType: string; bytes: number };

/* -------------------------------------------------------- cloudinary */

// Signed, not an unsigned preset — that would be a public write endpoint.
async function uploadToCloudinary(
  body: Uint8Array,
  key: string,
  contentType: string,
): Promise<StoredFile> {
  const { createHash } = await import("node:crypto");

  // Cloudinary adds its own extension, so public_id carries none.
  const publicId = key.replace(/\.[^.]+$/, "");
  const timestamp = Math.floor(Date.now() / 1000);

  const signed: Record<string, string> = {
    public_id: publicId,
    timestamp: String(timestamp),
  };

  const toSign = Object.keys(signed)
    .sort()
    .map((k) => `${k}=${signed[k]}`)
    .join("&");
  const signature = createHash("sha1")
    .update(toSign + CLOUDINARY.apiSecret)
    .digest("hex");

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(body)], { type: contentType }));
  form.append("api_key", CLOUDINARY.apiKey!);
  for (const [k, v] of Object.entries(signed)) form.append(k, v);
  form.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`,
    { method: "POST", body: form },
  );

  const data = (await res.json().catch(() => ({}))) as {
    secure_url?: string;
    bytes?: number;
    error?: { message?: string };
  };

  if (!res.ok || !data.secure_url) {
    // Their message distinguishes bad signature from quota from bad format.
    throw new StorageUnavailable(
      data.error?.message
        ? `Cloudinary rejected the upload: ${data.error.message}`
        : `Cloudinary rejected the upload (HTTP ${res.status}).`,
    );
  }

  return {
    url: data.secure_url,
    key: publicId,
    contentType,
    bytes: data.bytes ?? body.byteLength,
  };
}

export async function putImage(body: Uint8Array): Promise<StoredFile> {
  const kind = sniff(body);
  if (!kind) {
    throw new StorageUnavailable(
      "That file isn't a JPEG, PNG, WebP or AVIF image.",
    );
  }
  if (body.byteLength > MAX_UPLOAD_BYTES) {
    throw new StorageUnavailable("That image is larger than 6 MB.");
  }

  const key = makeKey(kind.ext);
  const driver = storageDriver();

  if (driver === "none") {
    throw new StorageUnavailable(
      "Image storage isn't configured on this server. Set the CLOUDINARY_* environment variables.",
    );
  }

  if (driver === "cloudinary") {
    return uploadToCloudinary(body, key, kind.contentType);
  }

  if (driver === "r2") {
    const { PutObjectCommand, S3Client } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${R2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2.accessKeyId!,
        secretAccessKey: R2.secretAccessKey!,
      },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: R2.bucket!,
        Key: key,
        Body: body,
        ContentType: kind.contentType,
        // Immutable: the key contains a UUID, so a given URL never changes.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    return {
      url: `${R2.publicUrl!.replace(/\/$/, "")}/${key}`,
      key,
      contentType: kind.contentType,
      bytes: body.byteLength,
    };
  }

  const target = path.join(LOCAL_ROOT, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);

  return {
    url: `${LOCAL_URL_PREFIX}${key}`,
    key,
    contentType: kind.contentType,
    bytes: body.byteLength,
  };
}

/* ---------------------------------------------------------------- read */

// Resolves inside .uploads/ or returns null, so `../../.env` can't escape.
export async function readLocal(key: string) {
  if (storageDriver() !== "local") return null;

  const target = path.resolve(LOCAL_ROOT, key);
  const root = path.resolve(LOCAL_ROOT);
  if (target !== root && !target.startsWith(root + path.sep)) return null;

  try {
    const body = await readFile(target);
    const ext = path.extname(target).slice(1).toLowerCase();
    const contentType =
      ext === "png" ? "image/png"
      : ext === "webp" ? "image/webp"
      : ext === "avif" ? "image/avif"
      : "image/jpeg";
    return { body, contentType };
  } catch {
    return null;
  }
}
