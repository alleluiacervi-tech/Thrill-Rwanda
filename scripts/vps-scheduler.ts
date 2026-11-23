/**
 * Scheduler for a self-hosted server: wakes each minute and runs the jobs in
 * src/lib/vps-schedule.ts. Runs in the tools container (deploy/compose.yml).
 *
 *   APP_INTERNAL_URL   where the website answers inside the server (http://app:3000)
 *   CRON_SECRET        same value the website has
 *   BACKUP_KEEP_DAYS   how long local backups are kept (default 14)
 *   BACKUP_HEARTBEAT_URL  optional heartbeat (healthchecks.io style): pinged
 *                      after each good backup, "<url>/fail" after a failed one,
 *                      so a missed or failed backup raises an alert
 *
 * Output is one line per run, with no secrets or customer data.
 */
import { spawn } from "node:child_process";
import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { dueJobs, expiredBackups, type ScheduledJob } from "../src/lib/vps-schedule";

const base = process.env.APP_INTERNAL_URL || "http://app:3000";
const secret = process.env.CRON_SECRET;
const keepDays = Number(process.env.BACKUP_KEEP_DAYS || 14);
const backupDir = join(process.cwd(), ".backups");
const running = new Set<string>();

const heartbeat = process.env.BACKUP_HEARTBEAT_URL;
const log = (job: string, outcome: string) =>
  console.log(`${new Date().toISOString()} ${job} ${outcome}`);

/** Tells the heartbeat monitor how the backup went. Never fails the job. */
async function ping(ok: boolean) {
  if (!heartbeat) return;
  try {
    await fetch(ok ? heartbeat : `${heartbeat.replace(/\/$/, "")}/fail`, { signal: AbortSignal.timeout(10_000) });
  } catch {
    log("backup", "heartbeat ping failed");
  }
}

async function callRoute(job: ScheduledJob) {
  if (!secret) return log(job.name, "skipped: CRON_SECRET is not set");
  const res = await fetch(base + job.path, {
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(5 * 60_000),
  });
  log(job.name, `HTTP ${res.status}`);
}

async function backup() {
  if (!process.env.BACKUP_ENCRYPTION_KEY) return log("backup", "skipped: BACKUP_ENCRYPTION_KEY is not set");
  const code = await new Promise<number>((done) => {
    // tsx directly rather than through npx, which wants a writable npm cache.
    const child = spawn("tsx", ["scripts/backup-database.ts"], { stdio: ["ignore", "ignore", "inherit"] });
    child.on("error", () => done(1));
    child.on("close", (c) => done(c ?? 1));
  });
  log("backup", code === 0 ? "ok" : `failed (exit ${code})`);
  await ping(code === 0);
  if (code !== 0) return;
  const names = await readdir(backupDir).catch(() => [] as string[]);
  const files = await Promise.all(
    names.map(async (name) => ({ name, modified: (await stat(join(backupDir, name))).mtime })),
  );
  const old = expiredBackups(files, new Date(), keepDays);
  await Promise.all(old.map((name) => unlink(join(backupDir, name))));
  if (old.length) log("backup", `removed ${old.length} files older than ${keepDays} days`);
}

async function run(job: ScheduledJob) {
  if (running.has(job.name)) return log(job.name, "skipped: previous run still going");
  running.add(job.name);
  try {
    await (job.command === "backup" ? backup() : callRoute(job));
  } catch (error) {
    log(job.name, `failed: ${error instanceof Error ? error.name : "error"}`);
  } finally {
    running.delete(job.name);
  }
}

function tick() {
  for (const job of dueJobs(new Date())) void run(job);
  // Wake again just after the next minute starts.
  setTimeout(tick, 60_000 - (Date.now() % 60_000) + 500);
}

log("scheduler", `started, calling ${base}`);
tick();
