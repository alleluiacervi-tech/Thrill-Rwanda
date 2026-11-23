import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { clientScope } from "@/lib/client-portal";
import { itineraryPdfResponse } from "@/lib/ticketing-documents";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A client's own itinerary, only once tickets are issued. */
export async function GET(_request: Request, { params }: { params: Promise<{ reference: string }> }) {
  const user = await requireUser("/account/enquiries");
  const { reference } = await params;
  const enquiry = await db.enquiry.findFirst({
    where: { reference, service: "FLIGHT", ...clientScope(user.id) },
    select: { name: true, flightTicketing: { include: { options: { include: { segments: { orderBy: { position: "asc" } } } }, passengers: { orderBy: { position: "asc" } } } } },
  });
  const file = enquiry?.flightTicketing;
  if (!enquiry || !file || !["ISSUED", "CLOSED"].includes(file.status)) return new Response("Not found", { status: 404 });
  const response = await itineraryPdfResponse(file, reference, enquiry.name);
  return response ?? new Response("Not found", { status: 404 });
}
