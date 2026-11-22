import { getUrubutoProvider, urubutoWebhookConfig } from "@/lib/collections/urubuto";
import { callbackReply, matchSecret, webhookJson, webhookLogin, webhookToken } from "@/lib/collections/webhooks";

export async function POST(request: Request) {
  const config = urubutoWebhookConfig();
  if (!config || !getUrubutoProvider()) return callbackReply(404, "Unavailable");
  const input = webhookLogin.safeParse(await webhookJson(request));
  if (!input.success) return callbackReply(401, "Unauthorized");
  const validUser = matchSecret(input.data.user_name, config.username);
  const validPassword = matchSecret(input.data.password, config.password);
  if (!validUser || !validPassword) return callbackReply(401, "Unauthorized");
  return callbackReply(200, "Authenticated", { token: `Bearer ${webhookToken(config.secret)}` });
}
