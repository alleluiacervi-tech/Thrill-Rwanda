import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  ACCEPTED_TYPES,
  MAX_UPLOAD_BYTES,
  StorageUnavailable,
  putImage,
  storageDriver,
} from "@/lib/storage";

// A route handler, not a Server Action: uploads fail per file, so one
// oversized photo doesn't discard a form the provider just filled in.
// Guards: verified provider or admin, size, then magic bytes in putImage().

export const runtime = "nodejs";

const bad = (status: number, error: string) =>
  NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  const session = await getSession();
  const user = session?.user ? await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true, isActive: true } }) : null;

  if (!user) return bad(401, "Sign in to upload images.");
  if (user.isActive === false) return bad(403, "This account is suspended.");

  if (user.role !== "ADMIN") {
    if (user.role !== "PROVIDER") {
      return bad(403, "Only providers can upload listing images.");
    }
    // A provider whose application is still pending has no listings to
    // attach images to, so there is no reason to accept their bytes.
    const provider = await db.provider.findUnique({
      where: { userId: user.id },
      select: { status: true },
    });
    if (provider?.status !== "VERIFIED") {
      return bad(403, "Your provider account isn't verified yet.");
    }
  }

  if (storageDriver() === "none") {
    return bad(
      503,
      "Image storage isn't configured on this server. Paste an image URL instead.",
    );
  }

  // Cheap rejection before reading a large body into memory.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 4096) {
    return bad(413, "That image is larger than 6 MB.");
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const entry = form.get("file");
    if (entry instanceof File) file = entry;
  } catch {
    return bad(400, "That upload wasn't readable.");
  }

  if (!file) return bad(400, "No file was attached.");
  if (file.size > MAX_UPLOAD_BYTES) {
    return bad(413, "That image is larger than 6 MB.");
  }

  try {
    const stored = await putImage(new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json({
      url: stored.url,
      contentType: stored.contentType,
      bytes: stored.bytes,
    });
  } catch (err) {
    if (err instanceof StorageUnavailable) return bad(400, err.message);
    console.error("[uploads] failed", err);
    return bad(500, "We couldn't store that image. Please try again.");
  }
}

/** Advertises the limits so the client doesn't hardcode a second copy. */
export async function GET() {
  return NextResponse.json({
    driver: storageDriver(),
    maxBytes: MAX_UPLOAD_BYTES,
    accepts: ACCEPTED_TYPES,
  });
}
