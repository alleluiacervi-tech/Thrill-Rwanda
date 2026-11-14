"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { EDITABLE_SLUGS } from "@/lib/legal";
import { requireAdmin } from "@/lib/session";

/**
 * Editing the legal copy.
 *
 * Saving bumps the version. Bookings record the version they accepted, so a
 * later edit never changes what an existing customer agreed to.
 */

export type LegalState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "saved"; version: number };

const schema = z.object({
  slug: z.enum(EDITABLE_SLUGS),
  title: z.string().trim().min(3, "Give the document a title").max(160),
  body: z.string().trim().min(50, "That looks too short to be the full document").max(100_000),
});

export async function saveLegalDocument(
  _prev: LegalState,
  formData: FormData,
): Promise<LegalState> {
  const admin = await requireAdmin();

  const parsed = schema.safeParse({
    slug: formData.get("slug"),
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check those details." };
  }

  const { slug, title, body } = parsed.data;

  const saved = await db.legalDocument.upsert({
    where: { slug },
    update: { title, body, version: { increment: 1 }, updatedBy: admin.id },
    create: { slug, title, body, updatedBy: admin.id },
    select: { version: true },
  });

  revalidatePath(`/legal/${slug}`);
  revalidatePath("/admin/legal");
  return { status: "saved", version: saved.version };
}
