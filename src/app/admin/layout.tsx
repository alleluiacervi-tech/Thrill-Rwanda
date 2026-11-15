import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { NavGroup } from "@/components/dashboard/nav-types";
import { db } from "@/lib/db";
import { unreadCount } from "@/lib/notifications";
import { requireAdmin, workspacesFor } from "@/lib/session";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();


  /* Two badges, both for work that is actually waiting on the admin. Counting
     anything else here would put a number on the sidebar of every page load
     for no decision. */
  const [pendingProviders, pendingReviews, unread] = await Promise.all([
    db.provider.count({ where: { status: "PENDING" } }),
    db.review.count({ where: { status: "PENDING" } }),
    unreadCount(user.id),
  ]);

  const workspaces = await workspacesFor(user, "admin");

  const groups: NavGroup[] = [
    {
      label: "Main",
      items: [
        { label: "Overview", href: "/admin", icon: "overview" },
        { label: "Enquiries", href: "/admin/enquiries", icon: "bookings" },
        { label: "Bookings", href: "/admin/bookings", icon: "bookings" },
      ],
    },
    {
      label: "Catalogue",
      items: [
        { label: "All listings", href: "/admin/listings", icon: "listings" },
        { label: "Tours & safaris", href: "/admin/listings?kind=TOUR", icon: "tours" },
        { label: "Hotels & rooms", href: "/admin/listings?kind=HOTEL", icon: "hotels" },
        { label: "Vehicles", href: "/admin/listings?kind=VEHICLE", icon: "vehicles" },
        { label: "Transfer zones", href: "/admin/transfers", icon: "transfers" },
      ],
    },
    {
      label: "Providers",
      items: [
        { label: "All providers", href: "/admin/providers", icon: "providers" },
        {
          label: "Awaiting approval",
          href: "/admin/providers?status=PENDING",
          icon: "providers",
          badge: pendingProviders,
        },
        { label: "Car hire", href: "/admin/providers?kind=CAR", icon: "vehicles" },
        { label: "Hotel owners", href: "/admin/providers?kind=HOTEL", icon: "hotels" },
        { label: "Tour operators", href: "/admin/providers?kind=TOUR", icon: "tours" },
      ],
    },
    {
      label: "Operations",
      items: [
        { label: "Payments", href: "/admin/payments", icon: "payments" },
        { label: "Reviews", href: "/admin/reviews", badge: pendingReviews, icon: "reviews" },
        { label: "Users & roles", href: "/admin/users", icon: "users" },
        { label: "Email templates", href: "/admin/emails", icon: "emails" },
        { label: "Legal pages", href: "/admin/legal", icon: "legal" },
        { label: "Settings", href: "/admin/settings", icon: "settings" },
      ],
    },
  ];

  return (
    <DashboardShell
      groups={groups}
      role="ADMIN"
      userName={user.name ?? user.email}
      notifications={{ href: "/admin/notifications", unread }}
      workspaces={workspaces}
    >
      {children}
    </DashboardShell>
  );
}
