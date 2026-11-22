import { z } from "zod";
import { paymentPdfResponse } from "@/lib/collections/documents";
import { getSite } from "@/lib/settings";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string; document: string }> }) {
  const { token, document } = await params;
  if (!/^[\w-]{43}$/.test(token) || (document !== "invoice" && !z.uuid().safeParse(document).success)) return new Response(null, { status: 404 });
  const site = await getSite();
  return paymentPdfResponse({ token }, { name: site.legalName, email: site.contact.email }, document === "invoice" ? undefined : document);
}
