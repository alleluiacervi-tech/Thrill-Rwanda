import { markNotificationsRead } from "@/app/actions/account";
import { ActionButton } from "@/components/dashboard/action-button";
import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { NotificationList } from "@/components/dashboard/notification-list";
import { Pagination } from "@/components/ui/pagination";
import { paginate } from "@/lib/pagination";
import { db } from "@/lib/db";

// Rows are per-user, so the same inbox serves every dashboard — the caller
// just passes the id its own guard already resolved.
export async function NotificationsInbox({
  userId,
  lede,
  emptyBody,
  pathname,
  params,
}: {
  userId: string;
  lede: string;
  emptyBody: string;
  /** Where the page lives, so paging keeps the right URL. */
  pathname: string;
  params: Record<string, string | string[] | undefined>;
}) {
  const page = paginate(params, await db.notification.count({ where: { userId } }));

  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: page.skip,
      take: page.take,
    }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);

  return (
    <>
      <DashboardHead
        title="Notifications"
        lede={lede}
        action={
          unread > 0 ? (
            <ActionButton action={markNotificationsRead} fields={{}} variant="quiet">
              Mark all read
            </ActionButton>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyPanel title="Nothing yet" body={emptyBody} />
      ) : (
        <NotificationList
          items={items.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            href: n.href,
            createdAt: n.createdAt.toISOString(),
            read: n.readAt !== null,
          }))}
        />
      )}

      <Pagination page={page} pathname={pathname} params={params} label="notifications" />
    </>
  );
}
