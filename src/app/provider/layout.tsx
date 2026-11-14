import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { unreadCount } from "@/lib/notifications";
import { requireUser, workspacesFor } from "@/lib/session";

export const metadata: Metadata = {
  title: "Provider portal",
  robots: { index: false, follow: false },
};

/**
 * Only checks that the visitor is signed in. The provider-scoping guard
 * (`requireProvider`) runs per page, because /provider/apply and
 * /provider/pending must stay reachable by someone who has no verified
 * provider record yet.
 */
export default async function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser("/provider");
  const [unread, workspaces] = await Promise.all([
    unreadCount(user.id),
    workspacesFor(user, "provider"),
  ]);

  const nav = [
    { label: "Overview", href: "/provider" },
    { label: "Bookings", href: "/provider/bookings" },
    { label: "Listings", href: "/provider/listings" },
    { label: "Availability", href: "/provider/availability" },
    { label: "Notifications", href: "/provider/notifications", badge: unread },
    { label: "Profile", href: "/provider/profile" },
  ];

  return (
    <DashboardShell
      nav={nav}
      role={user.role ?? "CUSTOMER"}
      userName={user.name ?? user.email}
      notifications={{ href: "/provider/notifications", unread }}
      workspaces={workspaces}
    >
      {children}
    </DashboardShell>
  );
}
