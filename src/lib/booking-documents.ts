import { sniff } from "@/lib/storage";
import type { BookingDocumentKind } from "@/generated/prisma/enums";

/**
 * Car hire documents: the customer's driving licence and ID copies.
 *
 * Kept in the database rather than the image CDN so they are never on a
 * public URL; see the document route for who may read them.
 */

export const DOCUMENT_LABELS: Record<BookingDocumentKind, { label: string; hint: string }> = {
  DRIVING_LICENCE: {
    label: "Driving licence",
    hint: "A clear photo or scan of the front of your licence.",
  },
  ID_DOCUMENT: {
    label: "National ID or passport",
    hint: "Your ID card (front) or the photo page of your passport.",
  },
};

/** Under Vercel's 4.5 MB request limit; photos are shrunk in the browser first. */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;

export const DOCUMENT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

/** With a driver the customer doesn't drive, so only their ID is needed. */
export function requiredDocuments(details: unknown): BookingDocumentKind[] {
  const withDriver = (details as { withDriver?: unknown } | null)?.withDriver === true;
  return withDriver ? ["ID_DOCUMENT"] : ["DRIVING_LICENCE", "ID_DOCUMENT"];
}

/** The real type, read from the bytes — the browser's claim is not trusted. */
export function sniffDocument(bytes: Uint8Array): string | null {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-") {
    return "application/pdf";
  }
  const image = sniff(bytes);
  return image && image.contentType !== "image/avif" ? image.contentType : null;
}

export function isDocumentKind(value: unknown): value is BookingDocumentKind {
  return value === "DRIVING_LICENCE" || value === "ID_DOCUMENT";
}

/** Who may open a booking's documents: its customer, its provider, or an admin. */
export function canViewDocuments(
  user: { id: string; role?: string | null },
  booking: { customerId: string; providerUserId: string },
) {
  return user.role === "ADMIN" || user.id === booking.customerId || user.id === booking.providerUserId;
}
