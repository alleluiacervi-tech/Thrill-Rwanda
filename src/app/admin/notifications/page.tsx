import { NotificationsInbox } from "@/components/dashboard/notifications-inbox";
import { requireAdmin } from "@/lib/session";

export const metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdmin("/admin/notifications");
  const params = await searchParams;

  return (
    <NotificationsInbox
      userId={user.id}
      lede="Platform events addressed to you — new provider applications, and anything else needing an admin."
      emptyBody="Provider applications and other events needing an admin will appear here."
      pathname="/admin/notifications"
      params={params}
    />
  );
}
