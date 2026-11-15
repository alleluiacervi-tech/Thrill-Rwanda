import type { Prisma } from "@/generated/prisma/client";
export async function enqueueEnquiryNotifications(
  tx: Prisma.TransactionClient,
  enquiry: { id: string; email: string | null; replyChannel: string },
) {
  const admins = await tx.user.findMany({
    where: { isActive: true, role: "ADMIN" },
    select: { id: true },
  });
  const jobs: Prisma.NotificationJobCreateManyInput[] = admins.map((admin) => ({
    enquiryId: enquiry.id,
    dedupeKey: `${enquiry.id}:staff:${admin.id}`,
    kind: "STAFF_ALERT",
    channel: "IN_APP",
    recipientId: admin.id,
  }));
  if (enquiry.replyChannel === "EMAIL" && enquiry.email)
    jobs.push({
      enquiryId: enquiry.id,
      dedupeKey: `${enquiry.id}:ack`,
      kind: "CUSTOMER_ACK",
      channel: "EMAIL",
      toEmail: enquiry.email,
    });
  if (jobs.length)
    await tx.notificationJob.createMany({ data: jobs, skipDuplicates: true });
}
export async function enqueueOwnerNotification(
  tx: Prisma.TransactionClient,
  enquiryId: string,
  ownerId: string,
  version: number,
) {
  await tx.notificationJob.create({
    data: {
      enquiryId,
      dedupeKey: `${enquiryId}:owner:${version}`,
      kind: "STAFF_ASSIGNED",
      channel: "IN_APP",
      recipientId: ownerId,
    },
  });
}
