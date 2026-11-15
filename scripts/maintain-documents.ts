import "dotenv/config";
import { db } from "../src/lib/db";
import { purgeExpiredDocuments } from "../src/lib/maintenance";
purgeExpiredDocuments(process.argv.includes("--apply"))
  .then((result) => console.log(JSON.stringify(result)))
  .catch(() => {
    console.error(
      "Retention review failed or scheduled deletion is not approved",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
