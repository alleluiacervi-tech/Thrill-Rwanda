import "dotenv/config";
import { environmentChecks, environmentName } from "../src/lib/release-rules";
const checks = environmentChecks();
console.log(
  JSON.stringify({ environment: environmentName(), checks }, null, 2),
);
if (process.argv.includes("--strict") && checks.some((c) => !c.ok))
  process.exitCode = 1;
