import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { ActionButton } from "@/components/dashboard/action-button";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { Badge, Rating } from "@/components/ui/primitives";
import { StatGrid, StatTile } from "@/components/dashboard/dash-ui";
import { moderateReview } from "@/app/actions/review";
import { resolveBookingSubjects } from "@/lib/booking-display";
import { Pagination } from "@/components/ui/pagination";
import { paginate } from "@/lib/pagination";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const TONE = { PENDING: "clay", PUBLISHED: "forest", HIDDEN: "outline" } as const;

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/reviews");

  const params = await searchParams;
  const page = paginate(params, await db.review.count());

  const reviews = await db.review.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    skip: page.skip,
    take: page.take,
    include: {
      customer: { select: { fullName: true, email: true } },
      booking: { select: { reference: true } },
    },
  });

  const subjects = await resolveBookingSubjects(reviews);

  return (
    <>
      <DashboardHead
        title="Reviews"
        lede="Publish genuine reviews, hide anything abusive."
      />

      <StatGrid cols={3}>
        <StatTile label="Awaiting moderation" value={reviews.filter((r) => r.status === "PENDING").length} tone={reviews.some((r) => r.status === "PENDING") ? "alert" : "good"} note="on this page" />
        <StatTile label="Published" value={reviews.filter((r) => r.status === "PUBLISHED").length} note="on this page" />
        <StatTile label="Average rating" value={reviews.length ? (reviews.reduce((n, r) => n + r.rating, 0) / reviews.length).toFixed(1) : "—"} note="on this page" />
      </StatGrid>

      {reviews.length === 0 ? (
        <EmptyPanel
          title="No reviews yet"
          body="Customers can review a trip once it's marked complete."
        />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Review</Th><Th>Customer</Th><Th>Listing</Th>
              <Th>Rating</Th><Th>Status</Th><Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <Tr key={r.id}>
                <Td>
                  <p className="max-w-[22rem] text-sm leading-relaxed">
                    {r.comment || <span className="text-[var(--ink-faint)]">(rating only)</span>}
                  </p>
                  <span className="tnum text-2xs text-[var(--ink-faint)]">{r.booking.reference}</span>
                </Td>
                <Td>
                  <span className="block max-w-[11rem] truncate">{r.customer.fullName}</span>
                  <span className="block max-w-[11rem] truncate text-2xs text-[var(--ink-faint)]">{r.customer.email}</span>
                </Td>
                <Td className="max-w-[12rem] truncate">{subjects.get(r.resourceId) ?? r.serviceType}</Td>
                <Td><Rating value={r.rating} /></Td>
                <Td><Badge tone={TONE[r.status]}>{r.status}</Badge></Td>
                <Td>
                  <div className="flex flex-wrap items-start gap-2">
                    {r.status !== "PUBLISHED" && (
                      <ActionButton action={moderateReview} fields={{ reviewId: r.id, action: "PUBLISHED" }} variant="primary">
                        Publish
                      </ActionButton>
                    )}
                    {r.status !== "HIDDEN" && (
                      <ActionButton action={moderateReview} fields={{ reviewId: r.id, action: "HIDDEN" }} variant="ghost">
                        Hide
                      </ActionButton>
                    )}
                    <ActionButton action={moderateReview} fields={{ reviewId: r.id, action: "DELETE" }} variant="ghost" confirm="Confirm delete">
                      Delete
                    </ActionButton>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <Pagination page={page} pathname="/admin/reviews" params={params} label="reviews" />
    </>
  );
}
