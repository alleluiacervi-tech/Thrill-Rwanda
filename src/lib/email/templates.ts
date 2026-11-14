import { cache } from "react";
import { db } from "@/lib/db";
import { TEMPLATE_BY_KEY, fill, type TemplateKey } from "@/lib/email/template-data";

/** Reading the wording to send. Server-side: it touches the database. */

export type RenderedTemplate = {
  subject: string;
  paragraphs: string[];
  ctaLabel: string;
  /** False when the built-in copy is in use. */
  edited: boolean;
};

/**
 * The wording to send: the admin's if they saved one, the built-in otherwise.
 * Never throws — a database problem must not stop a receipt going out.
 */
export const renderTemplate = cache(
  async (key: TemplateKey, values: Record<string, string | undefined>): Promise<RenderedTemplate | null> => {
    const base = TEMPLATE_BY_KEY.get(key);
    if (!base) return null;

    let subject = base.subject;
    let body = base.body;
    let ctaLabel = base.ctaLabel;
    let edited = false;

    try {
      const row = await db.emailTemplate.findUnique({ where: { key } });
      if (row) {
        subject = row.subject;
        body = row.body;
        ctaLabel = row.ctaLabel || base.ctaLabel;
        edited = true;
      }
    } catch (err) {
      console.error("[email] template read failed, using the built-in copy", err);
    }

    return {
      subject: fill(subject, values),
      paragraphs: fill(body, values)
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
      ctaLabel: fill(ctaLabel, values),
      edited,
    };
  },
);

// Re-exported so callers have one import for the wording and the reading of it.
export * from "@/lib/email/template-data";
