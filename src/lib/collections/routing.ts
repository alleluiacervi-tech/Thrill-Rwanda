import { db } from "@/lib/db";
import { getUrubutoProvider } from "./urubuto";
import type { Prisma } from "@/generated/prisma/client";

type RoutingReader = Pick<Prisma.TransactionClient, "paymentRoutingPolicy">;

export async function routedPaymentMethods(currency: string, amountMinor: number, reader: RoutingReader = db) {
  const gateway = getUrubutoProvider();
  const candidates = gateway?.eligible(currency, amountMinor) ?? [];
  if (!gateway || !candidates.length) return [];
  const policy = await reader.paymentRoutingPolicy.findUnique({
    where: { environment: gateway.provider.environment },
  });
  if (!policy?.enabled || amountMinor < policy.minMinor || amountMinor > policy.maxMinor) return [];
  return candidates.filter((method) => policy.methods.includes(method));
}
