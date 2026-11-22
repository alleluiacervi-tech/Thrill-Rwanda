// Read-only status access for historical Pesapal payment attempts.

const LIVE = "https://pay.pesapal.com/v3";
const SANDBOX = "https://cybqa.pesapal.com/pesapalv3";

const CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET;

/** Sandbox by default; live processing requires explicit environment approval. */
export function pesapalBase() {
  return process.env.PESAPAL_ENV === "live" ? LIVE : SANDBOX;
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
  if(process.env.PESAPAL_ENV === "live" && process.env.PESAPAL_LIVE_APPROVED !== "true") throw new PesapalError("Live payment processing requires explicit approval");
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
    signal: AbortSignal.timeout(7_000),
    redirect: "error",
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

/** Authenticated lookup. One retry with a fresh token if the cached one was rejected. */
async function call<T extends PesapalEnvelope>(
  path: string,
  what: string,
  retry = true,
): Promise<T> {
  const token = await pesapalToken();

  const res = await fetch(`${pesapalBase()}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(7_000),
    redirect: "error",
  });

  if (res.status === 401 && retry) {
    cached = null;
    return call<T>(path, what, false);
  }

  const body = (await res.json().catch(() => null)) as T | null;
  if (!body) throw new PesapalError(`Pesapal ${what} returned ${res.status} with no JSON.`);
  return assertOk(body, what);
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
    "status",
  );
}

/** Pesapal's numeric result mapped onto our PaymentStatus. */
export function mapStatus(code: number | undefined) {
  if (code === 1) return "SUCCEEDED" as const;
  if (code === 2) return "FAILED" as const;
  if (code === 3) return "REFUNDED" as const;
  return "PENDING" as const;
}

/** VISA and MASTERCARD land on CARD, everything mobile on MPESA. */
export function mapMethod(method: string | null | undefined) {
  const m = (method ?? "").toUpperCase();
  if (m.includes("VISA") || m.includes("MASTER") || m.includes("CARD")) return "CARD" as const;
  if (m.includes("BANK")) return "BANK_TRANSFER" as const;
  return "MPESA" as const;
}
