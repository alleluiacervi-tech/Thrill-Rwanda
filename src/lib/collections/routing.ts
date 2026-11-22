import { db } from "@/lib/db";
import { configuredGateways, type Gateway } from "./registry";
import { COLLECTION_METHODS, type CollectionMethod } from "./rules";
import type { Prisma } from "@/generated/prisma/client";

type RoutingReader = Pick<Prisma.TransactionClient, "paymentRoutingPolicy">;
export type CollectionRoute = { gateway: Gateway; methods: CollectionMethod[] };

/** Gateways with the methods that configuration, Admin routing policy, currency and amount limits all allow. */
export async function collectionRoutes(currency: string, amountMinor: number, reader: RoutingReader = db): Promise<CollectionRoute[]> {
  const routes: CollectionRoute[] = [];
  for (const gateway of configuredGateways()) {
    const candidates = gateway.eligible(currency, amountMinor);
    if (!candidates.length) continue;
    const policy = await reader.paymentRoutingPolicy.findUnique({ where: { environment: gateway.provider.environment } });
    if (!policy?.enabled || amountMinor < policy.minMinor || amountMinor > policy.maxMinor) continue;
    const methods = candidates.filter((method) => policy.methods.includes(method));
    if (methods.length) routes.push({ gateway, methods });
  }
  return routes;
}

export async function routedPaymentMethods(currency: string, amountMinor: number, reader: RoutingReader = db) {
  const offered = new Set((await collectionRoutes(currency, amountMinor, reader)).flatMap((route) => route.methods));
  return COLLECTION_METHODS.filter((method) => offered.has(method));
}

/** The gateway that will take this method: the first route in priority order that offers it. */
export async function routeForMethod(method: CollectionMethod, currency: string, amountMinor: number, reader: RoutingReader = db) {
  return (await collectionRoutes(currency, amountMinor, reader)).find((route) => route.methods.includes(method))?.gateway ?? null;
}
