import { reconcilePayment } from "@/lib/payments";

// Where Pesapal sends the customer back to after paying. It is a browser
// navigation, not a server-to-server call, so nothing here is trusted for
// money — the tracking id is only used to ask Pesapal again.
//
// The payment form is embedded, so this usually loads inside Pesapal's frame.
// It answers with a page that moves the whole window, not just the frame.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function breakOut(path: string) {
  // The path is built from our own reference and a fixed outcome word, never from the query.
  const target = JSON.stringify(path);
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Returning…</title>
<p style="font:14px system-ui;padding:24px">Returning to your booking…</p>
<script>(window.top || window).location.replace(${target});</script>
<noscript><a href=${target} target="_top">Continue to your booking</a></noscript>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const trackingId = params.get("OrderTrackingId") ?? params.get("orderTrackingId");

  if (!trackingId) return breakOut("/account/bookings?payment=unknown");

  const result = await reconcilePayment(trackingId);

  // Without a reference there is no booking page to land on, which happens
  // only if the tracking id was never ours.
  if (!result.bookingReference) return breakOut("/account/bookings?payment=unknown");

  return breakOut(`/account/bookings/${result.bookingReference}?payment=${result.outcome}`);
}
