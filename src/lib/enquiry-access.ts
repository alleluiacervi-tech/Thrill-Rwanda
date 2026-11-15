import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canUseEnquiries } from "@/lib/enquiry-workflow";

/** Read fresh account permissions, never the cached role claim. */
export async function requireEnquiryStaff() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in?next=/staff/enquiries");
  const actor = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      staffRole: true,
      isActive: true,
      fullName: true,
    },
  });
  if (!actor?.isActive) redirect("/suspended");
  if (!canUseEnquiries(actor)) redirect("/account?denied=1");
  return actor;
}
