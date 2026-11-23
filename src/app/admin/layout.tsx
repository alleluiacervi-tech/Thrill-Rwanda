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
  const [pendingProviders, pendingReviews, unread, me] = await Promise.all([
    db.provider.count({ where: { status: "PENDING" } }),
    db.review.count({ where: { status: "PENDING" } }),
    unreadCount(user.id),
    db.user.findUnique({ where: { id: user.id }, select: { isSuperAdmin: true } }),
  ]);

  const workspaces = await workspacesFor(user, "admin");

  const groups: NavGroup[] = [
    {
      label: "Main",
      items: [
        { label: "Overview", href: "/admin", icon: "overview" },
        { label: "Clients", href: "/admin/contacts", icon: "users" },
        { label: "Enquiries", href: "/admin/enquiries", icon: "bookings" },
        { label: "Air ticketing", href: "/admin/ticketing", icon: "transfers" },
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
        { label: "Wedding venues", href: "/admin/venues", icon: "listings" },
        { label: "Business venues", href: "/admin/business-venues", icon: "listings" },
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
        { label: "Corporate accounts", href: "/admin/clients", icon: "users" },
        { label: "Support", href: "/admin/support", icon: "bookings" },
        { label: "Suppliers", href: "/admin/suppliers", icon: "providers" },
        { label: "Reviews", href: "/admin/reviews", badge: pendingReviews, icon: "reviews" },
      ],
    },
    {
      label: "Finance & insight",
      items: [
        { label: "Reports", href: "/admin/reports", icon: "overview" },
        { label: "Off-site finance", href: "/admin/finance", icon: "payments" },
        { label: "Gateway payments", href: "/admin/payments", icon: "payments" },
      ],
    },
    {
      label: "Administration",
      items: [
        { label: "Team & access", href: "/admin/users", icon: "users" },
        // Super admins only: the permanent record of who did what.
        ...(me?.isSuperAdmin ? [{ label: "Activity log", href: "/admin/activity", icon: "overview" }] : []),
        { label: "Email templates", href: "/admin/emails", icon: "emails" },
        { label: "Legal pages", href: "/admin/legal", icon: "legal" },
        { label: "Launch readiness", href: "/admin/readiness", icon: "settings" },
        { label: "Launch controls", href: "/admin/launch", icon: "settings" },
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
