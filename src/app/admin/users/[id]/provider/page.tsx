import { notFound, redirect } from "next/navigation";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { MakeProviderForm } from "@/components/dashboard/make-provider-form";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = {
  title: "Make provider",
  robots: { index: false, follow: false },
};

export default async function MakeProviderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin("/admin/users");
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      provider: { select: { id: true } },
    },
  });
  if (!user) notFound();

  // Already has a record: the Providers page is where it is managed.
  if (user.provider) redirect("/admin/providers");

  return (
    <>
      <DashboardHead
        back={{ href: "/admin/users", label: "Back to users" }}
        title={`Make ${user.fullName} a provider`}
        lede={`Creates the business record for ${user.email} and promotes the account. They keep their bookings as a customer.`}
      />

      <MakeProviderForm
        userId={user.id}
        userName={user.fullName}
        defaultName={user.fullName}
        defaultPhone={user.phone ?? ""}
      />
    </>
  );
}
