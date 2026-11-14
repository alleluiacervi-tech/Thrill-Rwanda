import { randomUUID } from "node:crypto";

// Pesapal API 3.0 client. No SDK — it is four JSON endpoints behind a
// short-lived bearer token, and a dependency here would age badly.

const LIVE = "https://pay.pesapal.com/v3";
const SANDBOX = "https://cybqa.pesapal.com/pesapalv3";

const CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET;

/** Live unless PESAPAL_ENV says sandbox. Getting this backwards charges real cards. */
export function pesapalBase() {
  return process.env.PESAPAL_ENV === "sandbox" ? SANDBOX : LIVE;
}

/** True once both halves of the merchant credential are present. */
export function pesapalConfigured() {
  return Boolean(CONSUMER_KEY && CONSUMER_SECRET);
}

/** The registered IPN id. Without it Pesapal takes orders but never calls us back. */
export function pesapalIpnId() {
  return process.env.PESAPAL_IPN_ID || null;
}

export class PesapalError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
    /** Pesapal's own code, e.g. amount_exceeds_default_limit. */
    readonly code?: string,
    /** contractual_error means an account limit, not a transient fault. */
    readonly errorType?: string,
  ) {
    super(message);
    this.name = "PesapalError";
  }
}

// Pesapal wraps failures in a 200 with an `error` object, so every response
// has to be inspected rather than trusting the HTTP status.
type PesapalEnvelope = {
  status?: string;
  error?: { code?: string; error_type?: string; message?: string } | null;
  message?: string;
};

function assertOk<T extends PesapalEnvelope>(body: T, what: string): T {
  if (body?.error && (body.error.code || body.error.message)) {
    throw new PesapalError(
      body.error.message || `Pesapal rejected the ${what} request.`,
      body.error,
      body.error.code,
      body.error.error_type,
    );
  }
  return body;
}

let cached: { token: string; expiresAt: number } | null = null;

// Pesapal issues five-minute tokens. We keep one for four to leave room for
// clock skew, and refetch on 401 rather than retrying the same token.
export async function pesapalToken(): Promise<string> {
  if (!CONSUMER_KEY || !CONSUMER_SECRET) {
    throw new PesapalError(
      "Pesapal is not configured. Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET.",
    );
  }

  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const res = await fetch(`${pesapalBase()}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      consumer_key: CONSUMER_KEY,
      consumer_secret: CONSUMER_SECRET,
    }),
    cache: "no-store",
  });

  const body = (await res.json().catch(() => null)) as
    | (PesapalEnvelope & { token?: string })
    | null;

  if (!body) throw new PesapalError(`Pesapal auth returned ${res.status} with no JSON.`);
  assertOk(body, "auth");
  if (!body.token) throw new PesapalError("Pesapal auth returned no token.", body);

  cached = { token: body.token, expiresAt: Date.now() + 4 * 60 * 1000 };
  return body.token;
}

/** Authenticated JSON call. One retry with a fresh token if the cached one was rejected. */
async function call<T extends PesapalEnvelope>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
  what: string,
  retry = true,
): Promise<T> {
  const token = await pesapalToken();

  const res = await fetch(`${pesapalBase()}${path}`, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });

  if (res.status === 401 && retry) {
    cached = null;
    return call<T>(path, init, what, false);
  }

  const body = (await res.json().catch(() => null)) as T | null;
  if (!body) throw new PesapalError(`Pesapal ${what} returned ${res.status} with no JSON.`);
  return assertOk(body, what);
}

export type IpnRegistration = {
  ipn_id: string;
  url: string;
  ipn_notification_type_description?: string;
};

/** Registers the callback URL. Run once per environment — the id goes in PESAPAL_IPN_ID. */
export async function registerIpn(url: string, type: "GET" | "POST" = "POST") {
  return call<PesapalEnvelope & IpnRegistration>(
    "/api/URLSetup/RegisterIPN",
    { method: "POST", body: { url, ipn_notification_type: type } },
    "IPN registration",
  );
}

/** Every IPN URL already registered against this merchant account. */
export async function listIpns() {
  const body = await call<PesapalEnvelope>(
    "/api/URLSetup/GetIpnList",
    { method: "GET" },
    "IPN list",
  );
  return body as unknown as IpnRegistration[];
}

export type SubmitOrderInput = {
  /** Our merchant reference. Unique per attempt — this is the idempotency key. */
  id: string;
  amountMinor: number;
  currency: string;
  description: string;
  callbackUrl: string;
  notificationId: string;
  email: string;
  phone?: string | null;
  firstName?: string;
  lastName?: string;
};

export type SubmitOrderResult = {
  order_tracking_id: string;
  merchant_reference: string;
  redirect_url: string;
};

/** Creates the order and returns the hosted page to send the customer to. */
export async function submitOrder(input: SubmitOrderInput) {
  // Pesapal takes major units with at most two decimals, not cents.
  const amount = Number((input.amountMinor / 100).toFixed(2));

  // A Rwandan mobile has to arrive as 2507…, no plus and no leading zero, or
  // the hosted page drops it and the MTN MoMo / Airtel Money prompt never fires.
  const phone = input.phone?.replace(/\D/g, "").replace(/^0/, "250") || undefined;

  return call<PesapalEnvelope & SubmitOrderResult>(
    "/api/Transactions/SubmitOrderRequest",
    {
      method: "POST",
      body: {
        id: input.id,
        currency: input.currency,
        amount,
        description: input.description.slice(0, 100),
        callback_url: input.callbackUrl,
        notification_id: input.notificationId,
        billing_address: {
          email_address: input.email,
          phone_number: phone,
          // Pesapal picks the payment options it offers from the billing
          // country: RW shows MTN MoMo and Airtel Money, not Kenya's M-Pesa.
          country_code: "RW",
          first_name: input.firstName || undefined,
          last_name: input.lastName || undefined,
        },
      },
    },
    "order",
  );
}

export type TransactionStatus = {
  payment_method?: string | null;
  amount?: number;
  created_date?: string;
  confirmation_code?: string | null;
  payment_status_description?: string;
  description?: string | null;
  payment_account?: string | null;
  merchant_reference?: string;
  currency?: string;
  /** 0 invalid, 1 completed, 2 failed, 3 reversed. */
  status_code?: number;
};

// The IPN only says "something changed" — it carries no amount and no
// result, so the state a booking moves on always comes from here.
export async function getTransactionStatus(orderTrackingId: string) {
  return call<PesapalEnvelope & TransactionStatus>(
    `/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    { method: "GET" },
    "status",
  );
}

/** Merchant reference for one payment attempt, e.g. TR-8F3K2Q-4E1A9C. */
export function newMerchantReference(bookingReference: string) {
  return `${bookingReference}-${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

/** Pesapal's numeric result mapped onto our PaymentStatus. */
export function mapStatus(code: number | undefined) {
  if (code === 1) return "SUCCEEDED" as const;
  if (code === 2) return "FAILED" as const;
  if (code === 3) return "REFUNDED" as const;
  return "PENDING" as const;
}

/**
 * VISA and MASTERCARD land on CARD, everything mobile (MTN MoMo, Airtel
 * Money) on MPESA — the enum's historical name for "mobile money", which the
 * admin labels as such. Renaming it is a migration with no visible gain.
 */
export function mapMethod(method: string | null | undefined) {
  const m = (method ?? "").toUpperCase();
  if (m.includes("VISA") || m.includes("MASTER") || m.includes("CARD")) return "CARD" as const;
  if (m.includes("BANK")) return "BANK_TRANSFER" as const;
  return "MPESA" as const;
}
