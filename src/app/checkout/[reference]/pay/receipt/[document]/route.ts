import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { paymentPdfResponse } from "@/lib/collections/documents";
import { getSite } from "@/lib/settings";

export async function GET(_request: Request, { params }: { params: Promise<{ reference: string; document: string }> }) {
  const { reference, document } = await params;
  if (document !== "invoice" && !z.uuid().safeParse(document).success) return new Response(null, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const site = await getSite();
  return paymentPdfResponse({ bookingReference: reference, customerId: user.id }, { name: site.legalName, email: site.contact.email }, document === "invoice" ? undefined : document);
}
