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
      role={actor.staffRole ?? actor.role}
      userName={actor.fullName}
      groups={[
        {
          label: "Staff workspace",
          items: [
            { label: "Enquiries", href: "/staff/enquiries", icon: "bookings" },
            { label: "My account", href: "/account", icon: "users" },
          ],
        },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
