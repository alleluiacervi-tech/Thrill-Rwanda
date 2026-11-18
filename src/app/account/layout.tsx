import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { unreadCount } from "@/lib/notifications";
import { requireUser, workspacesFor } from "@/lib/session";

export const metadata: Metadata = {
  title: "My account",
  robots: { index: false, follow: false },
};


export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser("/account");
  const [unread, workspaces] = await Promise.all([
    unreadCount(user.id),
    workspacesFor(user, "customer"),
  ]);

  const nav = [
    { label: "Overview", href: "/account" },
    { label: "My travel requests", href: "/account/enquiries" },
    { label: "Company travel", href: "/account/corporate" },
    { label: "My bookings", href: "/account/bookings" },
    { label: "Notifications", href: "/account/notifications", badge: unread },
    { label: "Profile", href: "/account/profile" },
    { label: "Sign-in security", href: "/account/security" },
  ];

  return (
    <DashboardShell
      nav={nav}
      role={user.role ?? "CUSTOMER"}
      userName={user.name ?? user.email}
      notifications={{ href: "/account/notifications", unread }}
      workspaces={workspaces}
    >
      {children}
    </DashboardShell>
  );
}
