import type { CollectionProvider } from "./provider";
import type { CollectionMethod } from "./rules";
import { getUrubutoProvider } from "./urubuto";

export type Gateway = {
  provider: CollectionProvider;
  enabled: boolean;
  origin: string | null;
  eligible: (currency: string, amountMinor: number) => CollectionMethod[];
};
type Environment = Record<string, string | undefined>;

/**
 * Every collection provider that is configured in this environment, in routing priority order.
 * A method is routed to the first enabled gateway that offers it. Register new direct providers
 * (MTN, Airtel) here ahead of UrubutoPay when they are approved for customer routing.
 */
export function configuredGateways(env: Environment = process.env): Gateway[] {
  return [getUrubutoProvider(env)].filter((gateway): gateway is Gateway => !!gateway);
}

type AttemptIdentity = { provider: string; environment: string; merchantCode: string; serviceCode: string };

/** Attempts stay with the provider that created them; this resolves that provider's current configuration. */
export function gatewayForAttempt(attempt: AttemptIdentity, env: Environment = process.env) {
  return configuredGateways(env).find(({ provider }) =>
    provider.id === attempt.provider && provider.environment === attempt.environment &&
    provider.merchantCode === attempt.merchantCode && provider.serviceCode === attempt.serviceCode) ?? null;
}
