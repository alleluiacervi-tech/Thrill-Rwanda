"use server";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { initiateUrubutoTest, urubutoChannels, urubutoTestConfig, verifyUrubutoTest, UrubutoTestError } from "@/lib/urubuto-pay";

const path = "/events-business/payment-preview/staging";
const cookieName = "thrill_urubuto_staging";
const inputSchema = z.object({
  method: z.enum(urubutoChannels),
  name: z.string().trim().min(2).max(100),
  email: z.email().max(200),
  phone: z.string().trim().regex(/^2507\d{8}$/),
});

function signature(secret: string, userId: string, reference: string) {
  return createHmac("sha256", secret).update(`${userId}/${reference}`).digest("hex");
}

export async function runUrubutoTest(_state: { message: string; checkout?: string }, form: FormData) {
  const user = await requireAdmin(path);
  const config = urubutoTestConfig();
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!config || !secret) return { message: "UrubutoPay test credentials are required." };
  const jar = await cookies();
  const [reference, token] = jar.get(cookieName)?.value.split(".") ?? [];
  const valid = reference && token && /^TEST-[a-f0-9-]{36}$/.test(reference) &&
    /^[a-f0-9]{64}$/.test(token) &&
    timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(signature(secret, user.id, reference), "hex"));

  if (form.get("command") === "status") {
    if (!valid) return { message: "Start a staging payment first." };
    try {
      const status = await verifyUrubutoTest(config, reference);
      return { message: `${reference} · ${status.replaceAll("_", " ").toLowerCase()}` };
    } catch (error) {
      return { message: error instanceof UrubutoTestError && error.httpStatus === 404
        ? "The provider has no record of this test reference yet. Check again before starting another test."
        : "Could not verify this test payment. Check again shortly." };
    }
  }

  const parsed = inputSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: "Enter a test name, email and Rwanda number in the format 2507XXXXXXXX." };
  if (valid) {
    try {
      const status = await verifyUrubutoTest(config, reference);
      if (status === "INITIATED" || status === "PENDING")
        return { message: "The previous test is still pending. Check its status before starting again." };
    } catch (error) {
      if (!(error instanceof UrubutoTestError && error.httpStatus === 404))
        return { message: "Could not check the previous test. Try checking its status again." };
    }
  }
  let returnUrl: URL;
  try {
    returnUrl = new URL(path, process.env.NEXT_PUBLIC_SITE_URL);
    if (returnUrl.protocol !== "https:" && returnUrl.hostname !== "localhost")
      throw new Error("Invalid site origin");
  } catch {
    return { message: "Configure the site URL for the hosted checkout return." };
  }
  const attempt = `TEST-${randomUUID()}`;
  jar.set(cookieName, `${attempt}.${signature(secret, user.id, attempt)}`, {
    httpOnly: true,
    secure: returnUrl.protocol === "https:",
    sameSite: "lax",
    path,
    maxAge: 60 * 60,
  });
  try {
    const checkout = await initiateUrubutoTest(config, { ...parsed.data, reference: attempt, returnUrl: returnUrl.href });
    return { message: checkout ? "Hosted test checkout is ready." : "Test request submitted. Check the transaction status after approval.", checkout };
  } catch {
    return { message: "Initiation could not be confirmed. Check the transaction status before trying again." };
  }
}
