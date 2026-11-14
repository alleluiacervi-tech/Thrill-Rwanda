import { AccountProfileForm } from "@/components/dashboard/account-profile-form";
import { ChangePasswordForm } from "@/components/dashboard/change-password-form";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = {
  title: "My profile",
  robots: { index: false, follow: false },
};

export default async function AdminProfilePage() {
  const sessionUser = await requireAdmin("/admin/profile");
  const user = await db.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: { fullName: true, email: true, phone: true },
  });

  return (
    <>
      <DashboardHead title="My profile" lede="Your own admin account: how you appear and how you sign in." />

      <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_1.15fr] lg:items-start">
        <div className="space-y-6">
          <AccountProfileForm
            user={{ fullName: user.fullName, phone: user.phone }}
            phoneHint="Shown to your team, not to customers."
          />
          <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6">
            <h2 className="text-lg">Sign-in email</h2>
            <p className="mt-2 text-sm text-[var(--ink)]">{user.email}</p>
            <p className="mt-2 text-2xs leading-relaxed text-[var(--ink-muted)]">
              Changing it needs the new address verified, so it isn&rsquo;t editable here yet.
            </p>
          </div>
        </div>
        <ChangePasswordForm />
      </div>
    </>
  );
}
