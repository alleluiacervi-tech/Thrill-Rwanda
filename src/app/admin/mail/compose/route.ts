import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { mailActor, sameOrigin } from "@/lib/mail/access";
import { mailConfig } from "@/lib/mail/config";
import { describeMailError } from "@/lib/mail/imap";
import { saveDraft, sendMessage, type OutgoingFile } from "@/lib/mail/send";
import type { MailResult } from "@/lib/mail/types";

/**
 * Sending and saving drafts. This is a route handler, not a server action,
 * because it carries attachments: actions are capped far below 20 MB.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY = 25 * 1024 * 1024;

const fields = z.object({
  intent: z.enum(["send", "draft"]),
  to: z.string().max(5000),
  cc: z.string().max(5000),
  bcc: z.string().max(5000),
  subject: z.string().max(300),
  html: z.string().max(1_000_000),
  inReplyTo: z.string().max(500).optional(),
  references: z.string().max(5000).optional(),
  draftUid: z.coerce.number().int().positive().optional(),
});

const reply = (body: MailResult<unknown>, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ ok: false, error: "That request did not come from this site." }, 403);
  const actor = await mailActor();
  if (!actor) return reply({ ok: false, error: "Your session has ended. Sign in again." }, 401);
  if (!mailConfig()) return reply({ ok: false, error: "The mailbox is not connected yet." }, 503);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) {
    return reply({ ok: false, error: "That is too large. Attachments can total 20 MB at most." }, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply({ ok: false, error: "The message could not be read. Try attaching fewer or smaller files." }, 400);
  }

  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const parsed = fields.safeParse({
    intent: get("intent"),
    to: get("to") ?? "",
    cc: get("cc") ?? "",
    bcc: get("bcc") ?? "",
    subject: get("subject") ?? "",
    html: get("html") ?? "",
    inReplyTo: get("inReplyTo") || undefined,
    references: get("references") || undefined,
    draftUid: get("draftUid") || undefined,
  });
  if (!parsed.success) return reply({ ok: false, error: "That message was not understood." }, 400);

  const files: OutgoingFile[] = [];
  for (const entry of form.getAll("files")) {
    if (typeof entry === "string" || entry.size === 0) continue;
    files.push({ filename: entry.name, contentType: entry.type || "application/octet-stream", content: Buffer.from(await entry.arrayBuffer()) });
  }

  const { intent, references, ...rest } = parsed.data;
  const input = { ...rest, references: references ? references.split(/\s+/).filter(Boolean) : undefined };

  try {
    if (intent === "draft") {
      const { uid } = await saveDraft(input, files);
      return reply({ ok: true, data: { uid: uid ?? null } });
    }
    const sent = await sendMessage(input, files);
    await logActivity(actor.id, {
      action: "mail.send",
      area: "Mail",
      target: sent.subject,
      summary: `Sent "${sent.subject}" to ${sent.recipients.length} ${sent.recipients.length === 1 ? "recipient" : "recipients"}.`,
      // Addresses only: the body of a customer's correspondence never goes in the log.
      changes: { recipients: sent.recipients, attachments: files.length },
    });
    return reply({ ok: true, data: { sent: true }, warning: sent.warning });
  } catch (err) {
    return reply({ ok: false, error: describeMailError(err) }, 502);
  }
}
