import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { AccountProfileForm } from "@/components/dashboard/account-profile-form";
import { Badge } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function ProfilePage() {
  const sessionUser = await requireUser("/account/profile");

  const user = await db.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: { fullName: true, email: true, phone: true, role: true, createdAt: true },
  });

  return (
    <>
      <DashboardHead
        title="Profile"
        lede="The details we use to reach you about a booking."
        action={<Badge tone="neutral">{user.role}</Badge>}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,32rem)_1fr]">
        <AccountProfileForm user={{ fullName: user.fullName, phone: user.phone }} />

        <aside className="space-y-4">
          <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-sunken)] p-6">
            <h2 className="text-lg">Sign-in email</h2>
            <p className="mt-2 text-sm text-[var(--ink)]">{user.email}</p>
            <p className="mt-3 text-2xs leading-relaxed text-[var(--ink-muted)]">
              Changing your email needs re-verification, so contact us and
              we&rsquo;ll do it for you. To change your password, sign out and
              use &ldquo;Forgot password&rdquo;.
            </p>
            <p className="tnum mt-4 text-2xs text-[var(--ink-faint)]">
              Member since{" "}
              {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(user.createdAt)}
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
