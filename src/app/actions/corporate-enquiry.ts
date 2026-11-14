"use server";

import { z } from "zod";
import { notifyAdminsOfEnquiry } from "@/lib/notifications";
import { getSite } from "@/lib/settings";

/**
 * Corporate rate-card request.
 *
 * The visitor's WhatsApp opens with the details at the same moment, so this
 * is the desk's written copy: if email isn't configured it reports that
 * quietly rather than failing the request the customer has already sent.
 */

const schema = z.object({
  companyName: z.string().trim().min(2, "Enter your company name").max(160),
  email: z.string().trim().email("Enter a valid email address"),
  whatsapp: z.string().trim().min(7, "Enter a WhatsApp number").max(40),
  routes: z.string().trim().min(3, "List at least one route you use often").max(1000),
  staff: z.string().trim().max(40).optional().or(z.literal("")),
  /** Honeypot — bots fill hidden fields, humans do not. */
  website: z.string().max(0).optional().or(z.literal("")),
});

export type CorporateEnquiryState =
  | { status: "idle" }
  | { status: "sent" | "not-emailed" }
  | { status: "error"; message: string };

export async function submitCorporateEnquiry(
  _prev: CorporateEnquiryState,
  formData: FormData,
): Promise<CorporateEnquiryState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check those details." };
  }
  const data = parsed.data;
  if (data.website) return { status: "sent" };

  // Into the admins' inbox first, so the request exists even with email off.
  const stored = await notifyAdminsOfEnquiry({
    kind: "corporate",
    title: `Corporate rate card: ${data.companyName}`,
    lines: [
      ["Company", data.companyName],
      ["Email", data.email],
      ["WhatsApp", data.whatsapp],
      ["Staff", data.staff ?? ""],
    ],
    message: `Frequent routes:\n${data.routes}`,
    replyTo: data.email,
    replySubject: "Your Thrill Rwanda corporate rate card",
  });

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return { status: stored ? "sent" : "not-emailed" };

  try {
    const site = await getSite();
    const { renderEmail, sendRendered } = await import("@/lib/email/template");
    await sendRendered(
      site.contact.email,
      renderEmail({
        subject: `Corporate rate card: ${data.companyName}`,
        heading: "Corporate rate card request",
        preheader: `${data.companyName} — ${data.routes.slice(0, 100)}`,
        paragraphs: [`Frequent routes:\n${data.routes}`],
        details: [
          ["Company", data.companyName],
          ["Email", data.email],
          ["WhatsApp", data.whatsapp],
          ["Staff", data.staff || "Not given"],
        ],
        cta: { label: "Reply by email", href: `mailto:${data.email}` },
        footer: "Sent from the Corporate & Events page. The customer was also sent to WhatsApp with these details.",
      }, site),
      { replyTo: data.email },
    );
    return { status: "sent" };
  } catch (err) {
    console.error("[corporate-enquiry] send failed", err);
    return { status: stored ? "sent" : "not-emailed" };
  }
}
