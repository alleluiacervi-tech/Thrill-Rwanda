import { z } from "zod";
import { mailActor } from "@/lib/mail/access";
import { mailConfig } from "@/lib/mail/config";
import { describeMailError, getAttachment } from "@/lib/mail/imap";
import { FOLDER_KEYS } from "@/lib/mail/types";

/** Downloads one attachment. The file is forced to download, never rendered in our origin. */
export const runtime = "nodejs";

const query = z.object({
  folder: z.enum(FOLDER_KEYS),
  uid: z.coerce.number().int().positive(),
  index: z.coerce.number().int().min(0).max(200),
});

const text = (message: string, status: number) =>
  new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  if (!(await mailActor())) return text("Sign in again.", 401);
  if (!mailConfig()) return text("The mailbox is not connected yet.", 503);
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return text("That request was not understood.", 400);

  try {
    const file = await getAttachment(parsed.data.folder, parsed.data.uid, parsed.data.index);
    // Header-safe filename: no quotes, slashes or control characters.
    const safe = file.filename.replace(/[\r\n"\\/]+/g, "_");
    return new Response(new Uint8Array(file.content), {
      headers: {
        // Never the sender's declared type: an attached .html must not run on our origin.
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Content-Length": String(file.content.length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return text(describeMailError(err), 502);
  }
}
