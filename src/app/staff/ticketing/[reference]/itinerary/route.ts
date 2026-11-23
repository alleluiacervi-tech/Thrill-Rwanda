import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { readTicketingFile } from "@/lib/ticketing";
import { itineraryPdfResponse } from "@/lib/ticketing-documents";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The issued itinerary for staff. Never produced before tickets are recorded. */
export async function GET(_request: Request, { params }: { params: Promise<{ reference: string }> }) {
  const actor = await requireEnquiryStaff();
  const { reference } = await params;
  const data = await readTicketingFile(actor.id, reference);
  if (!data?.file || data.file.status === "CANCELLED") return new Response("Not found", { status: 404 });
  const response = await itineraryPdfResponse(data.file, reference, data.enquiry.name);
  return response ?? new Response("Tickets have not been issued for this file.", { status: 409 });
}
