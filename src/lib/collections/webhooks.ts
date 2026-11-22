import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
const signed = (text: string, secret: string) => createHmac("sha256", secret).update(text).digest("base64url");
export const matchSecret = (left: string, right: string) =>
  timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());

export function webhookToken(secret: string, now = Math.floor(Date.now() / 1000)) {
  const payload = Buffer.from(JSON.stringify({ iss: "thrill-rwanda", aud: "urubutopay", iat: now, exp: now + 7200 })).toString("base64url");
  const message = `${header}.${payload}`;
  return `${message}.${signed(message, secret)}`;
}

export function verifyWebhookToken(authorization: string | null, secret: string, now = Math.floor(Date.now() / 1000)) {
  const match = authorization?.match(/^Bearer ([\w-]{1,200})\.([\w-]{1,500})\.([\w-]{43})$/);
  if (!match || match[1] !== header || !matchSecret(match[3], signed(`${match[1]}.${match[2]}`, secret))) return false;
  try {
    const claims = JSON.parse(Buffer.from(match[2], "base64url").toString());
    return claims.iss === "thrill-rwanda" && claims.aud === "urubutopay" &&
      Number.isSafeInteger(claims.iat) && claims.iat <= now + 5 &&
      Number.isSafeInteger(claims.exp) && claims.exp === claims.iat + 7200 && claims.exp > now;
  } catch { return false; }
}

export const webhookLogin = z.object({
  user_name: z.string().min(1).max(160),
  password: z.string().min(1).max(256),
});
export const webhookPayment = z.object({
  callback_type: z.literal("PAYMENT"),
  merchant_code: z.string().min(1).max(160),
  transaction_id: z.uuid().optional(),
  payer_code: z.uuid(),
  internal_transaction_id: z.string().min(1).max(160),
  transaction_status: z.string().min(1).max(40),
});

export async function webhookJson(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json") ||
    Number(request.headers.get("content-length") ?? 0) > 16_384 || !request.body) return null;
  const reader = request.body.getReader();
  let body = "";
  let bytes = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16_384) {
        await reader.cancel();
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } catch { return null; }
}

export const callbackReply = (status: number, message: string, data?: object) =>
  Response.json({ timestamp: new Date().toISOString().slice(0, 19).replace("T", " "), status, message, ...(data ? { data } : {}) },
    { status, headers: { "Cache-Control": "no-store" } });
