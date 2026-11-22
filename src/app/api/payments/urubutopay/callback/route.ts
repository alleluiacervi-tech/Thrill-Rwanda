import { db } from "@/lib/db";
import { getUrubutoProvider, urubutoWebhookConfig } from "@/lib/collections/urubuto";
import { callbackReply, verifyWebhookToken, webhookJson, webhookPayment } from "@/lib/collections/webhooks";
import { reconcileCollection, saveEvent } from "@/lib/collections/reconcile";

export const maxDuration = 30;

export async function POST(request: Request) {
  const config = urubutoWebhookConfig();
  const provider = getUrubutoProvider()?.provider;
  if (!config || !provider) return callbackReply(404, "Unavailable");
  if (!verifyWebhookToken(request.headers.get("authorization"), config.secret)) return callbackReply(401, "Unauthorized");
  const raw = await webhookJson(request);
  if (raw && typeof raw.callback_type === "string" && raw.callback_type !== "PAYMENT") return callbackReply(200, "Received");
  const parsed = webhookPayment.safeParse(raw);
  if (!parsed.success || parsed.data.merchant_code !== provider.merchantCode ||
    (parsed.data.transaction_id && parsed.data.transaction_id !== parsed.data.payer_code)) {
    return callbackReply(400, "Invalid callback");
  }
  try {
    const payload = parsed.data;
    const attempt = await db.collectionAttempt.findFirst({
      where: {
        merchantReference: payload.transaction_id ?? payload.payer_code, provider: provider.id,
        environment: provider.environment, merchantCode: provider.merchantCode, serviceCode: provider.serviceCode,
      },
    });
    if (!attempt) return callbackReply(200, "Received");
    const event = await db.$transaction(async (tx) => {
      // Callbacks only queue verification. The status endpoint remains authoritative.
      return saveEvent(tx, attempt, "WEBHOOK", "Received", `${payload.internal_transaction_id}/${payload.transaction_status}`);
    });
    await reconcileCollection(attempt.merchantReference, event.count > 0);
    return callbackReply(200, "Received");
  } catch {
    console.warn("[collections] callback processing failed");
    return callbackReply(503, "Retry later");
  }
}
