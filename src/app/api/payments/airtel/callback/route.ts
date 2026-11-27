import { z } from "zod";
import { db } from "@/lib/db";
import { getAirtelLiveGateway, referenceFromAirtelId } from "@/lib/collections/airtel";
import { callbackReply, webhookJson } from "@/lib/collections/webhooks";
import { reconcileCollection, saveEvent } from "@/lib/collections/reconcile";

export const maxDuration = 30;

// Airtel posts { transaction: { id, status_code, airtel_money_id, message } } when a
// collection settles. The body is never trusted: it only prompts an immediate status
// enquiry to Airtel, which stays authoritative (as for every other provider). The id is
// our own unguessable reference, and checks are rate-limited per attempt.
const callback = z.object({
  transaction: z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    status_code: z.string().max(20).optional(),
  }),
});

export async function POST(request: Request) {
  const provider = getAirtelLiveGateway()?.provider;
  if (!provider) return callbackReply(404, "Unavailable");
  const parsed = callback.safeParse(await webhookJson(request));
  const reference = parsed.success ? referenceFromAirtelId(parsed.data.transaction.id) : null;
  if (!parsed.success || !reference) return callbackReply(400, "Invalid callback");
  try {
    const attempt = await db.collectionAttempt.findFirst({
      where: {
        merchantReference: reference, provider: provider.id, environment: provider.environment,
        merchantCode: provider.merchantCode, serviceCode: provider.serviceCode,
      },
    });
    if (!attempt) return callbackReply(200, "Received");
    const event = await db.$transaction((tx) =>
      saveEvent(tx, attempt, "WEBHOOK", "Received", `airtel/${parsed.data.transaction.status_code ?? "?"}`),
    );
    await reconcileCollection(attempt.merchantReference, event.count > 0);
    return callbackReply(200, "Received");
  } catch {
    console.warn("[collections] Airtel callback processing failed");
    return callbackReply(503, "Retry later");
  }
}
