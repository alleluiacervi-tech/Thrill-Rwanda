import type { Prisma } from "@/generated/prisma/client";
import { dateRange, searchTerm } from "@/lib/table-query";
import { todayInRwanda } from "@/lib/flight-enquiry-schema";
import { COLLECTION_METHODS, paymentStatusLabel } from "./rules";
import { PUBLIC_SERVICES, serviceFor } from "@/lib/launch-rules";

export type PaymentQuery = Record<string, string | string[] | undefined>;
export const paymentRowInclude = {
  invoice: {
    include: {
      booking: { select: { reference: true, serviceType: true, customer: { select: { fullName: true } } } },
      financialCase: { select: { enquiry: { select: { reference: true, service: true, name: true } } } },
    },
  },
} satisfies Prisma.CollectionAttemptInclude;

export function paymentRegisterWhere(raw: PaymentQuery): Prisma.CollectionAttemptWhereInput {
  const status = typeof raw.status === "string" && Object.hasOwn(paymentStatusLabel, raw.status) ? raw.status : undefined;
  const method = COLLECTION_METHODS.find((item) => raw.method === item);
  const currency = raw.currency === "RWF" ? "RWF" : undefined;
  const q = searchTerm(raw).slice(0, 160);
  const ilike = { contains: q, mode: "insensitive" as const };
  const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(q);
  const service = PUBLIC_SERVICES.find((item) => item === raw.service);
  const serviceFilter: Prisma.CollectionAttemptWhereInput[] = service ? [
    { invoice: { financialCase: { enquiry: { service } } } },
    ...(["TOUR", "ROOM", "VEHICLE", "TRANSFER"] as const)
      .filter((type) => serviceFor(type) === service)
      .map((type) => ({ invoice: { booking: { serviceType: type } } })),
  ] : [];
  return {
    environment: process.env.APP_ENV === "production" ? "live" : "staging",
    status, method, currency,
    settlementStatus: ["UNRECONCILED", "SETTLED", "REVIEW"].includes(String(raw.settlement)) ? String(raw.settlement) : undefined,
    createdAt: raw.range === "today" ? { gte: new Date(`${todayInRwanda()}T00:00:00+02:00`) } : dateRange(raw),
    ...(serviceFilter.length ? { AND: [{ OR: serviceFilter }] } : {}),
    ...(q ? { OR: [
      { providerReference: ilike },
      ...(uuid ? [{ merchantReference: q }] : []),
      { invoice: { number: ilike } },
      { invoice: { booking: { reference: ilike } } },
      { invoice: { booking: { customer: { fullName: ilike } } } },
      { invoice: { financialCase: { enquiry: { reference: ilike } } } },
      { invoice: { financialCase: { enquiry: { name: ilike } } } },
    ] } : {}),
  };
}
