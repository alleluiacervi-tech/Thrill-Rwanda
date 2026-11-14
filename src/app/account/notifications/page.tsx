import { NotificationsInbox } from "@/components/dashboard/notifications-inbox";
import { requireUser } from "@/lib/session";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/account/notifications");
  const params = await searchParams;

  return (
    <NotificationsInbox
      userId={user.id}
      lede="Booking confirmations, status changes and account updates."
      emptyBody="We'll let you know here when a booking is confirmed, changed or completed."
      pathname="/account/notifications"
      params={params}
    />
  );
}
