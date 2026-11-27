/**
 * Runs one real collection against Airtel's UAT (test) Open API, then follows its
 * status until it settles. Nothing here touches the database or real money.
 *
 *   AIRTEL_SANDBOX_ENABLED=true AIRTEL_SANDBOX_CLIENT_ID=... AIRTEL_SANDBOX_CLIENT_SECRET=... APP_ENV=development \
 *     npx tsx scripts/airtel-sandbox-check.ts 0731234567 100
 *
 * Use the test number Airtel gives you for UAT. On a real UAT handset, approve the
 * USSD prompt with the test PIN; otherwise it times out and reports TF/TE.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { airtelSandboxProvider, airtelTransactionId } from "../src/lib/collections/airtel";

async function main() {
  const [phone, amountArg] = process.argv.slice(2);
  const amount = Number(amountArg ?? "100");
  const provider = airtelSandboxProvider();
  if (!provider) {
    console.error("Set AIRTEL_SANDBOX_ENABLED=true, AIRTEL_SANDBOX_CLIENT_ID, AIRTEL_SANDBOX_CLIENT_SECRET and APP_ENV=development (or staging).");
    process.exit(2);
  }
  if (!phone || !provider.acceptsPhone?.(phone) || !Number.isSafeInteger(amount) || amount < 1) {
    console.error("Usage: npx tsx scripts/airtel-sandbox-check.ts <Airtel number 072/073...> <whole RWF amount>");
    process.exit(2);
  }
  const payment = { reference: randomUUID(), amountMinor: amount, currency: "RWF", method: "AIRTEL_MONEY" as const };
  console.log(`Requesting RWF ${amount} from ${phone} (Airtel id ${airtelTransactionId(payment.reference)})…`);
  await provider.createPayment({ ...payment, name: "Sandbox test", email: "sandbox@example.invalid", phone, returnUrl: "" });
  console.log("Accepted by Airtel. Approve the prompt on the test handset if you have one.");

  for (let i = 0; i < 24; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    const result = await provider.verifyPayment(payment);
    console.log(`  ${new Date().toISOString().slice(11, 19)}  ${result.state}`);
    if (result.state !== "pending" && result.state !== "missing") {
      console.log(result.state === "paid" ? "Collection succeeded." : `Collection ended: ${result.state}.`);
      return;
    }
  }
  console.log("Still pending after 2 minutes; Airtel will expire it.");
}

main().catch((error) => {
  console.error("Airtel sandbox check failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
