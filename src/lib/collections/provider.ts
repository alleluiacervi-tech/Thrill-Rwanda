import type { CollectionMethod } from "./rules";

export type ProviderPayment = {
  reference: string;
  amountMinor: number;
  currency: string;
  method: CollectionMethod;
};

export type VerifiedPayment =
  | { state: "pending" | "paid" | "failed"; providerReference: string }
  | { state: "missing" | "mismatch" };

export interface CollectionProvider {
  readonly id: string;
  readonly environment: string;
  readonly merchantCode: string;
  readonly serviceCode: string;
  getCapabilities(): {
    methods: readonly CollectionMethod[];
    currencies: readonly string[];
    refunds: boolean;
    automatedSettlements: boolean;
  };
  createPayment(payment: ProviderPayment & { name: string; email: string; phone: string; returnUrl: string }): Promise<{ providerReference: string; hostedUrl?: string }>;
  verifyPayment(payment: ProviderPayment): Promise<VerifiedPayment>;
}
