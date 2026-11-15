import { spawn } from "node:child_process";
export function pgEnvironment(connection: string) {
  const url = new URL(connection);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("Expected a PostgreSQL URL");
  const sslmode = url.searchParams.get("sslmode");
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    ...(sslmode ? { PGSSLMODE: sslmode } : {}),
    PGCONNECT_TIMEOUT: "15",
  };
}
export function pgProcess(
  tool: "pg_dump" | "pg_restore",
  args: string[],
  connection: string,
) {
  const binary =
    process.env[tool === "pg_dump" ? "PG_DUMP_BIN" : "PG_RESTORE_BIN"] || tool;
  const child = spawn(binary, args, {
    env: pgEnvironment(connection),
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stderr.resume();
  const completed = new Promise<void>((resolve, reject) => {
    child.once("error", () => {
      child.stdout.destroy();
      reject(
        new Error(
          `${tool} could not start; install PostgreSQL client tools matching the server version`,
        ),
      );
    });
    child.once("close", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `${tool} failed (exit ${code}); no credentials or database error contents were logged`,
            ),
          ),
    );
  });
  return { child, completed };
}
export function flag(name: string) {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
}
