import { db } from "@/lib/db";
import { canViewDocuments } from "@/lib/booking-documents";
import { getSession } from "@/lib/session";

// Serves one licence or ID copy to the booking's customer, its provider, or an
// admin — checked on every request, never cached, never on a public URL.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getSession())?.user;
  if (!user) return new Response("Please sign in.", { status: 401 });

  const doc = await db.bookingDocument
    .findUnique({
      where: { id },
      select: {
        contentType: true,
        fileName: true,
        data: true,
        booking: { select: { customerId: true, provider: { select: { userId: true } } } },
      },
    })
    .catch(() => null);

  // The same answer whether it doesn't exist or isn't theirs.
  if (!doc || !canViewDocuments(user, { customerId: doc.booking.customerId, providerUserId: doc.booking.provider.userId })) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `inline; filename="${doc.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      // A stored file can never run script in our origin.
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
