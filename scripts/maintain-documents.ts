import "dotenv/config";
import { db } from "../src/lib/db";
import { purgeExpiredDocuments } from "../src/lib/maintenance";
import { redactTicketingDocuments } from "../src/lib/ticketing";

const apply = process.argv.includes("--apply");
Promise.all([purgeExpiredDocuments(apply), redactTicketingDocuments(apply)])
  .then(([documents, ticketing]) => console.log(JSON.stringify({ ...documents, ticketingDocuments: ticketing })))
  .catch(() => {
    console.error(
      "Retention review failed or scheduled deletion is not approved",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
