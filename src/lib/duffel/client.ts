import "server-only";
import { duffelAvailability, type DuffelConfig } from "@/lib/duffel/config";

/**
 * A small, careful client for Duffel's v2 API.
 *
 * - Every failure becomes a DuffelError that says whether it is safe to try
 *   again. Duffel documents no idempotency key, so a booking is never retried
 *   automatically: that could buy the same ticket twice.
 * - Messages shown to staff are written for staff. The raw request id is kept
 *   so Duffel's support can find the call.
 */

export const DUFFEL_VERSION = "v2";

export type DuffelErrorBody = {
  errors?: { type?: string; code?: string; title?: string; message?: string; source?: { field?: string; pointer?: string } }[];
  meta?: { request_id?: string; status?: number };
};

export class DuffelError extends Error {
  constructor(
    message: string,
    readonly info: {
      status: number;
      code: string;
      type: string;
      requestId: string | null;
      /** True only when Duffel says nothing was created and the same request may be sent again. */
      retryable: boolean;
      /** True when we cannot know whether the request took effect (timeout, 202, 5xx on a write). */
      outcomeUnknown: boolean;
    },
  ) {
    super(message);
    this.name = "DuffelError";
  }
  get code() {
    return this.info.code;
  }
}

/** What staff read for the errors they can act on. Anything else falls back to Duffel's own message. */
const FRIENDLY: Record<string, string> = {
  offer_no_longer_available: "That fare is no longer available. Search again for a current price.",
  offer_expired: "That fare has expired. Search again for a current price.",
  price_changed: "The airline changed the price. Search again and choose the fare afresh.",
  insufficient_balance: "The Duffel balance is too low to pay for this booking. Top up the balance and try again.",
  payment_declined: "The payment was declined.",
  duplicate_booking: "Duffel reports this exact booking already exists. Check the Duffel dashboard before trying again.",
  duplicate_passenger_names: "Two travellers have the same name on this booking. Check the names.",
  invalid_passenger_name: "A traveller's name was rejected. Enter it exactly as in the passport.",
  invalid_passenger_title: "A traveller's title was rejected by the airline.",
  invalid_email_address: "The contact email address was rejected.",
  invalid_phone_number: "The contact phone number was rejected. Use international format, for example +250788123456.",
  already_cancelled: "This booking is already cancelled.",
  order_not_cancellable: "This booking can no longer be cancelled.",
  rate_limit_exceeded: "Duffel is busy. Wait a minute and try again.",
  access_token_not_found: "The Duffel access token was not recognised.",
  expired_access_token: "The Duffel access token has expired.",
  insufficient_permissions: "The Duffel access token cannot do this. Create a read-write token.",
};

function toError(status: number, body: DuffelErrorBody | null, write: boolean): DuffelError {
  const first = body?.errors?.[0];
  const code = first?.code ?? `http_${status}`;
  const requestId = body?.meta?.request_id ?? null;
  const field = first?.source?.field ? ` (${first.source.field})` : "";
  const text = FRIENDLY[code] ?? `${first?.message ?? first?.title ?? "Duffel could not complete that request."}${field}`;
  // 429, 503 and 504 are documented as safe to retry; a 5xx on a write may or may not have booked.
  const retryable = status === 429 || status === 503 || (status === 504 && !write);
  const outcomeUnknown = write && (status === 202 || status === 500 || status === 502 || status === 504);
  return new DuffelError(text, { status, code, type: first?.type ?? "api_error", requestId, retryable, outcomeUnknown });
}

type Options = {
  method?: "GET" | "POST";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Booking can take up to two minutes at the airline; Duffel asks for 130 seconds or more. */
  timeoutMs?: number;
  config?: DuffelConfig;
};

export function requireDuffel(): DuffelConfig {
  const available = duffelAvailability();
  if (!available.ok) throw new DuffelError(available.message, { status: 503, code: available.reason, type: "configuration", requestId: null, retryable: false, outcomeUnknown: false });
  return available.config;
}

/** Calls Duffel and returns the `data` of its envelope. */
export async function duffel<T>(path: string, options: Options = {}): Promise<T> {
  const config = options.config ?? requireDuffel();
  const method = options.method ?? "GET";
  const write = method !== "GET";
  const url = new URL(path, config.baseUrl);
  for (const [k, v] of Object.entries(options.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Duffel-Version": DUFFEL_VERSION,
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        ...(write ? { "Content-Type": "application/json" } : {}),
      },
      body: write && options.body !== undefined ? JSON.stringify({ data: options.body }) : undefined,
    });
  } catch (cause) {
    const timedOut = (cause as { name?: string })?.name === "AbortError";
    throw new DuffelError(
      timedOut ? "Duffel did not answer in time." : "Could not reach Duffel. Check the connection and try again.",
      { status: 0, code: timedOut ? "timeout" : "network", type: "network", requestId: null, retryable: !write, outcomeUnknown: write },
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json: { data?: T } & DuffelErrorBody = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // Not JSON (an HTML error page from a proxy): handled as an unreadable failure below.
  }
  if (!res.ok) throw toError(res.status, json, write);
  // 200/202 on order creation carry a message, not an order (card payments only).
  if (res.status === 202) throw toError(202, json, write);
  if (json.data === undefined) {
    throw new DuffelError("Duffel sent a reply this app could not read.", { status: res.status, code: "unreadable", type: "api_error", requestId: res.headers.get("x-request-id"), retryable: false, outcomeUnknown: write });
  }
  return json.data;
}

export function logDuffelFailure(context: string, error: unknown) {
  if (error instanceof DuffelError) {
    // The token is never in an error; the request id is what Duffel support asks for.
    console.error(`[duffel] ${context}: ${error.info.status} ${error.info.code} request=${error.info.requestId ?? "-"} ${error.message}`);
  } else console.error(`[duffel] ${context}`, error);
}
