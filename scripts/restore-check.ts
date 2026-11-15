import "dotenv/config";
import { Client } from "pg";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  backupKey,
  decryptBackup,
  sha256File,
  verifyManifest,
} from "./backup-crypto";
import { pgProcess, flag } from "./postgres-tools";
export function safeRestoreTarget(raw: string) {
  const url = new URL(raw);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    Array.from(url.searchParams.keys()).some(
      (key) => !["schema", "sslmode"].includes(key),
    ) ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "54329" ||
    !/^\/thrill_restore_[a-z0-9_]{8,60}$/.test(url.pathname)
  )
    throw new Error(
      "Restore check requires a new project-local thrill_restore_* database on port 54329",
    );
  return url;
}
async function main() {
  const file = flag("--file"),
    target = flag("--target");
  if (!file || !target)
    throw new Error(
      "Use --file encrypted.trb --target a new local restore database URL",
    );
  const url = safeRestoreTarget(target),
    name = url.pathname.slice(1),
    key = backupKey(),
    backup = resolve(file);
  const { hmac, ...manifest } = JSON.parse(
    await readFile(backup + ".json", "utf8"),
  ) as {
    version: number;
    sha256: string;
    counts: Record<string, string>;
    hmac: string;
  };
  if (!verifyManifest(manifest, hmac, key))
    throw new Error("Backup manifest authentication failed");
  if (manifest.version !== 1 || manifest.sha256 !== (await sha256File(backup)))
    throw new Error("Backup manifest checksum mismatch");
  const directory = await mkdtemp(join(tmpdir(), "thrill-restore-"));
  const localDump = join(directory, "database.dump");
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  let created = false;
  try {
    await decryptBackup(backup, localDump, key);
    await admin.connect();
    await admin.query(
      `CREATE DATABASE ${admin.escapeIdentifier(name)} TEMPLATE template0`,
    );
    created = true;
    const { child, completed } = pgProcess(
      "pg_restore",
      [
        "--dbname",
        name,
        "--exit-on-error",
        "--no-owner",
        "--no-privileges",
        localDump,
      ],
      url.toString(),
    );
    child.stdout.resume();
    await completed;
    const restored = new Client({ connectionString: url.toString() });
    try {
      await restored.connect();
      for (const [table, count] of Object.entries(manifest.counts)) {
        const actual = (
          await restored.query(
            `SELECT count(*)::text AS n FROM public.${restored.escapeIdentifier(table)}`,
          )
        ).rows[0].n;
        if (actual !== count) throw new Error("Restored table count mismatch");
      }
      const constraints = (
        await restored.query(
          "SELECT count(*)::int AS n FROM pg_constraint WHERE contype='f' AND convalidated=false",
        )
      ).rows[0].n;
      if (constraints)
        throw new Error("Restored foreign key validation incomplete");
      console.log(
        JSON.stringify({
          status: "verified",
          tables: Object.keys(manifest.counts).length,
          checksum: manifest.sha256,
          target: "isolated local restore database",
          destroyedAfterCheck: true,
        }),
      );
    } finally {
      await restored.end();
    }
  } finally {
    if (created)
      await admin.query(
        `DROP DATABASE ${admin.escapeIdentifier(name)} WITH (FORCE)`,
      );
    await admin.end().catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
}
if (process.argv[1]?.endsWith("restore-check.ts"))
  main().catch(() => {
    console.error(
      "Restore check failed; existing databases were not replaced. Verify key, manifest, tools and a fresh guarded local target.",
    );
    process.exitCode = 1;
  });
