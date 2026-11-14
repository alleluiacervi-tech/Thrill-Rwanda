import { db } from "@/lib/db";
import { resolveBookingSubjectDetails } from "@/lib/booking-display";
import type { ServiceType } from "@/generated/prisma/enums";

/**
 * Published-review reads for the public site.
 *
 * Every query here filters `status: "PUBLISHED"`. Pending and hidden reviews
 * must never reach a public page — that filter is the whole moderation
 * guarantee, so keep it in this module rather than at each call site.
 */

export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  authorName: string;
  subject: string;
};

/** Aggregate rating for one listing, or null when it has no reviews yet. */
export async function ratingFor(serviceType: ServiceType, resourceId: string) {
  const agg = await db.review.aggregate({
    where: { status: "PUBLISHED", serviceType, resourceId },
    _avg: { rating: true },
    _count: { _all: true },
  });
  if (agg._count._all === 0 || agg._avg.rating === null) return null;
  return { value: agg._avg.rating, count: agg._count._all };
}

/** Platform-wide aggregate plus the 1–5 distribution, for /reviews. */
export async function platformRating() {
  const [agg, buckets] = await Promise.all([
    db.review.aggregate({
      where: { status: "PUBLISHED" },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    db.review.groupBy({
      by: ["rating"],
      where: { status: "PUBLISHED" },
      _count: { _all: true },
    }),
  ]);

  const total = agg._count._all;
  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const found = buckets.find((b) => b.rating === stars)?._count._all ?? 0;
    return {
      stars,
      count: found,
      share: total === 0 ? 0 : Math.round((found / total) * 100),
    };
  });

  return { value: agg._avg.rating, count: total, distribution };
}

/** Most recent published reviews, with the listing each one refers to. */
export async function recentReviews(take = 30): Promise<PublicReview[]> {
  const rows = await db.review.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take,
    include: { customer: { select: { fullName: true } } },
  });

  const subjects = await resolveBookingSubjectDetails(rows);

  return rows.map((r) => {
    // Surname-initial only — a review is public, the reviewer's full name
    // does not need to be.
    const parts = r.customer.fullName.trim().split(/\s+/);
    const authorName =
      parts.length > 1
        ? `${parts[0]} ${parts[parts.length - 1]![0]}.`
        : (parts[0] ?? "Traveller");

    return {
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      authorName,
      subject: subjects.get(r.resourceId)?.title ?? "your trip",
    };
  });
}
