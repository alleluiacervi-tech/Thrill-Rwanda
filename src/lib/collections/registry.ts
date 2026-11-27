import type { CollectionProvider } from "./provider";
import type { CollectionMethod } from "./rules";
import { getAirtelLiveGateway } from "./airtel";
import { getMtnLiveGateway } from "./mtn";
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
 * A method is routed to the first enabled gateway that offers it. Direct providers come ahead of
 * UrubutoPay, so MTN MoMo and Airtel Money go straight to the operator once each is approved, and
 * cards (and either wallet while its direct route is off) stay with UrubutoPay.
 */
export function configuredGateways(env: Environment = process.env): Gateway[] {
  return [getMtnLiveGateway(env), getAirtelLiveGateway(env), getUrubutoProvider(env)].filter((gateway): gateway is Gateway => !!gateway);
}

type AttemptIdentity = { provider: string; environment: string; merchantCode: string; serviceCode: string };

/** Attempts stay with the provider that created them; this resolves that provider's current configuration. */
export function gatewayForAttempt(attempt: AttemptIdentity, env: Environment = process.env) {
  return configuredGateways(env).find(({ provider }) =>
    provider.id === attempt.provider && provider.environment === attempt.environment &&
    provider.merchantCode === attempt.merchantCode && provider.serviceCode === attempt.serviceCode) ?? null;
}
