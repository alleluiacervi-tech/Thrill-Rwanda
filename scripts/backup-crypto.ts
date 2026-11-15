import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, appendFile, stat, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
const MAGIC = Buffer.from("THRILLB1");
export function backupKey(value = process.env.BACKUP_ENCRYPTION_KEY) {
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value))
    throw new Error(
      "BACKUP_ENCRYPTION_KEY must be a dedicated 32-byte base64 key",
    );
  return Buffer.from(value, "base64");
}
export async function sha256File(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
export async function encryptBackup(
  input: Readable,
  path: string,
  key: Buffer,
  onCreated?: () => void,
) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv),
    handle = await open(path, "wx", 0o600);
  onCreated?.();
  await handle.write(Buffer.concat([MAGIC, iv]));
  await handle.close();
  try {
    await pipeline(
      input,
      cipher,
      createWriteStream(path, { flags: "a", mode: 0o600 }),
    );
    await appendFile(path, cipher.getAuthTag());
    return { sha256: await sha256File(path), bytes: (await stat(path)).size };
  } catch (error) {
    await unlink(path).catch(() => {});
    throw error;
  }
}
export async function decryptBackup(path: string, output: string, key: Buffer) {
  const size = (await stat(path)).size;
  if (size < 36) throw new Error("Invalid backup format");
  const handle = await open(path, "r");
  const header = Buffer.alloc(20),
    tag = Buffer.alloc(16);
  try {
    await handle.read(header, 0, 20, 0);
    await handle.read(tag, 0, 16, size - 16);
  } finally {
    await handle.close();
  }
  if (!header.subarray(0, 8).equals(MAGIC))
    throw new Error("Invalid backup version");
  const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(8));
  decipher.setAuthTag(tag);
  try {
    await pipeline(
      createReadStream(path, { start: 20, end: size - 17 }),
      decipher,
      createWriteStream(output, { flags: "wx", mode: 0o600 }),
    );
  } catch {
    await unlink(output).catch(() => {});
    throw new Error("Backup authentication failed; restore was not attempted");
  }
}

export const signManifest = (value: unknown, key: Buffer) =>
  createHmac("sha256", key).update(JSON.stringify(value)).digest("hex");
export function verifyManifest(value: unknown, signature: string, key: Buffer) {
  return (
    /^[a-f0-9]{64}$/.test(signature) &&
    timingSafeEqual(
      Buffer.from(signManifest(value, key), "hex"),
      Buffer.from(signature, "hex"),
    )
  );
}
