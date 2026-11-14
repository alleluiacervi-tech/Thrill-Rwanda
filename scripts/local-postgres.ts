import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const databaseDir = resolve(process.cwd(), ".local-postgres");
const databaseName = "thrill_rwanda";

const postgres = new EmbeddedPostgres({
  databaseDir,
  port: 54329,
  user: "postgres",
  password: "thrill-rwanda-local",
  authMethod: "scram-sha-256",
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: (message) => console.log(`[local-postgres] ${message}`),
  onError: (message) => console.error("[local-postgres]", message),
});

async function main() {
  if (!existsSync(join(databaseDir, "PG_VERSION"))) {
    await postgres.initialise();
  }

  await postgres.start();

  try {
    const client = postgres.getPgClient();
    try {
      await client.connect();
      const { rowCount } = await client.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [databaseName],
      );
      if (!rowCount) await postgres.createDatabase(databaseName);
    } finally {
      await client.end();
    }

    console.log(`Local PostgreSQL is ready at 127.0.0.1:54329/${databaseName}.`);
    console.log("Leave this terminal open while using the app; press Ctrl+C to stop.");
    await new Promise<void>((resolveSignal) => {
      process.once("SIGINT", resolveSignal);
      process.once("SIGTERM", resolveSignal);
    });
  } catch (error) {
    await postgres.stop();
    throw error;
  }

  await postgres.stop();
}

main().catch((error: unknown) => {
  console.error("Could not start local PostgreSQL.", error);
  process.exitCode = 1;
});
