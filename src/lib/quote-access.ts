import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { enquiryScope, isFinance } from "@/lib/enquiry-workflow";
import { quoteContentHash } from "@/lib/quote-render";
import type { QuoteSnapshot } from "@/lib/quote-rules";
export async function readAccessibleQuote(reference: string, id: string) {
  const actor = await requireEnquiryStaff();
  if (isFinance(actor) || !z.string().uuid().safeParse(id).success) notFound();
  const quote = await db.quoteVersion.findFirst({
    where: { id, enquiry: { reference, ...enquiryScope(actor) } },
    include: { enquiry: { select: { ownerId: true } } },
  });
  if (!quote) notFound();
  const snapshot = quote.snapshot as QuoteSnapshot;
  if (quoteContentHash(snapshot) !== quote.contentHash)
    throw new Error("Quote integrity check failed");
  return { actor, quote, snapshot };
}
