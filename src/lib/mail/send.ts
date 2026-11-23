import "server-only";
import { randomUUID } from "node:crypto";
import MailComposer from "nodemailer/lib/mail-composer";
import { createTransport } from "nodemailer";
import { formatAddress, parseRecipients } from "@/lib/mail/addresses";
import { appendRaw, discardDraft, MailError, requireConfig } from "@/lib/mail/imap";
import { htmlToText, sanitizeEmailHtml } from "@/lib/mail/sanitize";
import type { ComposeInput } from "@/lib/mail/types";

export type OutgoingFile = { filename: string; contentType: string; content: Buffer };

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENTS = 15;
export const MAX_RECIPIENTS = 50;

const clean = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

/**
 * The finished message as raw bytes. The same bytes are sent and stored in
 * Sent, so what the recipient got is exactly what the admin sees afterwards.
 */
async function compose(input: ComposeInput, files: OutgoingFile[], requireRecipient: boolean) {
  const config = requireConfig();
  const to = parseRecipients(input.to);
  const cc = parseRecipients(input.cc);
  const bcc = parseRecipients(input.bcc);
  const bad = [...to.invalid, ...cc.invalid, ...bcc.invalid];
  if (bad.length) throw new MailError(`These are not valid email addresses: ${bad.slice(0, 3).join(", ")}`);
  const all = [...to.valid, ...cc.valid, ...bcc.valid];
  if (requireRecipient && !to.valid.length) throw new MailError("Add at least one recipient.");
  if (all.length > MAX_RECIPIENTS) throw new MailError(`A message can go to ${MAX_RECIPIENTS} people at most.`);
  if (files.length > MAX_ATTACHMENTS) throw new MailError(`Attach ${MAX_ATTACHMENTS} files at most.`);
  if (files.reduce((n, f) => n + f.content.length, 0) > MAX_ATTACHMENT_BYTES) throw new MailError("Attachments can total 20 MB at most.");

  // Whatever the editor produced is cleaned again here: the browser is not trusted.
  const html = sanitizeEmailHtml(input.html, { allowRemoteImages: true }).html;
  const domain = config.user.split("@")[1] ?? "localhost";
  const date = new Date();
  const messageId = `<${randomUUID()}@${domain}>`;

  const raw = await new MailComposer({
    from: { name: config.fromName, address: config.user },
    to: to.valid.map(formatAddress),
    cc: cc.valid.map(formatAddress),
    bcc: bcc.valid.map(formatAddress),
    subject: clean(input.subject) || "(no subject)",
    html,
    text: htmlToText(html),
    date,
    messageId,
    inReplyTo: input.inReplyTo ? clean(input.inReplyTo) : undefined,
    references: input.references?.map(clean).filter(Boolean),
    attachments: files.map((f) => ({ filename: clean(f.filename) || "attachment", contentType: f.contentType, content: f.content })),
  })
    .compile()
    .build();

  return { raw, config, recipients: all.map((a) => a.address), messageId, subject: clean(input.subject) || "(no subject)" };
}

/** Saves the message in Drafts, replacing the draft it was opened from. */
export async function saveDraft(input: ComposeInput, files: OutgoingFile[]) {
  const { raw } = await compose(input, files, false);
  const uid = await appendRaw("drafts", raw, input.draftUid);
  return { uid };
}

/** Sends through Spacemail's SMTP, then files a copy in Sent. */
export async function sendMessage(input: ComposeInput, files: OutgoingFile[]) {
  const { raw, config, recipients, subject } = await compose(input, files, true);
  const transport = createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });
  try {
    await transport.sendMail({ envelope: { from: config.user, to: recipients }, raw });
  } finally {
    transport.close();
  }

  // The message is out. Housekeeping below must never make the send look failed.
  let warning: string | undefined;
  try {
    await appendRaw("sent", raw);
  } catch {
    warning = "Sent, but a copy could not be saved to the Sent folder.";
  }
  if (input.draftUid) await discardDraft(input.draftUid);
  return { recipients, subject, warning };
}
