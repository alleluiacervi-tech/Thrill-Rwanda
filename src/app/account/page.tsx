import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, CreditCard, ShieldCheck, Star } from "lucide-react";
import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatMoney } from "@/lib/utils";

export default async function AccountOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const denied = (await searchParams).denied === "1";

  // Scoped to the SESSION user — never to an id from the request.
  const [upcoming, totalSpentAgg, reviewCount, bookingCount, application] = await Promise.all([
    db.booking.count({
      where: { customerId: user.id, status: { in: ["CONFIRMED", "PAID"] } },
    }),
    db.payment.groupBy({
      by: ["currency"],
      where: { status: "SUCCEEDED", booking: { customerId: user.id } },
      _sum: { amountMinor: true },
    }),
    db.review.count({ where: { customerId: user.id } }),
    db.booking.count({ where: { customerId: user.id } }),
    db.provider.findUnique({ where: { userId: user.id }, select: { businessName: true, status: true } }),
  ]);

  // Applicants stay customers until approved, so this page is where they need to see where things stand.
  const applicationCopy = application
    ? {
        PENDING: { title: "Your business application is being reviewed", body: "We're verifying your details. We'll email you as soon as it's approved, usually within two weeks.", cta: "View application", href: "/provider/pending" },
        VERIFIED: { title: `${application.businessName} is approved`, body: "Your provider portal is ready. Add listings and manage bookings from there.", cta: "Open provider portal", href: "/provider" },
        REJECTED: { title: "We couldn't approve your business application", body: "Get in touch and we'll tell you what's missing. Most issues are fixable.", cta: "View details", href: "/provider/pending" },
        SUSPENDED: { title: `${application.businessName} is suspended`, body: "Your listings are hidden and new bookings are paused. Contact us to resolve it.", cta: "View details", href: "/provider/pending" },
      }[application.status]
    : null;

  const stats = [
    { icon: CalendarDays, label: "Upcoming bookings", value: String(upcoming) },
    {
      icon: CreditCard,
      label: "Total paid",
      value: totalSpentAgg.map(group => formatMoney(group._sum.amountMinor ?? 0, group.currency)).join(" · ") || "No payments yet",
    },
    { icon: Star, label: "Reviews left", value: String(reviewCount) },
  ];

  return (
    <>
      <DashboardHead
        title={`Karibu, ${(user.name ?? "").split(" ")[0] || "traveller"}`}
        lede="Your bookings, payments and confirmations in one place."
        action={
          <Button href="/tours" variant="accent">
            Book something new
          </Button>
        }
      />

      {denied && (
        <p
          role="alert"
          className="mb-8 rounded-[var(--radius-inset)] border border-clay-300 bg-clay-100 p-4 text-sm text-clay-900"
        >
          You don&rsquo;t have access to that area. This is your customer
          dashboard.
        </p>
      )}

      {application && applicationCopy ? (
        <div
          className={`mb-8 flex flex-col gap-4 rounded-[var(--radius-card)] border p-5 sm:flex-row sm:items-center ${
            application.status === "VERIFIED" ? "border-forest-300 bg-forest-100" : "border-clay-300 bg-clay-100"
          }`}
        >
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-full ${
              application.status === "VERIFIED" ? "bg-forest-800 text-bone-50" : "bg-clay-700 text-bone-50"
            }`}
          >
            {application.status === "VERIFIED" ? <ShieldCheck className="size-5" /> : <Clock3 className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-[var(--ink)]">{applicationCopy.title}</p>
            <p className="mt-0.5 text-sm text-[var(--ink-muted)]">{applicationCopy.body}</p>
          </div>
          <Button href={applicationCopy.href} variant={application.status === "VERIFIED" ? "primary" : "outline"}>
            {applicationCopy.cta}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : null}

      <dl className="mb-10 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6"
          >
            <dt className="flex items-center gap-2 text-2xs uppercase tracking-[0.14em] text-[var(--ink-faint)]">
              <s.icon className="size-3.5 text-clay-600" />
              {s.label}
            </dt>
            <dd className="tnum mt-2 font-display text-3xl font-semibold">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      {bookingCount === 0 ? (
        <EmptyPanel
          title="No bookings yet"
          body="Everything you book will appear here with its status, payments and confirmation."
          action={
            <Link href="/tours" className="link-draw text-sm font-medium text-clay-700">
              Browse safaris
            </Link>
          }
        />
      ) : (
        <Link href="/account/bookings" className="link-draw inline-flex items-center gap-1.5 text-sm font-medium text-clay-700">
          View all {bookingCount} {bookingCount === 1 ? "booking" : "bookings"}
          <ArrowRight className="size-4" />
        </Link>
      )}
    </>
  );
}
