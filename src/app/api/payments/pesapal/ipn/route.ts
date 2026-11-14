import { NextResponse } from "next/server";
import { reconcilePayment } from "@/lib/payments";

// Pesapal's instant payment notification. This is the authoritative path —
// the customer may close the tab before the return redirect ever fires, so
// a booking has to be able to become PAID with no browser involved.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Notification = {
  trackingId: string | null;
  merchantReference: string | null;
  notificationType: string | null;
};

function fromQuery(request: Request): Notification {
  const p = new URL(request.url).searchParams;
  return {
    trackingId: p.get("OrderTrackingId") ?? p.get("orderTrackingId"),
    merchantReference: p.get("OrderMerchantReference") ?? p.get("orderMerchantReference"),
    notificationType: p.get("OrderNotificationType") ?? p.get("orderNotificationType"),
  };
}

/**
 * Pesapal expects this exact envelope back and retries until it gets it.
 *
 * `status: 200` in the body is what marks the notification as delivered —
 * an HTTP 200 carrying anything else has it queued again.
 */
function ack(n: Notification, status: 200 | 500) {
  return NextResponse.json({
    orderNotificationType: n.notificationType ?? "IPNCHANGE",
    orderTrackingId: n.trackingId,
    orderMerchantReference: n.merchantReference,
    status,
  });
}

async function handle(n: Notification) {
  if (!n.trackingId) return ack(n, 500);

  try {
    // The payload is only a nudge. reconcilePayment re-asks Pesapal for the
    // real outcome, so a forged notification can't mark anything paid.
    const result = await reconcilePayment(n.trackingId);
    return ack(n, result.outcome === "unknown" ? 500 : 200);
  } catch (err) {
    console.error("[pesapal] ipn failed", err);
    return ack(n, 500);
  }
}

export async function GET(request: Request) {
  return handle(fromQuery(request));
}

export async function POST(request: Request) {
  const query = fromQuery(request);
  if (query.trackingId) return handle(query);

  // Registered as POST, Pesapal sends the same three fields as JSON.
  const body = (await request.json().catch(() => null)) as Record<string, string> | null;

  return handle({
    trackingId: body?.OrderTrackingId ?? body?.orderTrackingId ?? null,
    merchantReference: body?.OrderMerchantReference ?? body?.orderMerchantReference ?? null,
    notificationType: body?.OrderNotificationType ?? body?.orderNotificationType ?? null,
  });
}
