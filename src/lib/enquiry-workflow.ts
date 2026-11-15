import { z } from "zod";
import type { EnquiryStatus, Prisma } from "@/generated/prisma/client";

export const ENQUIRY_STATUSES = [
  "NEW",
  "CONTACTED",
  "NEEDS_INFORMATION",
  "QUOTE_SENT",
  "AWAITING_PAYMENT",
  "PARTNER_PROCESSING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "LOST",
] as const;
export const SERVICES = [
  "GENERAL",
  "FLIGHT",
  "TRIP",
  "STAY",
  "TRANSPORT",
  "GROUP",
  "EVENT",
] as const;
export const SOURCES = [
  "WEBSITE",
  "WHATSAPP",
  "PHONE",
  "REFERRAL",
  "SOCIAL",
  "CAMPAIGN",
  "OUTREACH",
] as const;
export type EnquiryActor = {
  id: string;
  role: string;
  staffRole: string | null;
  isActive: boolean;
};
export const label = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
export const CLOSED: EnquiryStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "LOST",
];
const transitions: Record<EnquiryStatus, EnquiryStatus[]> = {
  NEW: ["CONTACTED", "NEEDS_INFORMATION", "CANCELLED", "LOST"],
  CONTACTED: ["NEEDS_INFORMATION", "QUOTE_SENT", "CANCELLED", "LOST"],
  NEEDS_INFORMATION: ["CONTACTED", "QUOTE_SENT", "CANCELLED", "LOST"],
  QUOTE_SENT: ["CONTACTED", "AWAITING_PAYMENT", "CANCELLED", "LOST"],
  AWAITING_PAYMENT: ["PARTNER_PROCESSING", "CANCELLED"],
  PARTNER_PROCESSING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: ["REFUNDED"],
  REFUNDED: [],
  LOST: [],
};
export function canUseEnquiries(actor: EnquiryActor) {
  return (
    actor.isActive &&
    (actor.role === "ADMIN" ||
      ["SALES", "OPERATIONS", "FINANCE"].includes(actor.staffRole ?? ""))
  );
}
export function isFinance(actor: EnquiryActor) {
  return actor.role !== "ADMIN" && actor.staffRole === "FINANCE";
}
export function enquiryScope(actor: EnquiryActor): Prisma.EnquiryWhereInput {
  if (!canUseEnquiries(actor))
    return { id: "00000000-0000-0000-0000-000000000000" };
  if (actor.role === "ADMIN") return {};
  if (isFinance(actor))
    return {
      status: {
        in: [
          "AWAITING_PAYMENT",
          "PARTNER_PROCESSING",
          "CONFIRMED",
          "COMPLETED",
          "CANCELLED",
          "REFUNDED",
        ],
      },
    };
  return { OR: [{ ownerId: actor.id }, { ownerId: null }] };
}
export function allowedEnquiryTransitions(
  actor: EnquiryActor,
  from: EnquiryStatus,
) {
  if (!canUseEnquiries(actor)) return [];
  if (actor.role === "ADMIN") return transitions[from];
  const allowed =
    actor.staffRole === "SALES"
      ? [
          "CONTACTED",
          "NEEDS_INFORMATION",
          "QUOTE_SENT",
          "AWAITING_PAYMENT",
          "CANCELLED",
          "LOST",
        ]
      : actor.staffRole === "OPERATIONS"
        ? [
            "CONTACTED",
            "NEEDS_INFORMATION",
            "CONFIRMED",
            "COMPLETED",
            "CANCELLED",
          ]
        : ["PARTNER_PROCESSING", "REFUNDED"];
  return transitions[from].filter((to) => allowed.includes(to));
}
export const triageSchema = z.object({
  reference: z.string().min(4).max(80),
  version: z.coerce.number().int().min(0),
  status: z.enum(ENQUIRY_STATUSES),
  ownerId: z.string().uuid().or(z.literal("")).optional(),
  followUp: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .or(z.literal(""))
    .optional(),
  note: z.string().trim().max(2000).default(""),
  reason: z.string().trim().max(1000).default(""),
  evidence: z.string().trim().max(2000).default(""),
});
export type TriageInput = z.infer<typeof triageSchema>;
export type EnquiryActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
};
export function followUpDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}:00+02:00`);
  if (
    !Number.isFinite(date.getTime()) ||
    new Date(date.getTime() + 7200000).toISOString().slice(0, 16) !== value
  )
    throw new Error("Choose a real follow-up date and time.");
  return date;
}
