// Loaded before the client module, which reads the credentials at import time.
import "dotenv/config";
import { listIpns, pesapalBase, pesapalConfigured, registerIpn } from "../src/lib/pesapal";

// One-off setup. Pesapal will not call us back until an IPN URL has been
// registered against the merchant account and its id is in PESAPAL_IPN_ID.
//
//   npm run pesapal:ipn                       list what is registered
//   npm run pesapal:ipn -- https://host/...   register a URL and print its id

const PATH = "/api/payments/pesapal/ipn";

async function main() {
  if (!pesapalConfigured()) {
    throw new Error("Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET in .env first.");
  }

  console.log(`Pesapal endpoint: ${pesapalBase()}`);

  const arg = process.argv[2];

  if (!arg) {
    const existing = await listIpns();
    if (!Array.isArray(existing) || existing.length === 0) {
      console.log("\nNo IPN URLs registered yet.");
      console.log(`Register one:  npm run pesapal:ipn -- https://your-domain${PATH}`);
      return;
    }
    console.log("\nRegistered IPN URLs:\n");
    for (const ipn of existing) console.log(`  ${ipn.ipn_id}  ${ipn.url}`);
    console.log("\nPut the id for this environment in PESAPAL_IPN_ID.");
    return;
  }

  const url = new URL(arg);

  // Pesapal will not deliver to http, and a localhost URL it cannot resolve
  // registers fine but never fires — catch both here rather than in prod.
  if (url.protocol !== "https:") throw new Error("The IPN URL must be https.");
  if (/localhost|127\.0\.0\.1/.test(url.hostname)) {
    throw new Error("Pesapal cannot reach localhost. Use a tunnel hostname or the live domain.");
  }
  if (url.pathname !== PATH) {
    console.warn(`\nWarning: the handler lives at ${PATH}, but you passed ${url.pathname}.`);
  }

  const result = await registerIpn(url.toString(), "POST");

  console.log(`\nRegistered ${result.url}`);
  console.log(`\n  PESAPAL_IPN_ID="${result.ipn_id}"\n`);
  console.log("Add that line to .env and restart the server.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
