import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Everything about one booking for the admin and provider detail pages.
 * Never the document bytes: those stream through the access-checked route.
 */
export function loadBookingDetail(where: Prisma.BookingWhereInput) {
  return db.booking.findFirst({
    where,
    include: {
      customer: { select: { fullName: true, email: true, phone: true } },
      provider: { select: { businessName: true, phone: true, user: { select: { email: true } } } },
      payments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, amountMinor: true, currency: true, method: true, status: true, transactionId: true, paidAt: true, createdAt: true },
      },
      agreement: true,
      documents: {
        orderBy: { kind: "asc" },
        select: { id: true, kind: true, fileName: true, contentType: true, size: true, uploadedAt: true },
      },
      review: { select: { rating: true, status: true } },
    },
  });
}

export type BookingDetail = NonNullable<Awaited<ReturnType<typeof loadBookingDetail>>>;
