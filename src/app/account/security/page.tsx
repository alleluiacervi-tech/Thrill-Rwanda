import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { TwoFactorSetup } from "@/components/dashboard/two-factor-setup";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { twoFactorRequired } from "@/lib/two-factor-policy";

export const metadata = { title: "Sign-in security", robots: { index: false, follow: false } };

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireUser("/account/security");
  const params = await searchParams;
  const [user, trusted] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: me.id },
      select: { email: true, role: true, staffRole: true, twoFactorEnabled: true },
    }),
    db.verification.count({
      where: { identifier: { startsWith: "trust-device-" }, value: me.id, expiresAt: { gt: new Date() } },
    }),
  ]);
  const required = twoFactorRequired(user);
  const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : undefined;

  return (
    <>
      <DashboardHead
        title="Sign-in security"
        lede={
          required
            ? "Two-step sign-in protects customers' details and money. It is required for administrators and staff."
            : "Add a second step to your sign-in: a six-digit code from an authenticator app on your phone."
        }
      />
      {params.setup === "required" && !user.twoFactorEnabled ? (
        <p role="status" className="mb-6 max-w-2xl rounded-[var(--radius-inset)] border border-sun-300 bg-sun-50 p-4 text-sm leading-relaxed text-sun-900">
          Your role needs two-step sign-in before you can open the dashboard. It takes about two minutes: set it up below
          and you&rsquo;ll go straight on to where you were heading.
        </p>
      ) : null}
      <div className="max-w-3xl">
        <TwoFactorSetup
          enabled={user.twoFactorEnabled}
          required={required}
          trustedDevices={trusted}
          next={next}
          email={user.email}
        />
      </div>
    </>
  );
}
