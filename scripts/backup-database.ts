import "dotenv/config";
import { Client } from "pg";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { encryptBackup, backupKey, signManifest } from "./backup-crypto";
import { pgProcess, flag } from "./postgres-tools";
async function main() {
  const key = backupKey(),
    connection = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connection) throw new Error("DIRECT_URL or DATABASE_URL required");
  const output = resolve(
    flag("--out") ??
      `.backups/${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.trb`,
  );
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  const client = new Client({
    connectionString: connection,
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  let created = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const snapshot = (await client.query("SELECT pg_export_snapshot() AS id"))
      .rows[0].id as string;
    const tables = (
      await client.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      )
    ).rows as { tablename: string }[];
    const counts: Record<string, string> = {};
    for (const row of tables) {
      const name = client.escapeIdentifier(row.tablename);
      counts[row.tablename] = (
        await client.query(`SELECT count(*)::text AS n FROM public.${name}`)
      ).rows[0].n;
    }
    const { child, completed } = pgProcess(
      "pg_dump",
      ["--format=custom", "--no-owner", "--no-acl", `--snapshot=${snapshot}`],
      connection,
    );
    const results = await Promise.allSettled([
      encryptBackup(child.stdout, output, key, () => {
        created = true;
      }).catch((error) => {
        child.kill("SIGTERM");
        child.stdout.resume();
        throw error;
      }),
      completed,
    ]);
    if (results[0].status !== "fulfilled" || results[1].status !== "fulfilled")
      throw new Error("Backup process failed");
    const encrypted = results[0].value;
    await client.query("COMMIT");
    const url = new URL(connection);
    const manifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      ...encrypted,
      counts,
      sourceFingerprint: createHash("sha256")
        .update(`${url.hostname}:${url.port}${url.pathname}`)
        .digest("hex"),
    };
    await writeFile(
      output + ".json",
      JSON.stringify(
        { ...manifest, hmac: signManifest(manifest, key) },
        null,
        2,
      ),
      { mode: 0o600, flag: "wx" },
    );
    console.log(
      JSON.stringify({ file: output, ...encrypted, tables: tables.length }),
    );
  } catch (error) {
    if (created) await unlink(output).catch(() => {});
    throw error;
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
}
main().catch(() => {
  console.error(
    "Backup failed. Verify connectivity, client tools and the encryption key; no credentials were logged.",
  );
  process.exitCode = 1;
});
