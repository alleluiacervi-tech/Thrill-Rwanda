/**
 * The scheduled jobs for a self-hosted server (on Vercel, vercel.json does
 * this). Times are Kigali time, which is UTC+2 all year.
 */
export type ScheduledJob = {
  name: string;
  /** Protected route on the app, called with the CRON_SECRET. */
  path?: string;
  /** Or a command run in the tools container. */
  command?: "backup";
  /** Run every N minutes, or once a day at "HH:MM" Kigali time. */
  everyMinutes?: number;
  dailyAt?: string;
};

export const VPS_JOBS: ScheduledJob[] = [
  { name: "enquiry-notifications", path: "/api/cron/enquiry-notifications", everyMinutes: 5 },
  { name: "reconcile-payments", path: "/api/cron/reconcile-payments", everyMinutes: 5 },
  { name: "backup", command: "backup", dailyAt: "02:30" },
  { name: "document-maintenance", path: "/api/cron/maintenance", dailyAt: "04:00" },
  // Same moment as the Vercel cron (03:00 UTC).
  { name: "release-holds", path: "/api/cron/release-holds", dailyAt: "05:00" },
  // Fares for the public board; does nothing unless FARE_WATCH_ENABLED=true with a live Duffel token.
  { name: "fare-watch", path: "/api/cron/fare-watch", dailyAt: "06:15" },
];

const KIGALI_OFFSET_MINUTES = 120;

/** Minutes since Kigali midnight for a moment in time. */
export function kigaliMinuteOfDay(now: Date): number {
  const m = now.getUTCHours() * 60 + now.getUTCMinutes() + KIGALI_OFFSET_MINUTES;
  return ((m % 1440) + 1440) % 1440;
}

/** Jobs that should start in the minute containing `now`. */
export function dueJobs(now: Date, jobs: ScheduledJob[] = VPS_JOBS): ScheduledJob[] {
  const minute = kigaliMinuteOfDay(now);
  return jobs.filter((job) => {
    if (job.everyMinutes) return minute % job.everyMinutes === 0;
    if (job.dailyAt) {
      const [h, m] = job.dailyAt.split(":").map(Number);
      return minute === h * 60 + m;
    }
    return false;
  });
}

/** Backup files (archive or manifest) older than `keepDays`, by name. */
export function expiredBackups(
  files: { name: string; modified: Date }[],
  now: Date,
  keepDays: number,
): string[] {
  const cutoff = now.getTime() - keepDays * 86_400_000;
  return files
    .filter((f) => /\.trb(\.json)?$/.test(f.name) && f.modified.getTime() < cutoff)
    .map((f) => f.name);
}
