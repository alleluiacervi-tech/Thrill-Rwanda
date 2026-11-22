import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
export const metadata: Metadata = {
  title: "Staff enquiries",
  robots: { index: false, follow: false },
};
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireEnquiryStaff();
  return (
    <DashboardShell
      role={actor.role === "ADMIN" ? "ADMIN" : (actor.staffRole ?? actor.role)}
      userName={actor.fullName}
      groups={[
        {
          label: "Staff workspace",
          items: [
            { label: "Enquiries", href: "/staff/enquiries", icon: "bookings" },
            ...(actor.staffRole !== "FINANCE" || actor.role === "ADMIN" ? [{ label: "Clients", href: "/staff/contacts", icon: "users" as const }] : []),
            { label: "Reports", href: "/staff/reports", icon: "overview" },
            ...(actor.staffRole !== "FINANCE" || actor.role === "ADMIN" ? [{ label: "Support", href: "/staff/support", icon: "bookings" as const }] : []),
            { label: "Suppliers", href: "/staff/suppliers", icon: "providers" },
            ...(actor.role === "ADMIN" || actor.staffRole === "FINANCE"
              ? [
                  {
                    label: "Off-site finance",
                    href: "/staff/finance",
                    icon: "payments",
                  },
                ]
              : []),
            { label: "My account", href: "/account", icon: "users" },
          ],
        },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
