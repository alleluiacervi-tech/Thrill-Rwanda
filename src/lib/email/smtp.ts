import { createTransport } from "nodemailer";
import { mailConfig } from "@/lib/mail/config";

/**
 * Which service sends the site's own emails (enquiry replies, quotes,
 * booking messages, password resets).
 *
 * Resend when it is configured; otherwise the business mailbox over SMTP
 * (Spacemail, the same account Admin → Mail uses). Either way the customer
 * gets mail from the business; nothing is configured twice.
 */
export type EmailChannel = "resend" | "smtp";

export function emailChannel(env: Record<string, string | undefined> = process.env): EmailChannel | null {
  if (env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim()) return "resend";
  if (mailConfig(env)) return "smtp";
  return null;
}

export class SmtpDeliveryError extends Error {
  constructor(
    public code: "PROVIDER_TEMPORARY" | "PROVIDER_REJECTED",
    public retryable: boolean,
  ) {
    super(code);
  }
}

/**
 * Sends one email from the business mailbox. The From is always the mailbox
 * itself: Spacemail refuses any other sender. A stable Message-ID per key lets
 * a mail client fold a rare duplicate retry into one message.
 */
export async function sendViaMailbox(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  key?: string;
}): Promise<{ providerId: string }> {
  const config = mailConfig();
  if (!config) throw new SmtpDeliveryError("PROVIDER_REJECTED", false);
  const transport = createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  const domain = config.user.split("@")[1] ?? "localhost";
  try {
    const info = await transport.sendMail({
      from: { name: config.fromName, address: config.user },
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
      messageId: input.key ? `<${input.key.replace(/[^\w.-]/g, "")}@${domain}>` : undefined,
    });
    return { providerId: info.messageId || `smtp-${Date.now()}` };
  } catch (error) {
    // 5xx is a refusal (bad address, policy); anything else is worth retrying. Never log the body.
    const status = Number((error as { responseCode?: number }).responseCode);
    if (status >= 500 && status < 600) throw new SmtpDeliveryError("PROVIDER_REJECTED", false);
    throw new SmtpDeliveryError("PROVIDER_TEMPORARY", true);
  } finally {
    transport.close();
  }
}
