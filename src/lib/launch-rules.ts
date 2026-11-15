import { z } from "zod";
export const PUBLIC_SERVICES = [
  "FLIGHT",
  "TRIP",
  "STAY",
  "TRANSPORT",
  "GROUP",
  "EVENT",
] as const;
export type PublicService = (typeof PUBLIC_SERVICES)[number];
export const PUBLIC_MODES = ["HIDDEN", "ENQUIRY", "DIRECT"] as const;
export type PublicMode = (typeof PUBLIC_MODES)[number];
export function serviceFor(value: string): PublicService | null {
  const routes: Record<string, PublicService> = {
    TOUR: "TRIP",
    ROOM: "STAY",
    VEHICLE: "TRANSPORT",
    TRANSFER: "TRANSPORT",
    "/flights": "FLIGHT",
    "/tours": "TRIP",
    "/hotels": "STAY",
    "/cars": "TRANSPORT",
    "/transfers": "TRANSPORT",
    "/corporate": "GROUP",
  };
  return Object.hasOwn(routes, value)
    ? routes[value]
    : PUBLIC_SERVICES.includes(value as PublicService)
      ? (value as PublicService)
      : null;
}
export type Publications = Record<PublicService, PublicMode>;
export const defaultPublications = (): Publications =>
  Object.fromEntries(
    PUBLIC_SERVICES.map((s) => [s, "ENQUIRY"]),
  ) as Publications;
export function publicationMap(
  rows: { service: string; mode: string }[],
): Publications {
  const result = defaultPublications();
  for (const r of rows)
    if (
      PUBLIC_SERVICES.includes(r.service as PublicService) &&
      PUBLIC_MODES.includes(r.mode as PublicMode)
    )
      result[r.service as PublicService] = r.mode as PublicMode;
  return result;
}
export function visiblePath(path: string, modes: Publications) {
  const s = serviceFor(path.split("?")[0]);
  return !s || modes[s] !== "HIDDEN";
}
export const approvalSchema = z
  .object({
    service: z.enum(PUBLIC_SERVICES),
    mode: z.enum(PUBLIC_MODES),
    version: z.coerce.number().int().min(-1),
    evidence: z.string().trim().min(10).max(3000),
  })
  .superRefine((v, c) => {
    if (v.mode === "DIRECT" && ["FLIGHT", "GROUP", "EVENT"].includes(v.service))
      c.addIssue({
        code: "custom",
        message: "This service supports enquiries only",
        path: ["mode"],
      });
  });
export const SUPPORT_CATEGORIES = [
  "CHANGE",
  "CANCELLATION",
  "REFUND",
  "SUPPLIER",
  "SERVICE",
  "DOCUMENT",
  "OTHER",
] as const;
export const SUPPORT_STATUSES = [
  "OPEN",
  "WAITING_CUSTOMER",
  "WAITING_SUPPLIER",
  "ESCALATED",
  "RESOLVED",
] as const;
export const supportSchema = z
  .object({
    intentKey: z.string().uuid(),
    reference: z.string().max(80).default(""),
    version: z.coerce.number().int().min(0).default(0),
    enquiryRef: z.string().trim().max(80).default(""),
    bookingRef: z.string().trim().max(80).default(""),
    ownerId: z.string().uuid(),
    category: z.enum(SUPPORT_CATEGORIES),
    priority: z.enum(["NORMAL", "URGENT"]),
    status: z.enum(SUPPORT_STATUSES),
    summary: z.string().trim().min(10).max(2000),
    nextActionAt: z.string().min(1).max(30),
    outcome: z.string().trim().max(2000).default(""),
    evidence: z.string().trim().min(10).max(2000),
  })
  .superRefine((v, c) => {
    if (!v.reference && Number(!!v.enquiryRef) + Number(!!v.bookingRef) !== 1)
      c.addIssue({
        code: "custom",
        message: "Link exactly one enquiry or booking",
      });
    if (v.status === "RESOLVED" && v.outcome.length < 10)
      c.addIssue({
        code: "custom",
        message: "Record the resolution and customer handover",
      });
  });
export const policySchema = z.object({
  version: z.coerce.number().int().min(-1),
  supportHours: z.string().trim().min(5).max(500),
  escalation: z.string().trim().min(10).max(1500),
  emergencyNotice: z.string().trim().min(10).max(1000),
  documentPurpose: z.string().trim().min(10).max(1500),
  documentDays: z.coerce.number().int().min(1).max(90),
  documentsEnabled: z.boolean(),
  evidence: z.string().trim().min(10).max(2000),
});
export const interactionSchema = z
  .object({
    service: z.enum(PUBLIC_SERVICES),
    placement: z.enum(["HOME_HERO", "HOME_SERVICES", "SERVICE_REQUEST"]),
  })
  .strict();
/** Quote every field; a leading apostrophe prevents formulas even after whitespace/control prefixes. */
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text))
    text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
export const csv = (rows: unknown[][]) =>
  "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
export class OperationsError extends Error {}
export type OperationsState = {
  status: "idle" | "ok" | "error";
  message?: string;
};
