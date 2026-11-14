import { cache } from "react";
import { db } from "@/lib/db";

/**
 * Legal copy: the client's own text once an admin saves it, the shipped
 * drafts until then.
 *
 * A booking records the version it accepted, so changing the terms later
 * never rewrites what an existing customer agreed to.
 */

/** Published at /legal/<slug>. */
export const LEGAL_SLUGS = ["terms", "privacy", "cancellation"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

/**
 * Everything an admin may edit. The car hire agreement lives in the same
 * table and editor, but has no public page: a customer sees it filled in with
 * their own booking's details when they sign it.
 */
export const EDITABLE_SLUGS = [...LEGAL_SLUGS, "car-hire-agreement"] as const;
export type EditableSlug = (typeof EDITABLE_SLUGS)[number];

export const LEGAL_TITLES: Record<EditableSlug, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  cancellation: "Cancellation Policy",
  "car-hire-agreement": "Car hire agreement",
};

export type LegalDoc = {
  slug: string;
  title: string;
  /** Paragraphs and headings, in order. */
  blocks: { kind: "heading" | "paragraph"; text: string }[];
  version: number;
  updatedAt: Date | null;
  /** False while the shipped draft is still showing. */
  published: boolean;
};

/** A line ending in a colon, or a short line with no full stop, reads as a heading. */
function parse(body: string): LegalDoc["blocks"] {
  return body
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((text) => {
      const oneLine = !text.includes("\n");
      const heading = oneLine && (text.endsWith(":") || (text.length < 80 && !/[.!?]$/.test(text)));
      return {
        kind: heading ? ("heading" as const) : ("paragraph" as const),
        text: heading ? text.replace(/:$/, "") : text,
      };
    });
}

export const getLegalDoc = cache(async (slug: string): Promise<LegalDoc | null> => {
  if (!(LEGAL_SLUGS as readonly string[]).includes(slug)) return null;

  try {
    const row = await db.legalDocument.findUnique({ where: { slug } });
    if (row) {
      return {
        slug: row.slug,
        title: row.title,
        blocks: parse(row.body),
        version: row.version,
        updatedAt: row.updatedAt,
        published: true,
      };
    }
  } catch (err) {
    // An unreachable database must not take the legal pages down.
    console.error("[legal] read failed, falling back to the draft", err);
  }

  return null;
});

/** The version a booking should record. Zero means the draft is still showing. */
export const currentTermsVersion = cache(async (): Promise<number> => {
  try {
    const row = await db.legalDocument.findUnique({
      where: { slug: "terms" },
      select: { version: true },
    });
    return row?.version ?? 0;
  } catch {
    return 0;
  }
});
