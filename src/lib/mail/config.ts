/**
 * The shared Thrill Rwanda mailbox, hosted on Spacemail.
 *
 * Spacemail speaks ordinary IMAP (reading) and SMTP (sending), so nothing is
 * stored in our database: the mailbox is the single source of truth, and
 * anything done in the admin also shows in any other mail app signed in to it.
 *
 * Credentials live only in the host's environment. They are never sent to the
 * browser and never logged.
 */
export type MailConfig = {
  user: string;
  pass: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  /** true = implicit TLS (port 465); false = STARTTLS (port 587). */
  smtpSecure: boolean;
  fromName: string;
};

function port(value: string | undefined, fallback: number) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
}

export function mailConfig(env: Record<string, string | undefined> = process.env): MailConfig | null {
  const user = env.MAIL_USER?.trim();
  const pass = env.MAIL_PASSWORD;
  if (!user || !pass) return null;
  const smtpPort = port(env.MAIL_SMTP_PORT, 465);
  return {
    user,
    pass,
    imapHost: env.MAIL_IMAP_HOST?.trim() || "mail.spacemail.com",
    imapPort: port(env.MAIL_IMAP_PORT, 993),
    smtpHost: env.MAIL_SMTP_HOST?.trim() || "mail.spacemail.com",
    smtpPort,
    smtpSecure: smtpPort === 465,
    fromName: env.MAIL_FROM_NAME?.trim() || "Thrill Rwanda",
  };
}
