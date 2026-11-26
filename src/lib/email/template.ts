import { site } from "@/lib/site";
import { getSite } from "@/lib/settings";
import { buildSite, type SiteInfo } from "@/lib/site-config";

// Email clients ignore stylesheets and CSS variables, so the palette is repeated here as literals.
const C = {
  forest: "#1c5c45",
  forestDark: "#154a38",
  sun: "#f8c300",
  clay: "#8b4513",
  page: "#f7f3ec",
  card: "#ffffff",
  panel: "#fdfbf7",
  line: "#e2d8c7",
  ink: "#1a1a1a",
  muted: "#4a4136",
  faint: "#6f6252",
  dangerBg: "#fdf0ee",
  danger: "#9b2c1f",
};

const FONT = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export type EmailContent = {
  /** Subject line; also the fallback heading. */
  subject: string;
  /** Inbox preview text shown after the subject. */
  preheader?: string;
  /** Recipient's display name; the greeting uses the first word. Omit for no greeting. */
  name?: string | null;
  heading?: string;
  paragraphs: string[];
  /** Label/value rows, e.g. reference, dates, amounts. */
  details?: [label: string, value: string][];
  /** Absolute URL or a site path starting with "/". */
  cta?: { label: string; href: string };
  /** Small print under the button. */
  note?: string;
  tone?: "default" | "warning";
  /** Last footer line; defaults to the reply hint. */
  footer?: string;
};

export type RenderedEmail = { subject: string; html: string; text: string };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const absolute = (href: string) => (href.startsWith("/") ? `${site.url}${href}` : href);

export function firstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "there";
}

// Table layout with inline styles: the only markup Outlook, Gmail and phone clients all render the same.
// `brand` is the admin's business details; the built-in ones when a caller has none to hand.
export function renderEmail(c: EmailContent, brand: SiteInfo = buildSite(null)): RenderedEmail {
  const heading = c.heading ?? c.subject;
  const greeting = c.name !== undefined ? `Hi ${firstName(c.name)},` : null;
  const ctaUrl = c.cta ? absolute(c.cta.href) : null;
  const accent = c.tone === "warning" ? C.danger : C.sun;

  const paragraphs = c.paragraphs
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${C.muted};">${esc(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");

  const details = c.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border:1px solid ${C.line};background:${C.panel};border-collapse:separate;">
        ${c.details
          .map(
            ([label, value], i) => `<tr>
          <td style="padding:12px 16px;font-size:13px;color:${C.faint};${i ? `border-top:1px solid ${C.line};` : ""}">${esc(label)}</td>
          <td align="right" style="padding:12px 16px;font-size:14px;font-weight:600;color:${C.ink};${i ? `border-top:1px solid ${C.line};` : ""}">${esc(value)}</td>
        </tr>`,
          )
          .join("")}
      </table>`
    : "";

  // Bulletproof button: the padded cell stays clickable in Outlook where padding on <a> is ignored.
  const button = ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;">
        <tr><td bgcolor="${C.forest}">
          <a href="${esc(ctaUrl)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${esc(c.cta!.label)}</a>
        </td></tr>
      </table>
      <p style="margin:12px 0 0;font-size:12px;line-height:18px;color:${C.faint};">Button not working? Copy this link into your browser:<br><a href="${esc(ctaUrl)}" style="color:${C.forest};word-break:break-all;">${esc(ctaUrl)}</a></p>`
    : "";

  const note = c.note
    ? `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid ${C.line};font-size:13px;line-height:20px;color:${C.faint};">${esc(c.note)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(c.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};font-family:${FONT};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.preheader ?? "")}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td style="padding:0 4px 20px;">
        <a href="${site.url}" style="text-decoration:none;">
          <img src="${site.url}/thrill-rwanda-smooth-vector-preview.png" width="96" height="96" alt="${esc(brand.name)}" style="display:block;border:0;">
        </a>
      </td></tr>
      <tr><td style="background:${C.card};border:1px solid ${C.line};border-top:4px solid ${accent};padding:32px 32px 28px;">
        <h1 style="margin:0 0 20px;font-size:22px;line-height:30px;font-weight:700;color:${C.ink};">${esc(heading)}</h1>
        ${greeting ? `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${C.muted};">${esc(greeting)}</p>` : ""}
        ${paragraphs}
        ${details}
        ${button}
        ${note}
      </td></tr>
      <tr><td style="padding:24px 4px 0;font-size:12px;line-height:19px;color:${C.faint};">
        <strong style="color:${C.muted};">${esc(brand.legalName)}</strong><br>
        ${esc(brand.contact.address)}<br>
        <a href="${brand.contact.phoneHref}" style="color:${C.faint};">${esc(brand.contact.phone)}</a> ·
        <a href="${brand.contact.whatsapp}" style="color:${C.faint};">WhatsApp</a> ·
        <a href="mailto:${brand.contact.email}" style="color:${C.faint};">${esc(brand.contact.email)}</a><br>
        ${esc(c.footer ?? "You can reply to this email to reach our team.")}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    heading,
    "",
    ...(greeting ? [greeting, ""] : []),
    ...c.paragraphs.filter(Boolean).flatMap((p) => [p, ""]),
    ...(c.details?.length ? [...c.details.map(([l, v]) => `${l}: ${v}`), ""] : []),
    ...(ctaUrl ? [`${c.cta!.label}: ${ctaUrl}`, ""] : []),
    ...(c.note ? [c.note, ""] : []),
    "—",
    brand.legalName,
    `${brand.contact.phone} · ${brand.contact.email}`,
    site.url,
  ].join("\n");

  return { subject: c.subject, html, text };
}

/** Sends through Resend, or the business mailbox without it, with HTML and plain text. Returns skipped when neither is configured. */
export async function sendRendered(
  to: string,
  email: RenderedEmail,
  opts: { replyTo?: string; senderService?: string } = {},
) {
  const { emailChannel, sendViaMailbox } = await import("@/lib/email/smtp");
  const channel = emailChannel();
  if (!channel) return { skipped: true as const };
  if (channel === "smtp") {
    // The mailbox is the real inbox, so replies come straight back to it.
    await sendViaMailbox({ to, subject: email.subject, html: email.html, text: email.text, replyTo: opts.replyTo });
    return { skipped: false as const };
  }
  const apiKey = process.env.RESEND_API_KEY!;
  const { resendSender } = await import("@/lib/email/sender");
  const from = resendSender(opts.senderService)!;

  const { Resend } = await import("resend");
  const { error } = await new Resend(apiKey).emails.send({
    from,
    to,
    // The sending subdomain has no inbox, so replies go to the real one.
    replyTo: opts.replyTo ?? (await getSite()).contact.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  if (error) throw new Error(error.message);
  return { skipped: false as const };
}
