"use server";

import { revalidatePath } from "next/cache";
import { refreshPublicCatalogue } from "@/lib/catalogue";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, requireAdmin } from "@/lib/session";

/**
 * Reviews .
 *
 * A review can only exist against a COMPLETED booking that belongs to the
 * person writing it — enforced by looking the booking up with both the
 * reference and the session's customerId, and checking its status. That is
 * what makes every rating on the site traceable to a real, delivered trip.
 *
 * `Review.bookingId` is unique, so one booking yields at most one review;
 * a replay of the form updates nothing and reports the duplicate.
 *
 * New reviews land in PENDING. Only an admin publishes or hides them.
 */

export type ReviewState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

const submitSchema = z.object({
  reference: z.string().trim().min(3).max(20),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function submitReview(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Please sign in again." };

  const parsed = submitSchema.safeParse({
    reference: formData.get("reference"),
    rating: formData.get("rating"),
    comment: formData.get("comment") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: "Please choose a rating from 1 to 5." };
  }

  const { reference, rating, comment } = parsed.data;

  const booking = await db.booking.findFirst({
    where: { reference, customerId: user.id },
    select: {
      id: true,
      status: true,
      serviceType: true,
      resourceId: true,
      review: { select: { id: true } },
    },
  });

  if (!booking) return { status: "error", message: "Booking not found." };

  if (booking.status !== "COMPLETED") {
    return {
      status: "error",
      message: "You can review a trip once it's marked complete.",
    };
  }

  if (booking.review) {
    return {
      status: "error",
      message: "You've already reviewed this booking. Contact us to change it.",
    };
  }

  try {
    await db.review.create({
      data: {
        bookingId: booking.id,
        customerId: user.id,
        serviceType: booking.serviceType,
        resourceId: booking.resourceId,
        rating,
        comment: comment || null,
        status: "PENDING",
      },
    });
  } catch (err) {
    // The unique index on bookingId is the real guard against a double
    // submit racing the check above.
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("reviews_booking_key") || message.includes("Unique")) {
      return { status: "error", message: "You've already reviewed this booking." };
    }
    console.error("[review] create failed", err);
    return { status: "error", message: "We couldn't save that review." };
  }

  revalidatePath(`/account/bookings/${reference}`);
  revalidatePath("/account/reviews");
  return { status: "success" };
}

/* ------------------------------------------------------------ moderation */

// Widened to match the shared ActionButton state shape.
export type ModerationState = {
  status: "idle" | "error" | "ok";
  message?: string;
};

const moderateSchema = z.object({
  reviewId: z.string().uuid(),
  action: z.enum(["PUBLISHED", "HIDDEN", "DELETE"]),
});

export async function moderateReview(
  _prev: ModerationState,
  formData: FormData,
): Promise<ModerationState> {
  await requireAdmin();

  const parsed = moderateSchema.safeParse({
    reviewId: formData.get("reviewId"),
    action: formData.get("action"),
  });
  if (!parsed.success) return { status: "error", message: "Invalid action." };

  const { reviewId, action } = parsed.data;

  try {
    if (action === "DELETE") {
      await db.review.delete({ where: { id: reviewId } });
    } else {
      await db.review.update({
        where: { id: reviewId },
        data: { status: action },
      });
    }
  } catch (err) {
    console.error("[review] moderation failed", err);
    return { status: "error", message: "We couldn't update that review." };
  }

  revalidatePath("/admin/reviews");
  refreshPublicCatalogue();
  revalidatePath("/reviews");
  return { status: "idle" };
}
