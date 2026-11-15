import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MAX_DOCUMENT_BYTES, isDocumentKind, sniffDocument } from "@/lib/booking-documents";
import { CHECKOUT_STATUSES } from "@/lib/payments";
import { getSession } from "@/lib/session";

// The customer uploads their licence or ID copy for a car hire booking, one file
// per request so a large scan fails on its own. Stored privately in the database.

export const runtime = "nodejs";

const bad = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(request: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const user = (await getSession())?.user;
  if (!user) return bad(401, "Please sign in again.");

  const fresh = await db.user.findUnique({ where: { id: user.id }, select: { isActive: true } });
  if (!fresh?.isActive) return bad(403, "This account is suspended.");
  const policy = await db.operationsPolicy.findUnique({ where: { id: 1 } });
  if (!policy?.documentsEnabled) return bad(409, "Document collection is not enabled. Contact the desk for the approved requirements.");
  const expiresAt = new Date(Date.now() + policy.documentDays * 86400000);
  // Scoped to the session's own booking: a guessed reference finds nothing.
  const booking = await db.booking.findFirst({
    where: { reference, customerId: user.id },
    select: { id: true, serviceType: true, status: true },
  });
  if (!booking) return bad(404, "We couldn't find that booking.");
  if (booking.serviceType !== "VEHICLE") return bad(400, "Documents are only needed for car hire.");
  if (!(CHECKOUT_STATUSES as readonly string[]).includes(booking.status)) {
    return bad(409, "This booking can no longer be changed.");
  }

  // Cheap rejection before reading a large body into memory.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_DOCUMENT_BYTES + 8192) {
    return bad(413, "That file is larger than 4 MB. Try a photo instead of a scan.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad(400, "That upload wasn't readable.");
  }
  const kind = form.get("kind");
  const file = form.get("file");
  if (!isDocumentKind(kind)) return bad(400, "Unknown document type.");
  if (!(file instanceof File)) return bad(400, "No file was attached.");
  if (file.size > MAX_DOCUMENT_BYTES) return bad(413, "That file is larger than 4 MB. Try a photo instead of a scan.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffDocument(bytes);
  if (!contentType) return bad(415, "Please upload a photo (JPG or PNG) or a PDF.");

  // A new upload replaces the old one of the same kind.
  const fileName = (file.name || "document").replace(/[^\w.\- ]+/g, "").slice(0, 120) || "document";
  const saved = await db.$transaction(async tx => {
    const active = await tx.user.findUnique({ where: { id: user.id }, select: { isActive: true } });
    const currentPolicy = await tx.operationsPolicy.findUnique({ where: { id: 1 } });
    if (!active?.isActive || !currentPolicy?.documentsEnabled || currentPolicy.version !== policy.version) throw new Error("Permissions or collection policy changed before upload");
    const doc = await tx.bookingDocument.upsert({
      where: { bookingId_kind: { bookingId: booking.id, kind } },
      create: { bookingId: booking.id, kind, contentType, fileName, size: bytes.length, data: bytes, expiresAt, retentionPurpose: policy.documentPurpose },
      update: { contentType, fileName, size: bytes.length, data: bytes, uploadedAt: new Date(), expiresAt, retentionPurpose: policy.documentPurpose },
      select: { id: true, kind: true, fileName: true, size: true },
    });
    await tx.operationsAudit.create({ data: { actorId: user.id, entityId: doc.id, action: "DOCUMENT_UPLOAD", evidence: "Customer-provided copy under approved purpose and retention", changes: { bookingId: booking.id, kind, expiresAt: expiresAt.toISOString() } } });
    return doc;
  });

  return NextResponse.json(saved);
}
