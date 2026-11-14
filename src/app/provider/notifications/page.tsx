import { NotificationsInbox } from "@/components/dashboard/notifications-inbox";
import { requireUser } from "@/lib/session";

export const metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

// requireUser, not requireProvider: applicants waiting on approval get notifications too.
export default async function ProviderNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/provider/notifications");
  const params = await searchParams;

  return (
    <NotificationsInbox
      userId={user.id}
      lede="New bookings, payments and updates about your listings."
      emptyBody="We'll let you know here when a guest books, pays or when your account status changes."
      pathname="/provider/notifications"
      params={params}
    />
  );
}
