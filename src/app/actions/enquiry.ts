"use server";

import { z } from "zod";
import { notifyAdminsOfEnquiry } from "@/lib/notifications";
import { getSite } from "@/lib/settings";

/**
 * Enquiry submission.
 *
 * Stored first, in every admin's notification inbox, then emailed to the
 * business address if email is set up. The customer is told it was received
 * only when one of the two actually happened; if neither did, the form says
 * so and points them at WhatsApp rather than showing a false green tick.
 */

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.string().trim().email("Please enter a valid email address"),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, "Please tell us a little more (10 characters minimum)")
    .max(4000),
  /** Honeypot — bots fill hidden fields, humans do not. */
  company: z.string().max(0).optional().or(z.literal("")),
});

export type EnquiryState = {
  status: "idle" | "success" | "error" | "unconfigured";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function submitEnquiry(
  _prev: EnquiryState,
  formData: FormData,
): Promise<EnquiryState> {
  const site = await getSite();
  const parsed = schema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    subject: formData.get("subject") ?? "",
    message: formData.get("message") ?? "",
    company: formData.get("company") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors,
    };
  }

  const data = parsed.data;

  // Honeypot tripped — accept silently so the bot learns nothing.
  if (data.company) return { status: "success" };

  const stored = await notifyAdminsOfEnquiry({
    kind: "contact",
    title: data.subject ? `Enquiry: ${data.subject}` : `Website enquiry from ${data.name}`,
    lines: [
      ["From", data.name],
      ["Email", data.email],
      ["Phone", data.phone ?? ""],
    ],
    message: data.message,
    replyTo: data.email,
    replySubject: data.subject ? `Re: ${data.subject}` : "Your enquiry to Thrill Rwanda",
  });

  const received: EnquiryState = {
    status: "success",
    message: "Thank you — we have your enquiry and will reply within one working day.",
  };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from || !site.contact.email) {
    if (stored) return received;
    return {
      status: "unconfigured",
      message: `We couldn't pass that on automatically. Please WhatsApp or call us on ${site.contact.phone} and we'll pick it up straight away.`,
    };
  }

  try {
    const { renderEmail, sendRendered } = await import("@/lib/email/template");
    await sendRendered(
      site.contact.email,
      renderEmail({
        subject: data.subject ? `Enquiry: ${data.subject}` : `Website enquiry from ${data.name}`,
        heading: "New website enquiry",
        preheader: data.message.slice(0, 120),
        paragraphs: [data.message],
        details: [
          ["Name", data.name],
          ["Email", data.email],
          ["Phone", data.phone || "Not given"],
          ["Subject", data.subject || "Not given"],
        ],
        cta: { label: `Reply to ${data.name.split(" ")[0]}`, href: `mailto:${data.email}` },
        footer: "Sent from the contact form on the website. Replying goes straight to the customer.",
      }, site),
      { replyTo: data.email },
    );

    return received;
  } catch (err) {
    console.error("[enquiry] send failed", err);
    // The team already has it in their inbox; the email was only a copy.
    if (stored) return received;
    return {
      status: "error",
      message: `We couldn't send that just now. Please call or WhatsApp ${site.contact.phone} and we'll sort it immediately.`,
    };
  }
}
