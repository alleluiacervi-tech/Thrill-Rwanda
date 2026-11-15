"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { db } from "@/lib/db";
import type { EnquiryActionState } from "@/lib/enquiry-workflow";
export async function setStaffAccess(
  _previous: EnquiryActionState,
  form: FormData,
): Promise<EnquiryActionState> {
  const actor = await requireEnquiryStaff();
  if (actor.role !== "ADMIN")
    return { status: "error", message: "Administrator access is required." };
  const parsed = z
    .object({
      userId: z.string().uuid(),
      staffRole: z.enum(["SALES", "OPERATIONS", "FINANCE", ""]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { status: "error", message: "Choose a valid staff permission." };
  try {
    await db.$transaction(async (tx) => {
      const fresh = await tx.user.findUnique({ where: { id: actor.id } });
      if (!fresh?.isActive || fresh.role !== "ADMIN") throw new Error("denied");
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${parsed.data.userId}::uuid FOR UPDATE`;
      const target = await tx.user.findUniqueOrThrow({
        where: { id: parsed.data.userId },
      });
      if (!target.isActive && parsed.data.staffRole)
        throw new Error("inactive");
      await tx.user.update({
        where: { id: target.id },
        data: { staffRole: parsed.data.staffRole || null },
      });
      await tx.staffAccessChange.create({
        data: {
          actorId: actor.id,
          targetId: target.id,
          previousRole: target.staffRole,
          nextRole: parsed.data.staffRole || null,
        },
      });
    });
    revalidatePath("/admin/users");
    revalidatePath("/staff/enquiries");
    return { status: "ok", message: "Staff access updated and audited." };
  } catch {
    return {
      status: "error",
      message:
        "Could not change staff access. Check account status and administrator permissions.",
    };
  }
}
