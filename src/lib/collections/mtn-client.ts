import { z } from "zod";

const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().int().positive() });

export type MtnClientConfig = {
  /** Collection API root, for example `https://host/collection`, without a trailing slash. */
  base: string;
  subscription: string;
  user: string;
  key: string;
  target: string;
};

/** Authenticated MTN MoMo Collections requests with a cached, single-flight access token and one retry on 401. */
export function mtnClient(config: MtnClientConfig) {
  let token: { value: string; expiry: number } | undefined;
  let renewal: Promise<string> | undefined;
  async function accessToken() {
    if (token && token.expiry > Date.now()) return token.value;
    if (!renewal) renewal = (async () => {
      const reply = await fetch(`${config.base}/token/`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${config.user}:${config.key}`).toString("base64")}`, "Ocp-Apim-Subscription-Key": config.subscription },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(7_000),
      });
      if (!reply.ok) throw new Error("MTN access token unavailable");
      const item = tokenSchema.parse(await reply.json());
      token = { value: item.access_token, expiry: Date.now() + Math.max(1, item.expires_in - 30) * 1000 };
      return token.value;
    })().finally(() => { renewal = undefined; });
    return renewal;
  }

  return async function request(path: string, init?: { body: object; reference: string }) {
    const call = async () => fetch(config.base + path, {
      method: init ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        "Ocp-Apim-Subscription-Key": config.subscription,
        "X-Target-Environment": config.target,
        ...(init ? { "X-Reference-Id": init.reference, "Content-Type": "application/json" } : {}),
      },
      body: init ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(7_000),
    });
    const first = await call();
    if (first.status !== 401) return first;
    token = undefined;
    return call();
  };
}
