import { z } from "zod";
import { db } from "@/lib/db";
import { CLOSED, canUseEnquiries, enquiryScope, isFinance } from "@/lib/enquiry-workflow";
import { todayInRwanda } from "@/lib/flight-enquiry-schema";

export const milestoneKinds = ["VENUE", "ROOMS", "TRANSPORT", "ACTIVITIES"] as const;
export const milestoneStatuses = ["PENDING", "CONFIRMED", "NOT_REQUIRED"] as const;
export const sourcingStatuses = ["PENDING", "AVAILABLE", "HELD", "UNAVAILABLE"] as const;
export const milestoneActivityKinds = milestoneKinds.map((kind) => `BUSINESS_EVENT_${kind}`);
const sourcingKind = "BUSINESS_EVENT_SOURCING";

export function isBusinessEvent(details: unknown) {
  return !!details && typeof details === "object" &&
    "journey" in details && details.journey === "BUSINESS_EVENT";
}

const common = {
  reference: z.string().trim().min(1).max(80),
  version: z.coerce.number().int().nonnegative(),
};

export const businessEventUpdate = z.discriminatedUnion("command", [
  z.object({
    ...common,
    command: z.literal("SOURCE"),
    venue: z.string().trim().min(2).max(160),
    layout: z.string().trim().max(120).default(""),
    capacity: z.union([z.literal(""), z.coerce.number().int().min(1).max(100000)]).default(""),
    facilities: z.string().trim().max(1000).default(""),
    status: z.enum(sourcingStatuses),
    holdUntil: z.union([z.iso.date(), z.literal("")]),
    evidence: z.string().trim().min(5).max(2000),
  }),
  z.object({
    ...common,
    command: z.literal("MILESTONE"),
    milestone: z.enum(milestoneKinds),
    status: z.enum(milestoneStatuses),
    evidence: z.string().trim().min(5).max(2000),
  }),
]).refine((input) => input.command !== "SOURCE" ||
  (input.status === "HELD") === Boolean(input.holdUntil), {
  message: "Enter a hold deadline only for a held venue.",
});

export class BusinessEventError extends Error {}

export async function updateBusinessEvent(actorId: string, input: z.infer<typeof businessEventUpdate>) {
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({
      where: { id: actorId },
      select: { id: true, role: true, staffRole: true, isActive: true },
    });
    if (!actor || !canUseEnquiries(actor) || isFinance(actor))
      throw new BusinessEventError("You do not have event planning access.");
    const enquiry = await tx.enquiry.findFirst({
      where: { reference: input.reference, ...enquiryScope(actor) },
      select: { id: true, ownerId: true, status: true, details: true },
    });
    if (!enquiry || !isBusinessEvent(enquiry.details) ||
      (actor.role !== "ADMIN" && enquiry.ownerId !== actor.id))
      throw new BusinessEventError("Assign the business event to yourself before updating it.");
    if (CLOSED.includes(enquiry.status))
      throw new BusinessEventError("This event case is closed.");
    if (input.command === "SOURCE" && input.holdUntil && input.holdUntil < todayInRwanda())
      throw new BusinessEventError("Choose a hold deadline that has not passed.");

    const result = await tx.enquiry.updateMany({
      where: { id: enquiry.id, version: input.version },
      data: { version: { increment: 1 } },
    });
    if (result.count !== 1)
      throw new BusinessEventError("The case has changed. Reload it before saving.");
    await tx.enquiryActivity.create({
      data: {
        enquiryId: enquiry.id,
        actorId,
        kind: input.command === "SOURCE" ? sourcingKind : `BUSINESS_EVENT_${input.milestone}`,
        body: input.evidence,
        changes: input.command === "SOURCE"
          ? {
              venue: input.venue,
              status: input.status,
              holdUntil: input.holdUntil,
              layout: input.layout,
              capacity: input.capacity,
              facilities: input.facilities,
            }
          : { status: input.status },
      },
    });
    return input.reference;
  });
}

export async function businessEventSourcing(enquiryId: string) {
  const checks = await db.enquiryActivity.findMany({
    where: { enquiryId, kind: sourcingKind },
    select: { id: true, changes: true, body: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  const venues = new Set<string>();
  return checks.filter((check) => {
    const { venue } = check.changes as { venue: string };
    const key = venue.toLowerCase();
    if (venues.has(key)) return false;
    venues.add(key);
    return true;
  });
}

export function businessEventMilestones(rows: { kind: string; changes: unknown }[]) {
  return milestoneKinds.map((milestone) => {
    const row = rows.find(({ kind }) => kind === `BUSINESS_EVENT_${milestone}`);
    const status = (row?.changes as { status?: string } | undefined)?.status;
    return { milestone, status: milestoneStatuses.find((value) => value === status) ?? "PENDING" };
  });
}
